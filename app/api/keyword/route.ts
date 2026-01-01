// app/api/keyword/route.ts
import { NextResponse } from "next/server";
import { fetchKeywordsFromDataForSEO, filterKeywords, KeywordData } from "@/lib/dataforseo";

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
async function fetchCompetitors(domain: string, limit: number = 10) {
  try {
    console.log(`🔍 [COMPETITOR] Fetching competitors for domain: ${domain}`);
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/competitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const body: KeywordRequest = await request.json();
    
    const { 
      topic, 
      websiteUrl,
      maxDifficulty = 70, 
      minVolume = 30,
      maxVolume = Infinity,  // Allow high-volume keywords by default
      maxCompetition = 0.5,
      limit = 40,
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

    // Extract domain from websiteUrl if provided
    let domain: string | null = null;
    if (websiteUrl) {
      domain = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      console.log(`🔧 Extracted domain: ${domain}`);
    }

    // Fetch keywords and competitors in parallel if requested
    const [rawKeywords, competitors] = await Promise.all([
      fetchKeywordsFromDataForSEO(topic),
      (includeCompetitors && domain) ? fetchCompetitors(domain, 8) : Promise.resolve([])
    ]);
    
    console.log(`📊 Raw keywords from DataForSEO: ${rawKeywords.length}`);
    
    const keywords = filterKeywords(rawKeywords, maxDifficulty, minVolume, maxVolume, maxCompetition).slice(0, limit);
    
    console.log(`✅ DataForSEO Success: ${keywords.length} real keywords, ${competitors.length} competitors`);
    
    // If no keywords were found after filtering, add fallback keywords and flag it
    let finalKeywords = keywords;
    let fallbackUsed = false;
    if (finalKeywords.length === 0) {
      fallbackUsed = true;
      console.warn("⚠️ No keywords passed the filter, adding fallback keywords");
      const fallbackKeywords: KeywordData[] = [
        { keyword: `${topic}`, search_volume: 1000, difficulty: 30, cpc: 0.5, competition: 0.3 },
        { keyword: `${topic} tips`, search_volume: 500, difficulty: 25, cpc: 0.4, competition: 0.2 },
        { keyword: `best ${topic}`, search_volume: 450, difficulty: 35, cpc: 0.6, competition: 0.4 },
        { keyword: `${topic} guide`, search_volume: 400, difficulty: 28, cpc: 0.5, competition: 0.3 },
        { keyword: `${topic} tutorial`, search_volume: 350, difficulty: 27, cpc: 0.45, competition: 0.25 },
      ];
      finalKeywords = fallbackKeywords;
      console.log(`✅ Using ${fallbackKeywords.length} fallback keywords`);
    }

    const isRealData = !fallbackUsed && keywords.length > 0;

    return NextResponse.json({
      success: true,
      topic: topic,
      websiteUrl: websiteUrl || null,
      keywords: finalKeywords,
      competitors: competitors,
      totalKeywords: finalKeywords.length,
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