// app/api/keyword/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { filterKeywords, KeywordData } from "@/lib/dataforseo";
import { fetchKeywordGap } from "@/lib/fetchKeywordGap";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface KeywordRequest {
  topic: string;
  websiteUrl?: string;
  maxDifficulty?: number;
  minVolume?: number;
  maxVolume?: number;  // NEW: Add this line
  maxCompetition?: number; // NEW: allow caller to set competition threshold
  limit?: number;
  includeCompetitors?: boolean;
}

// Internal function to call your competitor API
async function fetchCompetitors(request: Request, domain: string, limit: number = 10) {
  try {
    console.log(`🔍 [COMPETITOR] Fetching competitors for domain: ${domain}`);
    // Get the authentication token from the request
    const authHeader = request.headers.get('authorization');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/competitors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        domain: domain,
        engine: "google",
        limit: limit
      }),
    });
    if (!response.ok) {
      console.log(`❌ [COMPETITOR] API failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    if (data.competitors && data.competitors.length > 0) {
      console.log(`✅ [COMPETITOR] Found ${data.competitors.length} competitors`);
      return data.competitors;
    } else {
      console.log('❌ [COMPETITOR] No competitors found in response');
      return [];
    }
  } catch (error) {
    console.error('❌ [COMPETITOR] Failed to fetch competitors:', error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    // Check authentication using JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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
    } = await supabase.auth.getUser();

    if (!user || !user.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user needs onboarding (handled by middleware, so just log for debug)
    const { data: predata } = await supabaseAdmin
      .from('pre_data')
      .select('*')
      .eq('email', user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Only log onboarding status for debugging; do not block API
    const onboardingIncomplete = !predata || (() => {
      const hasWebsite = predata?.website && predata.website.trim() !== '';
      const hasCompetitors = Array.isArray(predata?.competitors) && predata.competitors.length > 0;
      const hasKeywords = Array.isArray(predata?.keywords) && predata.keywords.length > 0;
      return !hasWebsite || !hasCompetitors;
    })();
    if (onboardingIncomplete) {
      console.warn('[API/keyword] User onboarding incomplete, but not blocking due to middleware enforcement.');
    }

    // Check subscription status
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('subscribe')
      .eq('id', user.id)
      .single();

    if (!userData?.subscribe) {
      return NextResponse.json(
        { error: "Subscription required" },
        { status: 403 }
      );
    }

    const body: KeywordRequest = await request.json();

    const {
      topic,
      websiteUrl,
      maxDifficulty = 70,
      minVolume = 10,
      maxVolume = Infinity,  // Allow high-volume keywords by default
      maxCompetition = 0.6,
      limit = 100,
      includeCompetitors = false
    } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    console.log("🔍 Fetching REAL keywords from DataForSEO for topic:", topic);
    console.log("🌐 Website URL for competitors:", websiteUrl);
    console.log("📊 Include competitors:", includeCompetitors);
    console.log("🎯 Keyword filters - minVolume:", minVolume, "maxVolume:", maxVolume, "maxDifficulty:", maxDifficulty, "maxCompetition:", maxCompetition);

    // Extract domain from websiteUrl if provided
    let domain: string | null = null;
    if (websiteUrl) {
      domain = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      console.log(`🔧 Extracted domain: ${domain}`);
    }

    let keywords: KeywordData[] = [];
    let competitors: string[] = [];
    let fallbackUsed = false;
    let isRealData = false;

    if (domain) {
      if (includeCompetitors) {
        // Use Domain Intersection API for keyword gap with competitors
        competitors = await fetchCompetitors(request, domain, 8);
        let allGapKeywords: KeywordData[] = [];
        for (const competitor of competitors) {
          try {
            const gap = await fetchKeywordGap(domain, competitor, limit, [topic]);
            allGapKeywords = allGapKeywords.concat(gap);
          } catch (e) {
            console.warn(`⚠️ Failed to fetch keyword gap for competitor: ${competitor}`);
          }
        }
        keywords = filterKeywords(allGapKeywords, maxDifficulty, minVolume, maxVolume, maxCompetition).slice(0, limit);
      } else {
        // Use Domain Intersection API with a generic competitor
        const genericCompetitor = "google.com";
        try {
          const gap = await fetchKeywordGap(domain, genericCompetitor, limit, [topic]);
          keywords = filterKeywords(gap, maxDifficulty, minVolume, maxVolume, maxCompetition).map((kw) => ({
            ...kw,
            trafficPotential: kw.trafficPotential,
          })).slice(0, limit);
        } catch (e) {
          console.warn(`⚠️ Failed to fetch keyword gap for generic competitor: ${genericCompetitor}`);
          keywords = [];
        }
      }
      isRealData = keywords.length > 0;
      if (!isRealData) {
        fallbackUsed = true;
        keywords = [
          { keyword: `${topic}`, search_volume: 1000, difficulty: 30, cpc: 0.5, competition: 0.3 },
          { keyword: `${topic} tips`, search_volume: 500, difficulty: 25, cpc: 0.4, competition: 0.2 },
          { keyword: `best ${topic}`, search_volume: 450, difficulty: 35, cpc: 0.6, competition: 0.4 },
          { keyword: `${topic} guide`, search_volume: 400, difficulty: 28, cpc: 0.5, competition: 0.3 },
          { keyword: `${topic} tutorial`, search_volume: 350, difficulty: 27, cpc: 0.45, competition: 0.25 },
        ];
      }
    } else {
      // No domain provided, fallback to default
      fallbackUsed = true;
      keywords = [
        { keyword: `${topic}`, search_volume: 1000, difficulty: 30, cpc: 0.5, competition: 0.3 },
        { keyword: `${topic} tips`, search_volume: 500, difficulty: 25, cpc: 0.4, competition: 0.2 },
        { keyword: `best ${topic}`, search_volume: 450, difficulty: 35, cpc: 0.6, competition: 0.4 },
        { keyword: `${topic} guide`, search_volume: 400, difficulty: 28, cpc: 0.5, competition: 0.3 },
        { keyword: `${topic} tutorial`, search_volume: 350, difficulty: 27, cpc: 0.45, competition: 0.25 },
      ];
    }

    return NextResponse.json({
      success: true,
      topic: topic,
      websiteUrl: websiteUrl || null,
      keywords: keywords,
      competitors: competitors,
      totalKeywords: keywords.length,
      totalCompetitors: competitors.length,
      source: isRealData ? "DataForSEO-Real-API" : "fallback",
      is_real_data: isRealData,
      fallback_used: fallbackUsed,
      filters: {
        maxDifficulty,
        minVolume,
        maxVolume,
        maxCompetition,
        limit,
        includeCompetitors
      }
    });

  } catch (error) {
    console.error("💥 DataForSEO API error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch keywords from DataForSEO",
        details: error instanceof Error ? error.message : "Unknown error",
        source: "DataForSEO-API",
        is_real_data: false
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic');
  const websiteUrl = url.searchParams.get('websiteUrl'); // NEW
  const includeCompetitors = url.searchParams.get('competitors') === 'true'; // NEW
  
  if (!topic) {
    return NextResponse.json({
      message: "Provide 'topic' query parameter",
      example: "GET /api/keyword?topic=technology&websiteUrl=https://example.com&competitors=true"
    });
  }

  const postBody = JSON.stringify({ 
    topic, 
    websiteUrl,
    includeCompetitors 
  });
  
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: postBody
  });

  return POST(mockRequest);
}