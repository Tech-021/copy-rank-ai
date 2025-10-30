import { NextResponse } from "next/server";
import { fetchKeywordsFromDataForSEO, filterKeywords } from "@/lib/dataforseo";

interface KeywordRequest {
  topic: string;
  maxDifficulty?: number;
  minVolume?: number;
  limit?: number;
}

export async function POST(request: Request) {
  try {
    const body: KeywordRequest = await request.json();
    
    const { 
      topic, 
      maxDifficulty = 70, 
      minVolume = 100,
      limit = 20
    } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    console.log("🔍 Fetching REAL keywords from DataForSEO for topic:", topic);

    const rawKeywords = await fetchKeywordsFromDataForSEO(topic);
    const keywords = filterKeywords(rawKeywords, maxDifficulty, minVolume).slice(0, limit);
    
    console.log(`✅ DataForSEO Success: ${keywords.length} real keywords`);

    return NextResponse.json({
      success: true,
      topic: topic,
      keywords: keywords,
      totalKeywords: keywords.length,
      source: "DataForSEO-Real-API",
      is_real_data: true,
      filters: {
        maxDifficulty,
        minVolume,
        limit
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
  
  if (!topic) {
    return NextResponse.json({
      message: "Provide 'topic' query parameter",
      example: "GET /api/keyword?topic=technology"
    });
  }

  // Create proper POST request for the GET handler
  const postBody = JSON.stringify({ topic });
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: postBody
  });

  return POST(mockRequest);
}