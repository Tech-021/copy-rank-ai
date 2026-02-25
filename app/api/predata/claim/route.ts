import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// POST /api/predata/claim
// body: { email?: string, ids?: string[], userId: string }
export async function POST(req: Request) {
  try {
    // Get authentication token to pass to onboarding API
    const authHeader = req.headers.get('authorization');

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const ids: string[] | undefined = body.ids;
    const userId = body.userId as string | undefined;

    if (!email && (!ids || ids.length === 0)) {
      return NextResponse.json({ success: false, error: "email or ids required" }, { status: 400 });
    }

    if (!supabaseAdmin) return NextResponse.json({ success: false, error: "no-db" }, { status: 500 });

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/8d9350cf-ecef-4c96-9482-a2a235a433e1',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        id:`log_${Date.now()}_predata_claim_start`,
        runId:'onboarding-debug',
        hypothesisId:'H2',
        location:'api/predata/claim/route.ts:start',
        message:'predata/claim POST received',
        data:{ hasEmail: !!email, hasIds: !!(ids && ids.length), hasUserId: !!userId },
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion agent log

    // Fetch rows to claim
    let query = supabaseAdmin.from("pre_data").select("*").eq("processed", false);
    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    } else if (email) {
      query = query.eq("email", email);
    }

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    if (!rows || rows.length === 0) return NextResponse.json({ success: true, claimed: [], message: "no_rows_to_claim" });

    const results: any[] = [];

    // For each row, call onboarding and mark processed
    for (const row of rows) {
      try {
        const onboardingPayload = {
          clientDomain: row.website,
          competitors: row.competitors || [],
          targetKeywords: row.keywords || [],
          userId: userId || null,
        };

        // Call onboarding endpoint with authentication
        const onboardingHeaders: Record<string, string> = {
          "Content-Type": "application/json"
        };

        if (authHeader) {
          onboardingHeaders['Authorization'] = authHeader;
        }

        const onboardingResp: any = await fetch(`${BASE_URL}/api/onboarding`, {
          method: "POST",
          headers: onboardingHeaders,
          body: JSON.stringify(onboardingPayload),
        }).catch(e => ({ ok: false, error: String(e) }));

        const onboardingResult = onboardingResp.ok
          ? await onboardingResp.json().catch(() => ({ success: false, error: "parse_error" }))
          : { success: false, error: "onboarding_call_failed" };

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/8d9350cf-ecef-4c96-9482-a2a235a433e1',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            id:`log_${Date.now()}_predata_claim_onboarding`,
            runId:'onboarding-debug',
            hypothesisId:'H3',
            location:'api/predata/claim/route.ts:onboarding',
            message:'Onboarding call finished for pre_data row',
            data:{ website: row.website, ok: onboardingResp.ok, onboardingSuccess: onboardingResult.success },
            timestamp:Date.now()
          })
        }).catch(()=>{});
        // #endregion agent log

        // Mark row as processed
        await supabaseAdmin
          .from("pre_data")
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            processed_result: onboardingResult,
          })
          .eq("id", row.id);

        results.push({ id: row.id, website: row.website, onboarding_ok: onboardingResult.success });
      } catch (innerErr) {
        results.push({ id: row.id, error: String(innerErr) });
      }
    }

    return NextResponse.json({ success: true, claimed: rows, processing_results: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
