import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { keywords, websiteId, userId, totalArticles = 30 } = body;

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: "Keywords are required" },
        { status: 400 }
      );
    }

    if (!websiteId || !userId) {
      return NextResponse.json(
        { error: "Website ID and User ID are required" },
        { status: 400 }
      );
    }

    // Extract keyword strings
    const keywordStrings = keywords.map((kw: any) => 
      typeof kw === 'string' ? kw : kw.keyword
    ).filter((kw: string) => kw && kw.trim() !== '');

    if (keywordStrings.length === 0) {
      return NextResponse.json(
        { error: "No valid keywords found" },
        { status: 400 }
      );
    }

    // Create jobs for all articles
    const jobs = [];
    for (let i = 1; i <= totalArticles; i++) {
      jobs.push({
        website_id: websiteId,
        user_id: userId,
        keywords: keywordStrings,
        article_number: i,
        total_articles: totalArticles,
        status: 'pending'
      });
    }

    // Insert all jobs at once
    const { data, error } = await supabase
      .from('article_jobs')
      .insert(jobs)
      .select();

    if (error) {
      console.error("Error creating jobs:", error);
      return NextResponse.json(
        { error: "Failed to create jobs", details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Created ${data.length} article jobs for website ${websiteId}`);

    return NextResponse.json({
      success: true,
      message: `Queued ${totalArticles} articles for generation`,
      jobCount: data.length
    });

  } catch (error) {
    console.error("Error enqueueing jobs:", error);
    return NextResponse.json(
      { error: "Failed to enqueue jobs", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

