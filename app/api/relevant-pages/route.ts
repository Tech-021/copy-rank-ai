import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RelevantPagesRequest {
  competitor?: string; // Direct competitor domain
  email?: string; // Fetch competitors from predata by email
  competitorIndex?: number; // Index of competitor to use (default: 0)
  location_code?: number; // Default: 2840 (United States)
  language_code?: string; // Default: "en"
  limit?: number; // Default: 10, max: 100
  engine?: "google" | "bing"; // Default: "google"
}

interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: any;
    result: Array<{
      target: string;
      location_code: number;
      language_code: string;
      items_count?: number;
      items: Array<{
        page_address?: string;
        page?: string;
        domain?: string;
        title?: string;
        url?: string;
        breadcrumb?: string;
        position?: number;
        items_count?: number;
        serp_info?: any;
        metrics?: any;
      }>;
    }>;
  }>;
  cost?: number;
  time?: string;
}

/**
 * Normalize domain/URL to clean hostname
 */
function normalizeDomain(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid domain input');
  }

  let domain = input.trim();

  // Remove protocol
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    try {
      const url = new URL(domain);
      domain = url.hostname;
    } catch (e) {
      // If URL parsing fails, manually remove protocol
      domain = domain.replace(/^https?:\/\//i, '').split('/')[0];
    }
  }

  // Remove www. prefix for consistency
  domain = domain.replace(/^www\./i, '');

  // Remove trailing slashes and paths
  domain = domain.split('/')[0];

  // Basic validation
  if (!domain || domain.length < 2) {
    throw new Error('Invalid domain format');
  }

  return domain.toLowerCase();
}

/**
 * Extract competitors from predata
 */
async function getCompetitorsFromPredata(email: string): Promise<string[]> {
  if (!supabaseAdmin) {
    throw new Error('Database not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('pre_data')
    .select('competitors')
    .eq('email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || !data.competitors) {
    throw new Error('No competitor data found in predata for this email');
  }

  // Handle different data formats
  let competitors: string[] = [];
  
  if (Array.isArray(data.competitors)) {
    competitors = data.competitors.map(c => String(c).trim()).filter(Boolean);
  } else if (typeof data.competitors === 'string') {
    competitors = [data.competitors];
  } else if (typeof data.competitors === 'object') {
    // Handle object format (e.g., { domain: "...", ... })
    if (data.competitors.domain) {
      competitors = [String(data.competitors.domain)];
    } else {
      competitors = Object.values(data.competitors)
        .map(v => String(v).trim())
        .filter(Boolean);
    }
  }

  if (competitors.length === 0) {
    throw new Error('No valid competitors found in predata');
  }

  return competitors;
}

/**
 * Internal function to call DataForSEO relevant_pages API (not cached)
 */
async function _fetchRelevantPagesUncached(
  target: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  engine: "google" | "bing"
): Promise<DataForSEOResponse> {
  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;

  if (!apiLogin || !apiPassword) {
    throw new Error('DataForSEO API credentials are missing');
  }

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString('base64');

  const endpoint = engine === "bing"
    ? 'https://api.dataforseo.com/v3/dataforseo_labs/bing/relevant_pages/live'
    : 'https://api.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live';

  console.log(`📡 [Cache Miss] Fetching from DataForSEO: ${target} (${engine})`);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        target: target,
        location_code: locationCode,
        language_code: languageCode,
        limit: Math.min(Math.max(1, limit), 100), // Clamp between 1 and 100
      },
    ]),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`DataForSEO API failed: ${response.status} - ${errorText}`);
  }

  const data: DataForSEOResponse = await response.json();

  if (data.status_code !== 20000) {
    throw new Error(
      `DataForSEO API error: ${data.status_message || 'Unknown error'} (code: ${data.status_code})`
    );
  }

  return data;
}

// In-memory cache for API responses
const cache = new Map<string, { data: DataForSEOResponse; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

/**
 * Call DataForSEO relevant_pages API with caching
 * Cache duration: 1 hour
 */
async function fetchRelevantPages(
  target: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  engine: "google" | "bing"
): Promise<DataForSEOResponse> {
  // Create cache key from parameters
  const cacheKey = `relevant-pages-${target}-${locationCode}-${languageCode}-${limit}-${engine}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`✅ [Cache Hit] Using cached data for: ${target} (${engine})`);
    return cached.data;
  }
  
  // Cache miss or expired - fetch fresh data
  console.log(`📡 [Cache Miss] Fetching from DataForSEO: ${target} (${engine})`);
  const data = await _fetchRelevantPagesUncached(target, locationCode, languageCode, limit, engine);
  
  // Store in cache
  cache.set(cacheKey, { data, timestamp: now });
  
  // Clean up old cache entries (keep cache size manageable)
  if (cache.size > 100) {
    const oldestKey = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  return data;
}

/**
 * Format API response for client
 */
function formatResponse(
  data: DataForSEOResponse,
  target: string,
  engine: "google" | "bing"
) {
  const task = data.tasks?.[0];
  const result = task?.result?.[0];

  if (!result || !result.items || result.items.length === 0) {
    return {
      target,
      search_engine: engine,
      total_pages_found: 0,
      pages_returned: 0,
      pages: [],
      message: 'No relevant pages found',
      metrics: {
        cost: data.cost || task?.cost || 0,
        processing_time: data.time || task?.time || '0s',
      },
    };
  }

  const pages = result.items.map((item: any, index: number) => ({
    position: index + 1,
    // Include page_address - this is the key field from DataForSEO
    page_address: item.page_address || null,
    // Also include other fields that might be available
    page: item.page || item.page_address || null,
    domain: item.domain || null,
    title: item.title || null,
    url: item.url || item.page_address || null,
    breadcrumb: item.breadcrumb || null,
    items_count: item.items_count || null,
    serp_info: item.serp_info || null,
    metrics: item.metrics || null,
  }));

  // Sort pages by Estimated Traffic Value (ETV) - highest traffic first
  const sortedPages = pages.sort((a: any, b: any) => {
    const aTraffic = a.metrics?.organic?.etv || 0;
    const bTraffic = b.metrics?.organic?.etv || 0;
    return bTraffic - aTraffic; // Descending order (highest first)
  });

  // Update positions after sorting
  const finalPages = sortedPages.map((page: any, index: number) => ({
    ...page,
    position: index + 1,
  }));

  return {
    target,
    search_engine: engine,
    location_code: result.location_code,
    language_code: result.language_code,
    total_pages_found: (result as any).items_count || finalPages.length,
    pages_returned: finalPages.length,
    pages: finalPages,
    metrics: {
      cost: data.cost || task?.cost || 0,
      processing_time: data.time || task?.time || '0s',
      api_status_code: data.status_code,
      api_status_message: data.status_message,
    },
  };
}

/**
 * POST /api/relevant-pages
 * 
 * Fetches relevant pages for a competitor domain using DataForSEO API.
 * 
 * Request body options:
 * - competitor: Direct competitor domain (e.g., "chatgpt.com")
 * - email: User email to fetch competitors from predata
 * - competitorIndex: Index of competitor to use from predata (default: 0)
 * - location_code: Location code (default: 2840 for US)
 * - language_code: Language code (default: "en")
 * - limit: Number of results (default: 10, max: 100)
 * - engine: Search engine "google" or "bing" (default: "google")
 * 
 * Authentication: Bearer token required
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.id) {
      console.error('Relevant Pages API: Authentication failed', authError);
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user needs onboarding
    const { data: predata } = await supabaseAdmin
      .from('pre_data')
      .select('*')
      .eq('email', user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const needsOnboarding = !predata || (() => {
      const hasWebsite = predata.website && predata.website.trim() !== '';
      const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0;
      const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0;
      return !hasWebsite || (!hasCompetitors && !hasKeywords);
    })();

    if (needsOnboarding) {
      return NextResponse.json(
        { error: "Onboarding required" },
        { status: 403 }
      );
    }

    // Check subscription status
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('subscribe')
      .eq('id', user.id)
      .single();

    // if (!userData?.subscribe) {
    //   return NextResponse.json(
    //     { error: "Subscription required" },
    //     { status: 403 }
    //   );
    // }

    // Parse request body
    const body: RelevantPagesRequest = await request.json().catch(() => ({}));

    const {
      competitor,
      email,
      competitorIndex = 0,
      location_code = 2840,
      language_code = "en",
      limit = 10,
      engine = "google",
    } = body;

    // Validate inputs
    if (!competitor && !email) {
      return NextResponse.json(
        {
          error: "Missing required parameter",
          message: "Either 'competitor' or 'email' must be provided",
        },
        { status: 400 }
      );
    }

    if (engine !== "google" && engine !== "bing") {
      return NextResponse.json(
        {
          error: "Invalid engine parameter",
          message: "Engine must be 'google' or 'bing'",
        },
        { status: 400 }
      );
    }

    // Get target competitor
    let target: string;

    if (competitor) {
      // Use provided competitor directly
      target = normalizeDomain(competitor);
      console.log(`Relevant Pages API: Using provided competitor: ${target}`);
    } else if (email) {
      // Fetch from predata
      const competitors = await getCompetitorsFromPredata(email);
      
      if (competitorIndex < 0 || competitorIndex >= competitors.length) {
        return NextResponse.json(
          {
            error: "Invalid competitor index",
            message: `Competitor index ${competitorIndex} is out of range. Found ${competitors.length} competitor(s).`,
            available_competitors: competitors,
          },
          { status: 400 }
        );
      }

      target = normalizeDomain(competitors[competitorIndex]);
      console.log(
        `Relevant Pages API: Using competitor from predata [${competitorIndex}]: ${target}`
      );
    } else {
      // This should never happen due to validation above, but TypeScript needs it
      throw new Error('No competitor source provided');
    }

    // Fetch relevant pages from DataForSEO
    console.log(`Relevant Pages API: Fetching relevant pages for ${target}`);
    const dataForSEOResponse = await fetchRelevantPages(
      target,
      location_code,
      language_code,
      limit,
      engine
    );

    // Format and return response
    const formattedResponse = formatResponse(
      dataForSEOResponse,
      target,
      engine
    );

    const processingTime = Date.now() - startTime;
    console.log(
      `Relevant Pages API: Successfully fetched ${formattedResponse.pages_returned} pages for ${target} in ${processingTime}ms`
    );

    return NextResponse.json({
      success: true,
      ...formattedResponse,
      metadata: {
        user_id: user.id,
        requested_at: new Date().toISOString(),
        processing_time_ms: processingTime,
      },
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('Relevant Pages API: Error', {
      error: error.message,
      stack: error.stack,
      processing_time_ms: processingTime,
    });

    // Return appropriate error response
    const statusCode =
      error.message?.includes('Authentication') ||
      error.message?.includes('Onboarding') ||
      error.message?.includes('Subscription')
        ? 403
        : error.message?.includes('Invalid') ||
          error.message?.includes('Missing') ||
          error.message?.includes('required')
        ? 400
        : error.message?.includes('not found') || error.message?.includes('No ')
        ? 404
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        processing_time_ms: processingTime,
      },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/relevant-pages
 * 
 * Health check and API information endpoint
 */
export async function GET(request: Request) {
  return NextResponse.json({
    endpoint: '/api/relevant-pages',
    method: 'POST',
    description: 'Fetches relevant pages for a competitor domain using DataForSEO API',
    authentication: 'Bearer token required',
    request_body: {
      competitor: 'string (optional) - Direct competitor domain',
      email: 'string (optional) - User email to fetch competitors from predata',
      competitorIndex: 'number (optional, default: 0) - Index of competitor from predata',
      location_code: 'number (optional, default: 2840) - Location code',
      language_code: 'string (optional, default: "en") - Language code',
      limit: 'number (optional, default: 10, max: 100) - Number of results',
      engine: 'string (optional, default: "google") - Search engine: "google" or "bing"',
    },
    examples: {
      with_competitor: {
        body: {
          competitor: 'chatgpt.com',
          limit: 10,
        },
      },
      with_email: {
        body: {
          email: 'user@example.com',
          competitorIndex: 0,
          limit: 10,
        },
      },
    },
  });
}

