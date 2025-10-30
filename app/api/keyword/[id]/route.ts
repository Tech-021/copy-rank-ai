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
  { params }: { params: { id: string } }
) {
  try {
    const websiteId = params.id;
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
    console.log(`📊 API: Keywords data:`, website.keywords);

    return NextResponse.json({
      success: true,
      website: {
        id: website.id,
        url: website.url,
        topic: website.topic
      },
      keywords: Array.isArray(website.keywords) ? website.keywords : []
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