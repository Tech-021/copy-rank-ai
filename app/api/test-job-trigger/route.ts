import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log("🔄 Test job trigger started...");

    // Fetch pending jobs from the database
    const { data: jobs, error: fetchError } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("status", "pending")
      .limit(5); // Limit to 5 jobs for testing

    if (fetchError) {
      console.error("❌ Error fetching jobs:", fetchError);
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      console.log("✅ No pending jobs found.");
      return NextResponse.json({ success: true, message: "No pending jobs found" });
    }

    console.log(`📋 Found ${jobs.length} pending jobs.`);

    // Process each job
    for (const job of jobs) {
      console.log(`🚀 Processing job ${job.id}...`);

      // Ensure keywords are processed correctly
      const keywords = job.keywords || [];
      if (!Array.isArray(keywords) || keywords.length === 0) {
        console.error(`❌ Job ${job.id} has no valid keywords.`);
        continue;
      }

      // Fetch website data for the job
      const { data: website, error: websiteError } = await supabase
        .from("websites")
        .select("*")
        .eq("id", job.website_id)
        .single();

      if (websiteError) {
        console.error(`❌ Error fetching website data for job ${job.id}:`, websiteError);
        continue;
      }

      console.log(`🌐 Website data for job ${job.id}:`, website);

      // Simulate article creation for each keyword
      for (const keyword of keywords) {
        const requestBody = {
          keywords: [keyword],
          userId: job.user_id,
          websiteId: job.website_id,
          articleNumber: 1, // Assuming single article per keyword
          totalArticles: keywords.length,
          targetWordCount: 2000,
          jobId: job.id,
          generateImages: true, // Default value
          imageCount: 2, // Default value
        };

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        try {
          const response = await fetch(`${baseUrl}/api/test-generate-article`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(process.env.ARTICLE_PROCESS_SECRET
                ? { "x-internal-api-key": process.env.ARTICLE_PROCESS_SECRET }
                : {}),
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`❌ Error generating article for keyword '${keyword}' in job ${job.id}:`, errorData);
            continue;
          }

          const result = await response.json();
          console.log(`✅ Article generated for keyword '${keyword}' in job ${job.id}:`, result);
        } catch (error) {
          console.error(`❌ Error calling article generation API for keyword '${keyword}' in job ${job.id}:`, error);
        }
      }

      // Mark the job as completed
      await supabase
        .from("article_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job.id);

      console.log(`✅ Job ${job.id} marked as completed.`);
    }

    return NextResponse.json({ success: true, message: "Jobs processed successfully" });
  } catch (error) {
    console.error("❌ Error processing jobs:", error);
    return NextResponse.json({ error: "Failed to process jobs" }, { status: 500 });
  }
}