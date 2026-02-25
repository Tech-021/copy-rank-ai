import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { websiteId, userId, keywords, totalArticles } = body;

    if (!websiteId || !userId || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({
        error: "Missing or invalid parameters. Ensure websiteId, userId, and keywords are provided."
      }, { status: 400 });
    }

    const jobs = keywords.map((keyword: string, index: number) => ({
      website_id: websiteId,
      user_id: userId,
      keywords: [keyword],
      article_number: index + 1,
      total_articles: totalArticles || keywords.length,
      status: "pending",
      generate_images: true,
      image_count: 2
    }));

    const { data, error } = await supabase
      .from("article_jobs")
      .insert(jobs)
      .select();

    if (error) {
      console.error("❌ Error inserting article jobs:", error);
      return NextResponse.json({ error: "Failed to create article jobs." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${data.length} article jobs created successfully.`,
      jobs: data
    });
  } catch (error) {
    console.error("❌ Error creating article jobs:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}