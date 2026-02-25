import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    // Trigger processing (fire and forget)
    fetch(`${baseUrl}/api/article-jobs/process`, {
      method: 'POST',
    }).catch(error => {
      console.error("Error triggering job processing:", error);
    });
    
    return NextResponse.json({ 
      success: true, 
      message: "Article processing triggered" 
    });
  } catch (error) {
    console.error("Error in trigger endpoint:", error);
    return NextResponse.json(
      { error: "Failed to trigger processing" },
      { status: 500 }
    );
  }
}

