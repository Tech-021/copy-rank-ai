import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 60; // Vercel Pro plan limit

// Process function (shared between GET and POST)
async function processJobs() {
  try {
    // Process only 1 job at a time to stay under timeout limit
    const maxJobs = 1;

    console.log(`🔄 Processing up to ${maxJobs} article job...`);

    // Fetch one pending job
    const { data: jobs, error: fetchError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
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
        processed: 0
      });
    }

    const job = jobs[0];
    console.log(`📋 Found job ${job.id} - Article ${job.article_number}/${job.total_articles}`);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    try {
      // Mark job as processing
      await supabase
        .from('article_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', job.id);

      console.log(`📄 Processing job ${job.id} - Article ${job.article_number}/${job.total_articles}`);

      // Trigger article generation asynchronously (fire and forget)
      // This prevents timeout - the article generation will update job status when done
      fetch(`${baseUrl}/api/test-generate-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: job.keywords,
          userId: job.user_id,
          websiteId: job.website_id,
          articleNumber: job.article_number,
          totalArticles: job.total_articles,
          targetWordCount: 2000,
          jobId: job.id // Pass job ID so article generation can update status
        }),
      }).catch(error => {
        console.error(`❌ Error triggering article generation for job ${job.id}:`, error);
        // Mark job as failed if we can't even trigger it
        supabase
          .from('article_jobs')
          .update({
            status: 'failed',
            error_message: `Failed to trigger: ${error instanceof Error ? error.message : 'Unknown error'}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      });

      // Return immediately - don't wait for article generation
      // The article generation endpoint will update job status when complete
      console.log(`✅ Triggered article generation for job ${job.id}`);
      return NextResponse.json({
        success: true,
        message: `Triggered article generation for job ${job.id}`,
        processed: 1,
        jobId: job.id
      });

    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);
      
      // Mark job as failed
      await supabase
        .from('article_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json({
        success: false,
        error: "Failed to process job",
        details: error instanceof Error ? error.message : 'Unknown error',
        jobId: job.id
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error processing jobs:", error);
    return NextResponse.json(
      { error: "Failed to process jobs", details: error instanceof Error ? error.message : 'Unknown error' },
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

