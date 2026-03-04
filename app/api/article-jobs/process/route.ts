import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 300; // Vercel Pro plan limit (max 300s)

// Process function (shared between GET and POST)
async function processJobs() {
  try {
    // Process only 1 job at a time to stay under timeout limit
    const maxJobs = 1;

    console.log(`🔄 Processing up to ${maxJobs} article job...`);

    // First, check for stuck jobs (processing for more than 2 minutes) and reset them
    // This handles edge cases where a job might have been left in processing state
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await supabase
      .from("article_jobs")
      .select("id")
      .eq("status", "processing")
      .lt("started_at", twoMinutesAgo);

    if (stuckJobs && stuckJobs.length > 0) {
      console.log(
        `⚠️ Found ${stuckJobs.length} stuck jobs, resetting to pending...`
      );
      await supabase
        .from("article_jobs")
        .update({
          status: "pending",
          started_at: null,
          error_message: "Job was stuck in processing, reset to pending",
        })
        .in(
          "id",
          stuckJobs.map((j) => j.id)
        );
    }

    // Fetch one pending job
    const { data: jobs, error: fetchError } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(maxJobs);

    if (fetchError) {
      console.error("Error fetching jobs:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch jobs", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending jobs found",
        processed: 0,
      });
    }

    const job = jobs[0];
    console.log(
      `📋 Found job ${job.id} - Article ${job.article_number}/${job.total_articles}`
    );

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    try {
      // Mark job as processing
      await supabase
        .from("article_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      console.log(
        `📄 Processing job ${job.id} - Article ${job.article_number}/${job.total_articles}`
      );

      // Create a timeout promise (59 seconds max)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Article generation timeout after 59 seconds"));
        }, 180000);
      });

      // Calculate image generation settings from job data (default to true if not specified)
      const generateImagesFlag =
        typeof job.generate_images !== "undefined"
          ? !!job.generate_images
          : true;
      const imageCount =
        typeof job.image_count !== "undefined" &&
        Number.isFinite(job.image_count)
          ? Number(job.image_count)
          : 2;

      console.log(`🖼️ Job ${job.id} - Image generation settings:`, {
        generateImages: generateImagesFlag,
        imageCount: imageCount,
        jobGenerateImages: job.generate_images,
        jobImageCount: job.image_count,
      });

      // Create the request body with calculated values
      const requestBody = {
        keywords: job.keywords,
        userId: job.user_id,
        websiteId: job.website_id,
        articleNumber: job.article_number,
        totalArticles: job.total_articles,
        targetWordCount: 2000,
        jobId: job.id,
        generateImages: generateImagesFlag, // Use calculated value from job
        imageCount: imageCount, // Use calculated value from job
      };

      console.log(
        "DEBUG: calling /api/test-generate-article with payload:",
        JSON.stringify(requestBody)
      );

      console.log(
        "🔍 Job Processor - RAW request body being sent:",
        JSON.stringify(requestBody, null, 2)
      );

      // Then make the API call
      const articleGenerationPromise = fetch(
        `${baseUrl}/api/test-generate-article`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.ARTICLE_PROCESS_SECRET
              ? { "x-internal-api-key": process.env.ARTICLE_PROCESS_SECRET }
              : {}),
          },
          body: JSON.stringify(requestBody),
        }
      );

      // Race between article generation and timeout
      let response: Response;
      try {
        response = await Promise.race([
          articleGenerationPromise,
          timeoutPromise,
        ]);
      } catch (timeoutError) {
        // Timeout occurred
        throw new Error("Article generation timeout after 59 seconds");
      }

      console.log(
        "DEBUG: /api/test-generate-article response status:",
        response.status
      );

      // ADD DEBUGGING HERE
      console.log(`📨 Job ${job.id} - API Response status:`, response.status);
      console.log(`📨 Job ${job.id} - API Response ok:`, response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log(`📨 Job ${job.id} - API Error data:`, errorData);
        throw new Error(
          `Article generation failed: ${response.status} - ${JSON.stringify(
            errorData
          )}`
        );
      }

      const result = await response.json();
      console.log("DEBUG: /api/test-generate-article parsed result:", result);
      console.log(`📨 Job ${job.id} - API Success result:`, {
        success: result.success,
        images: result.images,
        articleWordCount: result.article?.wordCount,
        generatedImages: result.article?.generatedImages?.length || 0,
      });

      if (result.success) {
        // Mark job as completed
        await supabase
          .from("article_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        console.log(
          `✅ Completed job ${job.id} - Article ${job.article_number}/${job.total_articles}`
        );
        return NextResponse.json({
          success: true,
          message: `Successfully processed job ${job.id}`,
          processed: 1,
          jobId: job.id,
        });
      } else {
        throw new Error(result.error || "Article generation failed");
      }
    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);

      // Mark job as failed
      await supabase
        .from("article_jobs")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      // Return success even if this job failed - we'll process the next one on next cron run
      return NextResponse.json({
        success: true,
        message: `Job ${job.id} failed, will retry next pending job`,
        processed: 1,
        jobId: job.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Error processing jobs:", error);
    return NextResponse.json(
      {
        error: "Failed to process jobs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET handler for Vercel cron jobs (cron sends GET requests)
export async function GET(request: Request) {
  return processJobs();
}

// POST handler for manual triggering
export async function POST(request: Request) {
  return processJobs();
}
