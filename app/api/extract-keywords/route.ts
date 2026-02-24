export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hybridScraper } from "@/app/api/scraper/route";

// In-memory cache for keyword extraction results
const keywordCache = new Map<string, { data: any; timestamp: number }>();
const KEYWORD_CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

// Helper function to extract keywords from text
async function extractKeywords(text: string, limit: number = 20): Promise<Array<{ keyword: string; frequency: number }>> {
  if (!text || text.length === 0) {
    return [];
  }

  // Dynamically import natural and stopwords to avoid build-time issues
  const natural = await import("natural");
  const stopwordsModule = await import("stopwords");
  
  // Initialize tokenizer
  const WordTokenizer = natural.WordTokenizer;
  const tokenizer = new WordTokenizer();

  // Tokenize text
  const tokens = tokenizer.tokenize(text.toLowerCase());
  
  if (!tokens) {
    return [];
  }

  // Filter out stopwords and short words
  // stopwords can be imported as default or named export
  const stopwordsData = stopwordsModule.default || stopwordsModule;
  const englishStopwords = (stopwordsData.english || []) as string[];
  
  // More lenient filtering - allow 2-character words if they're not stopwords
  const filtered = tokens.filter(token => {
    if (!token) return false;
    // Allow words with 2+ characters (more lenient)
    if (token.length < 2) return false;
    // Filter out stopwords
    if (englishStopwords.includes(token)) return false;
    // Allow alphanumeric words (including numbers)
    if (!/^[a-z0-9]+$/.test(token)) return false;
    // Filter out very common single/double letters that aren't meaningful
    const commonNoise = ['id', 'js', 'jsx', 'ts', 'tsx', 'ui', 'ux', 'api', 'url', 'http', 'https', 'www', 'com', 'org', 'net'];
    if (token.length <= 3 && commonNoise.includes(token)) return false;
    return true;
  });

  // Count word frequencies (single words)
  const wordFreq: Record<string, number> = {};
  filtered.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Also extract bigrams (2-word phrases) for more keywords
  const bigramFreq: Record<string, number> = {};
  for (let i = 0; i < filtered.length - 1; i++) {
    const bigram = `${filtered[i]} ${filtered[i + 1]}`;
    // Only include bigrams where both words are meaningful (length >= 3)
    if (filtered[i].length >= 3 && filtered[i + 1].length >= 3) {
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1;
    }
  }

  // Combine single words and bigrams
  const allKeywords: Array<{ keyword: string; frequency: number; type: 'word' | 'phrase' }> = [
    ...Object.entries(wordFreq).map(([word, freq]) => ({ keyword: word, frequency: freq, type: 'word' as const })),
    ...Object.entries(bigramFreq).map(([phrase, freq]) => ({ keyword: phrase, frequency: freq, type: 'phrase' as const }))
  ];

  // Sort by frequency and get top keywords
  const sorted = allKeywords.sort((a, b) => b.frequency - a.frequency);
  
  // Log extraction stats
  const wordCount = Object.keys(wordFreq).length;
  const bigramCount = Object.keys(bigramFreq).length;
  const totalUnique = sorted.length;
  const actualReturned = Math.min(totalUnique, limit);
  
  console.log(`📊 Keyword extraction stats:`);
  console.log(`   - Unique words found: ${wordCount}`);
  console.log(`   - Unique bigrams found: ${bigramCount}`);
  console.log(`   - Total unique keywords: ${totalUnique}`);
  console.log(`   - Limit requested: ${limit}`);
  console.log(`   - Keywords returned: ${actualReturned} (limited by available content)`);
  
  const keywords = sorted
    .slice(0, limit)
    .map(({ keyword, frequency }) => ({
      keyword,
      frequency
    }));

  return keywords;
}

interface ExtractKeywordsRequest {
  url: string;
  limit?: number; // Default: 20, max: 200
  websiteId?: string; // Optional: when provided (and authorized), keywords will be persisted for this website
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export async function POST(request: Request) {
  try {
    const body: ExtractKeywordsRequest = await request.json();
    const { url, limit = 20, websiteId } = body;

    // Validate input
    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL is required"
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid URL format"
        },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `keywords-${url}-${limit}`;
    const cached = keywordCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < KEYWORD_CACHE_TTL) {
      console.log(`✅ [Cache Hit] Using cached keywords for: ${url}`);
      return NextResponse.json(cached.data);
    }
    
    console.log(`📡 [Cache Miss] Scraping URL for keyword extraction: ${url}`);

    // Scrape the webpage
    const scrapedData = await hybridScraper(url);

    if (!scrapedData) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to scrape the webpage"
        },
        { status: 502 }
      );
    }

    // Combine text content for keyword extraction (include more sources)
    const combinedText = [
      scrapedData.title || "",
      scrapedData.metaDescription || "",
      scrapedData.headings || "",
      scrapedData.mainText || "",
      // Include nav links and other text for more keywords
      scrapedData.navLinks || "",
      // Include link text if available
      scrapedData.links?.map((link: any) => link.text || "").join(" ") || ""
    ].filter(Boolean).join(" ");

    if (!combinedText || combinedText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No content found in the webpage"
        },
        { status: 400 }
      );
    }

    // Extract keywords
    const keywords = await extractKeywords(combinedText, Math.min(limit, 200));

    console.log(`✅ Extracted ${keywords.length} keywords from ${url}`);
    console.log(`📊 Content length: ${combinedText.length} characters`);
    console.log(`📋 Sample keywords (first 10):`, keywords.slice(0, 10).map(k => `"${k.keyword}" (${k.frequency})`).join(", "));

    // Optionally persist keywords to the websites table when called
    // from an authenticated dashboard flow and a websiteId is provided.
    if (
      websiteId &&
      supabaseAdmin &&
      supabaseUrl &&
      supabaseAnonKey &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const authHeader = request.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.substring(7);

          const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          });

          const {
            data: { user },
            error: userError,
          } = await supabaseUser.auth.getUser();

          if (!userError && user && user.id) {
            // Load website and ensure it belongs to the authenticated user
            const { data: siteData, error: siteErr } = await supabaseAdmin
              .from("websites")
              .select("id, user_id, keywords")
              .eq("id", websiteId)
              .maybeSingle();

            if (!siteErr && siteData && siteData.user_id === user.id) {
              const existingPayload = (siteData as any)?.keywords || {};
              const existingList: any[] = Array.isArray(existingPayload?.keywords)
                ? existingPayload.keywords
                : [];

              const map = new Map<string, any>();

              // Keep existing keywords
              existingList.forEach((k) => {
                const key = String(k?.keyword || k || "").toLowerCase();
                if (!key) return;
                map.set(key, k);
              });

              // Merge in newly extracted keywords
              keywords.forEach((kw) => {
                const rawText = kw?.keyword;
                if (!rawText) return;
                const key = String(rawText).toLowerCase();
                if (!key) return;

                const existing = map.get(key) || {};
                map.set(key, {
                  ...existing,
                  keyword: rawText,
                  frequency: kw.frequency ?? existing.frequency ?? 1,
                  is_target_keyword: existing.is_target_keyword ?? true,
                  post_status: existing.post_status || "No Plan",
                });
              });

              const mergedList = Array.from(map.values());

              const newPayload = {
                ...existingPayload,
                keywords: mergedList,
                analysis_metadata: {
                  ...existingPayload.analysis_metadata,
                  total_keywords: mergedList.length,
                  analyzed_at: new Date().toISOString(),
                },
              };

              const { error: updateErr } = await supabaseAdmin
                .from("websites")
                .update({ keywords: newPayload })
                .eq("id", websiteId);

              if (updateErr) {
                console.error(
                  "extract-keywords: Failed to persist keywords for website",
                  websiteId,
                  updateErr
                );
              } else {
                console.log(
                  `✅ extract-keywords: Persisted ${mergedList.length} keywords for website ${websiteId}`
                );
              }
            }
          }
        }
      } catch (persistErr) {
        console.error("extract-keywords: Error while persisting keywords:", persistErr);
      }
    }

    // Prepare response
    const responseData = {
      success: true,
      url: url,
      title: scrapedData.title || "No title found",
      description: scrapedData.metaDescription || "No description found",
      contentLength: combinedText.length,
      keywordCount: keywords.length,
      keywords: keywords,
      contentPreview:
        combinedText.substring(0, 500) +
        (combinedText.length > 500 ? "..." : ""),
    };
    
    // Store in cache
    keywordCache.set(cacheKey, { data: responseData, timestamp: now });
    
    // Clean up old cache entries (keep cache size manageable)
    if (keywordCache.size > 100) {
      const oldestKey = Array.from(keywordCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) {
        keywordCache.delete(oldestKey);
        console.log(`🧹 Cleaned up old cache entry: ${oldestKey}`);
      }
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error("❌ Keyword extraction error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred while extracting keywords"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    message: "Use POST method to extract keywords",
    example: {
      method: "POST",
      body: {
        url: "https://example.com",
        limit: 20
      }
    }
  });
}

