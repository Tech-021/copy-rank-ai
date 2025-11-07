// app/api/keyword/route.ts
import { NextResponse } from "next/server";
import { fetchKeywordsFromDataForSEO, filterKeywords } from "@/lib/dataforseo";

interface KeywordRequest {
  topic: string;
  websiteUrl?: string; // NEW: Add website URL for competitor analysis
  maxDifficulty?: number;
  minVolume?: number;
  limit?: number;
  includeCompetitors?: boolean; // NEW: Flag to include competitors
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
      websiteUrl, // NEW
      maxDifficulty = 70, 
      minVolume = 100,
      limit = 20,
      includeCompetitors = false // NEW
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
    
    const keywords = filterKeywords(rawKeywords, maxDifficulty, minVolume).slice(0, limit);
    
    console.log(`✅ DataForSEO Success: ${keywords.length} real keywords, ${competitors.length} competitors`);

    return NextResponse.json({
      success: true,
      topic: topic,
      websiteUrl: websiteUrl || null, // NEW
      keywords: keywords,
      competitors: competitors, // NEW
      totalKeywords: keywords.length,
      totalCompetitors: competitors.length, // NEW
      source: "DataForSEO-Real-API",
      is_real_data: true,
      filters: {
        maxDifficulty,
        minVolume,
        limit,
        includeCompetitors // NEW
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