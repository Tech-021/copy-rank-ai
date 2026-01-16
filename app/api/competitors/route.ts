// app/api/competitors/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
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

  if (!userData?.subscribe) {
    return NextResponse.json(
      { error: "Subscription required" },
      { status: 403 }
    );
  }
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