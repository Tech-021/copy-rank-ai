import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use a server-side Supabase client with the service role key for API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("Supabase server env missing for user settings route");
}
const supabase = createClient(supabaseUrl || "", supabaseServiceRoleKey || "");

// GET /api/user/settings?userId=...&websiteId=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const websiteId = searchParams.get("websiteId");

    if (!userId && !websiteId) {
      // return a global default (if any)
      const { data } = await supabase.from("user_settings").select("settings").eq("user_id", null).limit(1).maybeSingle();
      return NextResponse.json({ settings: data?.settings ?? null });
    }

    // attempt to fetch by user+website if provided
    const query = supabase.from("user_settings").select("*");
    if (userId) query.eq("user_id", userId);
    if (websiteId) query.eq("website_id", websiteId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data?.settings ?? null });
  } catch (err: any) {
    console.error("GET /api/user/settings error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

// PATCH /api/user/settings
// body: { userId?: string|null, websiteId?: string|null, settings: object }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId ?? null;
    const websiteId = body.websiteId ?? null;
    const settings = body.settings ?? {};

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    // Upsert based on user_id + website_id uniqueness
    const payload = {
      user_id: userId,
      website_id: websiteId,
      settings,
    };

    // Try upsert first; if the DB doesn't have the required unique index Postgres
    // returns error 42P10. In that case fall back to manual insert/update.
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: ["user_id", "website_id"] })
        .select()
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ success: true, settings: data?.settings ?? settings });
    } catch (upsertErr: any) {
      // if missing unique constraint, fallback to select -> update/insert
      if (String(upsertErr?.code) === "42P10" || /no unique or exclusion constraint/i.test(String(upsertErr?.message))) {
        // build a selector that correctly handles nulls
        let q = supabase.from("user_settings").select("*").limit(1);
        q = userId !== null ? (q as any).eq("user_id", userId) : (q as any).is("user_id", null);
        q = websiteId !== null ? (q as any).eq("website_id", websiteId) : (q as any).is("website_id", null);
        const { data: existing, error: selErr } = await q.maybeSingle();
        if (selErr) throw selErr;

        if (existing) {
          const { data: updated, error: updErr } = await supabase
            .from("user_settings")
            .update({ settings })
            .match({ user_id: userId, website_id: websiteId })
            .select()
            .maybeSingle();
          if (updErr) throw updErr;
          return NextResponse.json({ success: true, settings: updated?.settings ?? settings });
        }

        // insert new
        const { data: inserted, error: insErr } = await supabase
          .from("user_settings")
          .insert(payload)
          .select()
          .maybeSingle();
        if (insErr) throw insErr;
        return NextResponse.json({ success: true, settings: inserted?.settings ?? settings });
      }

      // otherwise rethrow
      throw upsertErr;
    }
  } catch (err: any) {
    console.error("PATCH /api/user/settings error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export const runtime = "edge";
