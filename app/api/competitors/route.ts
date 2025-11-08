// app/api/competitors/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;
  
  if (!apiLogin || !apiPassword) {
    return NextResponse.json({ error: "Missing DataForSEO credentials" }, { status: 500 });
  }

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString('base64');
  
  try {
    const { domain, engine = "google", limit = 10 } = await request.json();
    
    const endpoint = engine === "bing" 
      ? 'https://api.dataforseo.com/v3/dataforseo_labs/bing/competitors_domain/live'
      : 'https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain,
        location_code: 2840,
        language_name: "English",
        limit: Math.min(limit, 100)
      }]),
    });

    const data = await response.json();

    if (data.status_code !== 20000) {
      return NextResponse.json({ 
        error: data.status_message || 'API error',
        status_code: data.status_code 
      }, { status: 400 });
    }

    const taskResult = data.tasks?.[0]?.result?.[0];
    
    if (!taskResult || !taskResult.items) {
      return NextResponse.json({ 
        competitors: [],
        message: 'No competitor data found'
      });
    }

    // Filter out the target domain itself and format competitors
    const competitors = taskResult.items
      .filter(item => item.domain !== domain)
      .map(item => ({
        domain: item.domain,
        common_keywords: item.intersections,
        avg_position: Math.round(item.avg_position * 100) / 100,
        organic_traffic: {
          top_3_positions: item.metrics?.organic?.pos_1 + item.metrics?.organic?.pos_2_3 || 0,
          top_10_positions: item.metrics?.organic?.pos_4_10 || 0,
          total_keywords: item.metrics?.organic?.count || 0,
          estimated_traffic_value: Math.round(item.metrics?.organic?.etv || 0)
        },
        competitive_overlap: Math.round((item.intersections / taskResult.items[0]?.intersections) * 10000) / 100, // Percentage overlap with target
        serp_overlap_quality: item.avg_position < 20 ? "High" : item.avg_position < 40 ? "Medium" : "Low"
      }))
      .sort((a, b) => b.common_keywords - a.common_keywords);

    return NextResponse.json({
      domain,
      search_engine: engine,
      total_competitors_found: taskResult.total_count,
      competitors_returned: competitors.length,
      analysis: {
        highest_overlap: competitors[0]?.common_keywords || 0,
        avg_competitor_position: Math.round(competitors.reduce((sum, c) => sum + c.avg_position, 0) / competitors.length * 100) / 100,
        high_quality_competitors: competitors.filter(c => c.serp_overlap_quality === "High").length
      },
      competitors,
      metrics: {
        cost: data.cost,
        processing_time: data.time
      }
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}