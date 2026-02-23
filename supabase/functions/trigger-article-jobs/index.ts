// Import necessary modules
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Define environment variable access for Deno
const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
};

const supabaseAdmin = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async () => {
  let job; // Define job outside the try block
  try {
    // Fetch one pending job
    const { data: jobs, error: fetchError } = await supabaseAdmin
      .from("article_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error("Error fetching jobs:", fetchError);
      return new Response("Failed to fetch jobs", { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      console.log("No pending jobs found");
      return new Response("No pending jobs found", { status: 200 });
    }

    job = jobs[0]; // Assign the fetched job

    // Mark job as processing
    await supabaseAdmin
      .from("article_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    console.log(`Processing job ${job.id} for user ${job.user_id}`);

    // Generate the article (call your article generation logic here)
    const article = {
      userId: job.user_id,
      content: `Generated article for user ${job.user_id}`,
      createdAt: new Date().toISOString(),
    };

    // Save the article to the database
    const { error: insertError } = await supabaseAdmin
      .from("articles")
      .insert(article);

    if (insertError) {
      throw new Error(`Failed to save article: ${insertError.message}`);
    }

    // Mark job as completed
    await supabaseAdmin
      .from("article_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    console.log(`Job ${job.id} completed successfully`);
    return new Response("Job processed successfully", { status: 200 });
  } catch (error) {
    console.error("Error processing job:", error);

    // Mark job as failed if it was fetched
    if (job) {
      await supabaseAdmin
        .from("article_jobs")
        .update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return new Response("Failed to process job", { status: 500 });
  }
});