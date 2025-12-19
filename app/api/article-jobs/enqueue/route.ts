import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { getUserArticleLimit } from '@/lib/articleLimits';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { keywords, websiteId, userId, totalArticles = 30 } = body;

    console.log(`📥 Enqueue request received:`, {
      websiteId,
      userId,
      totalArticles,
      keywordsCount: keywords?.length || 0
    });

    if (!keywords || keywords.length === 0) {
      console.error("❌ No keywords provided");
      return NextResponse.json(
        { error: "Keywords are required" },
        { status: 400 }
      );
    }

    if (!websiteId || !userId) {
      console.error("❌ Missing websiteId or userId:", { websiteId, userId });
      return NextResponse.json(
        { error: "Website ID and User ID are required" },
        { status: 400 }
      );
    }

    // Get user's package limit and enforce it
    const userLimit = await getUserArticleLimit(userId);
    const requestedArticles = totalArticles || userLimit;
    const finalArticleCount = Math.min(requestedArticles, userLimit);
    
    if (requestedArticles > userLimit) {
      console.warn(`⚠️ User requested ${requestedArticles} articles but limit is ${userLimit}, capping to ${userLimit}`);
    }

    console.log(`📊 User package limit: ${userLimit}, Requested: ${requestedArticles}, Final: ${finalArticleCount}`);

    // Extract keyword strings
    let keywordStrings: string[] = [];
    
    if (keywords && keywords.length > 0) {
      keywordStrings = keywords.map((kw: any) => 
        typeof kw === 'string' ? kw : kw.keyword
      ).filter((kw: string) => kw && kw.trim() !== '');
    }

    console.log(`📊 Extracted ${keywordStrings.length} keyword strings`);

    // If no keywords after extraction, fetch them from the website record
    if (keywordStrings.length === 0) {
      console.warn("⚠️ No keywords provided, fetching from website record...");
      
      try {
        const { data: websiteData } = await supabase
          .from('websites')
          .select('keywords')
          .eq('id', websiteId)
          .single();
        
        if (websiteData?.keywords?.keywords && websiteData.keywords.keywords.length > 0) {
          keywordStrings = websiteData.keywords.keywords
            .slice(0, 5)
            .map((kw: any) => typeof kw === 'string' ? kw : kw.keyword)
            .filter((kw: string) => kw && kw.trim() !== '');
          console.log(`✅ Found ${keywordStrings.length} keywords from website record`);
        }
      } catch (error) {
        console.error("⚠️ Error fetching keywords from website:", error);
      }
    }

    // If still no keywords, use a default keyword based on the topic
    if (keywordStrings.length === 0) {
      console.warn("⚠️ No keywords found anywhere, using default keyword");
      try {
        const { data: websiteData } = await supabase
          .from('websites')
          .select('topic')
          .eq('id', websiteId)
          .single();
        
        if (websiteData?.topic && websiteData.topic !== 'General') {
          keywordStrings = [websiteData.topic];
          console.log(`✅ Using website topic as keyword: "${websiteData.topic}"`);
        } else {
          keywordStrings = ['content'];
          console.log(`⚠️ Using fallback keyword: "content"`);
        }
      } catch (error) {
        console.error("⚠️ Error fetching topic:", error);
        keywordStrings = ['content'];
      }
    }

    console.log(`📝 Final keywords to use: ${keywordStrings.join(", ")}`);

    // Create jobs for articles (up to package limit)
    const jobs = [];
    for (let i = 1; i <= finalArticleCount; i++) {
      jobs.push({
        website_id: websiteId,
        user_id: userId,
        keywords: keywordStrings,
        article_number: i,
        total_articles: finalArticleCount,
        status: 'pending',
         generate_images: true,  // Use underscore naming to match database
        image_count: 2          // Use underscore naming to match database
      });
    }

    console.log(`📝 Created ${jobs.length} job objects, inserting into database...`);

    // Insert all jobs at once
    const { data, error } = await supabase
      .from('article_jobs')
      .insert(jobs)
      .select();

    if (error) {
      console.error("❌ Error creating jobs:", error);
      return NextResponse.json(
        { error: "Failed to create jobs", details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully created ${data?.length || 0} article jobs for website ${websiteId}`);
    console.log(`📋 Job IDs:`, data?.map(j => j.id).slice(0, 5), data?.length > 5 ? '...' : '');

    return NextResponse.json({
      success: true,
      message: `Queued ${finalArticleCount} articles for generation`,
      jobCount: data.length,
      packageLimit: userLimit,
      requested: requestedArticles,
      actual: finalArticleCount
    });

  } catch (error) {
    console.error("Error enqueueing jobs:", error);
    return NextResponse.json(
      { error: "Failed to enqueue jobs", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

