// app/api/keyword/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔑 API Route - Environment check:', {
  hasUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseServiceKey
});

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables in API route');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    console.log(`🔍 API: Fetching keywords for website: ${websiteId}`);

    const { data: website, error } = await supabase
      .from('websites')
      .select('*')
      .eq('id', websiteId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: "Website not found" },
        { status: 404 }
      );
    }

    console.log(`✅ API: Found website: ${website.url}`);
    console.log(`📊 API: Keywords data type:`, typeof website.keywords);
    console.log(`📊 API: Keywords data structure:`, website.keywords);

    // FIX: Handle both old and new data formats
    let keywordsArray = [];
    let fullData = null;
    
    if (Array.isArray(website.keywords)) {
      // Old format: direct array of keywords
      keywordsArray = website.keywords;
      fullData = {
        keywords: website.keywords,
        competitors: [],
        analysis_metadata: null
      };
      console.log(`✅ API: Using old format - ${keywordsArray.length} keywords`);
    } else if (website.keywords && typeof website.keywords === 'object' && Array.isArray(website.keywords.keywords)) {
      // New format: object with keywords array inside
      keywordsArray = website.keywords.keywords;
      fullData = website.keywords; // This contains competitors data
      console.log(`✅ API: Using new format - ${keywordsArray.length} keywords`);
      
      // Log competitor info if available
      if (website.keywords.competitors && Array.isArray(website.keywords.competitors)) {
        console.log(`✅ API: Also found ${website.keywords.competitors.length} competitors`);
      }
    } else {
      console.warn('❌ API: Unexpected keywords format:', website.keywords);
      keywordsArray = [];
      fullData = {
        keywords: [],
        competitors: [],
        analysis_metadata: null
      };
    }

    return NextResponse.json({
      success: true,
      website: {
        id: website.id,
        url: website.url,
        topic: website.topic
      },
      keywords: keywordsArray, // Always return array for backward compatibility
      fullData: fullData, // Include full data with competitors for CompetitorsTab
      metadata: website.keywords && typeof website.keywords === 'object' ? {
        hasCompetitors: Array.isArray(website.keywords.competitors),
        totalCompetitors: website.keywords.competitors?.length || 0,
        analysisMetadata: website.keywords.analysis_metadata
      } : {
        hasCompetitors: false,
        totalCompetitors: 0,
        analysisMetadata: null
      }
    });

  } catch (error) {
    console.error('💥 API Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch keywords"
      },
      { status: 500 }
    );
  }
}