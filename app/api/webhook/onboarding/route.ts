import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin =
  process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

export async function POST(req: Request) {
  const incomingSecret = req.headers.get("x-webhook-secret");
  if (!incomingSecret || incomingSecret !== process.env.WEBHOOK_SECRET) {
    console.warn("[webhook:onboarding] unauthorized request");
    return new NextResponse(
      JSON.stringify({ success: false, error: "unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const startMs = Date.now();
  console.info("[webhook:onboarding] handler start", new Date().toISOString());
  try {
    // Capture headers
    const headersObj: Record<string, string> = {};
    try {
      req.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    } catch (hErr) {
      console.warn("[webhook:onboarding] failed to read headers", String(hErr));
    }

    console.debug("[webhook:onboarding] request headers:", headersObj);
    const url = (req as any).url || headersObj.host || "unknown";
    console.info("[webhook:onboarding] request url:", url);

    // Read raw body (we log it, then parse)
    const rawText = await req.text();
    console.debug("[webhook:onboarding] raw body text:", rawText);

    let body: any = {};
    try {
      body = rawText ? JSON.parse(rawText) : {};
      console.debug("[webhook:onboarding] parsed JSON body:", body);
    } catch (parseErr) {
      console.error(
        "[webhook:onboarding] JSON parse error:",
        parseErr,
        "raw:",
        rawText
      );
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "invalid_json",
          detail: String(parseErr),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // normalize CSV/string/array inputs into a flat array of trimmed strings
    const normalizeToArray = (v: any): string[] => {
      if (v === null || v === undefined) return [];
      if (Array.isArray(v)) {
        return v
          .flatMap((item) =>
            typeof item === "string" ? item.split(",") : [String(item)]
          )
          .map((s) => String(s).trim())
          .filter(Boolean);
      }
      if (typeof v === "string") {
        return v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [String(v)].map((s) => s.trim()).filter(Boolean);
    };

    // Accept fields from iframe submission (support many keys)
    const email = body.email || body.userEmail || body.user_email || null;
    const website = body.website || body.clientDomain || null;
    const competitorsRaw =
      body.competitors || body.competitor || body.competitorDomains || [];
    const keywordsRaw =
      body.keywords || body.targetKeywords || body.keywords_list || [];

    const competitors = normalizeToArray(competitorsRaw);
    const keywords = normalizeToArray(keywordsRaw);

    console.info("[webhook:onboarding] extracted fields", {
      emailPresent: !!email,
      websitePresent: !!website,
      competitorsCount: competitors.length,
      keywordsCount: keywords.length,
    });

    if (!email || !website) {
      console.warn(
        "[webhook:onboarding] validation failed: missing email or website",
        { email, website }
      );
      return new NextResponse(
        JSON.stringify({ success: false, error: "missing email or website" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare row to insert
    const row = {
      email,
      website,
      competitors,
      keywords,
      payload: body,
    };

    console.debug("[webhook:onboarding] row prepared for insert:", row);

    if (!supabaseAdmin) {
      console.warn(
        "[webhook:onboarding] SUPABASE_SERVICE_ROLE_KEY not set — skipping DB write. To persist set SUPABASE_SERVICE_ROLE_KEY."
      );
      const elapsed = Date.now() - startMs;
      console.info(`[webhook:onboarding] handler end - no-db - ${elapsed}ms`);
      return new NextResponse(
        JSON.stringify({ success: true, received: row, note: "no-db" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.info(
      "[webhook:onboarding] inserting into pre_data (starting DB call)"
    );
    const dbStart = Date.now();
    const { data, error } = await supabaseAdmin
      .from("pre_data")
      .insert([row])
      .select()
      .limit(1);
    const dbElapsed = Date.now() - dbStart;
    console.info(`[webhook:onboarding] DB call completed in ${dbElapsed}ms`);

    if (error) {
      console.error("[webhook:onboarding] Failed to insert pre_data:", error);
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "db_insert_failed",
          detail: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.debug("[webhook:onboarding] DB returned:", data);
    const elapsed = Date.now() - startMs;
    console.info(`[webhook:onboarding] handler end - success - ${elapsed}ms`);
    return new NextResponse(
      JSON.stringify({ success: true, received: data?.[0] || row }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(
      "[webhook:onboarding] Webhook handler error:",
      err?.stack || err,
      { err }
    );
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "invalid JSON or server error",
        detail: String(err),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
