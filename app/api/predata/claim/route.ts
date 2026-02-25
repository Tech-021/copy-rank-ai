import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function getInternalBaseUrl(req: Request): string {
  try {
    const url = new URL(req.url);
    const proto =
      req.headers.get("x-forwarded-proto") ??
      url.protocol.replace(":", "") ??
      "https";
    const host =
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      url.host;

    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // fall through to env-based fallbacks
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  return "http://localhost:3000";
}

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

    const baseUrl = getInternalBaseUrl(req);

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

        let onboardingResult: any = { success: false, error: "onboarding_call_failed" };
        try {
          const onboardingResp = await fetch(`${baseUrl}/api/onboarding`, {
            method: "POST",
            headers: onboardingHeaders,
            body: JSON.stringify(onboardingPayload),
          });

          if (onboardingResp.ok) {
            onboardingResult = await onboardingResp.json().catch(() => ({
              success: false,
              error: "parse_error",
            }));
          }
        } catch (e) {
          onboardingResult = { success: false, error: String(e) };
        }

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
