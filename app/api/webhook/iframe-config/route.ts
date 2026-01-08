import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Accept fields from iframe submission
    const email = body.email || body.userEmail || body.user_email || null;
    const website = body.website || body.clientDomain || null;
    const competitors = body.competitors || body.competitor || body.competitorDomains || [];
    const keywords = body.keywords || body.targetKeywords || body.keywords_list || [];

    if (!email || !website) {
      return new NextResponse(JSON.stringify({ success: false, error: "missing email or website" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Log for local testing
    console.log("Received webhook payload:", { email, website, competitors, keywords });

    // Prepare row to insert
    const row = {
      email,
      website,
      competitors: Array.isArray(competitors) ? competitors : [competitors].filter(Boolean),
      keywords: Array.isArray(keywords) ? keywords : [keywords].filter(Boolean),
      payload: body,
    };

    if (!supabaseAdmin) {
      console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping DB write. To persist set SUPABASE_SERVICE_ROLE_KEY.");
      return new NextResponse(JSON.stringify({ success: true, received: row, note: "no-db" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { data, error } = await supabaseAdmin.from("pre_data").insert([row]).select().limit(1);
    if (error) {
      console.error("Failed to insert pre_data:", error);
      return new NextResponse(JSON.stringify({ success: false, error: "db_insert_failed", detail: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new NextResponse(JSON.stringify({ success: true, received: data?.[0] || row }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return new NextResponse(JSON.stringify({ success: false, error: "invalid JSON or server error", detail: String(err) }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}