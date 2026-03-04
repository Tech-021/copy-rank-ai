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

    // If no user is specified, just return any global default JSON settings.
    if (!userId && !websiteId) {
      const { data, error } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ settings: data?.settings ?? null });
    }

    // 1) Load base JSON settings from user_settings
    let baseSettings: Record<string, any> = {};
    try {
      let q = supabase.from("user_settings").select("settings").limit(1);
      q =
        userId !== null
          ? (q as any).eq("user_id", userId)
          : (q as any).is("user_id", null);
      q =
        websiteId !== null
          ? (q as any).eq("website_id", websiteId)
          : (q as any).is("website_id", null);

      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (data?.settings && typeof data.settings === "object") {
        baseSettings = data.settings;
      }
    } catch (e) {
      console.warn("GET /api/user/settings: failed to load base settings", e);
    }

    // 2) Overlay WordPress + Framer credentials from their own tables (per-user)
    let wpSettings: any = null;
    let framerSettings: any = null;

    if (userId) {
      try {
        const [wpRes, frRes] = await Promise.all([
          supabase
            .from("wordpress_credentials")
            .select("rest_api_url, username, app_password")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("framer_credentials")
            .select("project_url, api_key, collection_id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!wpRes.error && wpRes.data) {
          wpSettings = wpRes.data;
        }
        if (!frRes.error && frRes.data) {
          framerSettings = frRes.data;
        }
      } catch (e) {
        console.warn(
          "GET /api/user/settings: failed to load integration credentials",
          e
        );
      }
    }

    const merged = {
      ...baseSettings,
      ...(wpSettings
        ? {
            wordpressSiteUrl: wpSettings.rest_api_url ?? "",
            wordpressUsername: wpSettings.username ?? "",
            wordpressAppPassword: wpSettings.app_password ?? "",
          }
        : {}),
      ...(framerSettings
        ? {
            framerProjectUrl: framerSettings.project_url ?? "",
            framerApiKey: framerSettings.api_key ?? "",
            framerCollectionId: framerSettings.collection_id ?? "",
          }
        : {}),
    };

    return NextResponse.json({ settings: merged });
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
    const rawSettings = body.settings ?? {};

    if (!rawSettings || typeof rawSettings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    // Split integration credentials out of the JSON blob so we can
    // store them in their own tables.
    const {
      wordpressSiteUrl,
      wordpressUsername,
      wordpressAppPassword,
      framerProjectUrl,
      framerApiKey,
      framerCollectionId,
      ...otherSettings
    } = rawSettings as Record<string, any>;

    // Merge non-integration settings with any existing JSON settings
    let existingSettings: Record<string, any> = {};
    try {
      let q = supabase.from("user_settings").select("settings").limit(1);
      q =
        userId !== null
          ? (q as any).eq("user_id", userId)
          : (q as any).is("user_id", null);
      q =
        websiteId !== null
          ? (q as any).eq("website_id", websiteId)
          : (q as any).is("website_id", null);
      const { data } = await q.maybeSingle();
      if (data?.settings && typeof data.settings === "object") {
        existingSettings = data.settings;
      }
    } catch {
      // ignore merge failures; we'll just treat as empty
    }

    const mergedSettings = { ...existingSettings, ...otherSettings };

    // Upsert based on user_id + website_id uniqueness
    const payload = {
      user_id: userId,
      website_id: websiteId,
      settings: mergedSettings,
    };

    let finalSettings: any = mergedSettings;

    // Try upsert first; if the DB doesn't have the required unique index Postgres
    // returns error 42P10. In that case fall back to manual insert/update.
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: ["user_id", "website_id"] })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data?.settings && typeof data.settings === "object") {
        finalSettings = data.settings;
      }
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
            .update({ settings: mergedSettings })
            .match({ user_id: userId, website_id: websiteId })
            .select()
            .maybeSingle();
          if (updErr) throw updErr;
          if (updated?.settings && typeof updated.settings === "object") {
            finalSettings = updated.settings;
          }
        } else {
          // insert new
          const { data: inserted, error: insErr } = await supabase
            .from("user_settings")
            .insert(payload)
            .select()
            .maybeSingle();
          if (insErr) throw insErr;
          if (inserted?.settings && typeof inserted.settings === "object") {
            finalSettings = inserted.settings;
          }
        }
      } else {
        // otherwise rethrow
        throw upsertErr;
      }
    }

    // 2) Upsert WordPress + Framer credentials into their own tables using user_id only
    try {
      const ops: Promise<any>[] = [];

      if (userId) {
        // WordPress creds
        if (
          wordpressSiteUrl !== undefined ||
          wordpressUsername !== undefined ||
          wordpressAppPassword !== undefined
        ) {
          ops.push(
            (async () => {
              const { data: existing } = await supabase
                .from("wordpress_credentials")
                .select("id")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const wpPayload = {
                user_id: userId,
                website_id: null,
                rest_api_url: wordpressSiteUrl ?? null,
                username: wordpressUsername ?? null,
                app_password: wordpressAppPassword ?? null,
              };

              if (existing?.id) {
                await supabase
                  .from("wordpress_credentials")
                  .update(wpPayload)
                  .eq("id", existing.id);
              } else {
                await supabase
                  .from("wordpress_credentials")
                  .insert(wpPayload);
              }
            })()
          );
        }

        // Framer creds
        if (
          framerProjectUrl !== undefined ||
          framerApiKey !== undefined ||
          framerCollectionId !== undefined
        ) {
          ops.push(
            (async () => {
              const { data: existing } = await supabase
                .from("framer_credentials")
                .select("id")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const frPayload = {
                user_id: userId,
                website_id: null,
                project_url: framerProjectUrl ?? null,
                api_key: framerApiKey ?? null,
                collection_id: framerCollectionId ?? null,
              };

              if (existing?.id) {
                await supabase
                  .from("framer_credentials")
                  .update(frPayload)
                  .eq("id", existing.id);
              } else {
                await supabase
                  .from("framer_credentials")
                  .insert(frPayload);
              }
            })()
          );
        }
      }

      if (ops.length > 0) {
        await Promise.allSettled(ops);
      }
    } catch (e) {
      console.warn(
        "PATCH /api/user/settings: failed to upsert integration credentials",
        e
      );
    }

    // 3) Return merged JSON settings plus the integration values we just saved
    const responseSettings = {
      ...finalSettings,
      ...(wordpressSiteUrl !== undefined ||
      wordpressUsername !== undefined ||
      wordpressAppPassword !== undefined
        ? {
            wordpressSiteUrl: wordpressSiteUrl ?? "",
            wordpressUsername: wordpressUsername ?? "",
            wordpressAppPassword: wordpressAppPassword ?? "",
          }
        : {}),
      ...(framerProjectUrl !== undefined ||
      framerApiKey !== undefined ||
      framerCollectionId !== undefined
        ? {
            framerProjectUrl: framerProjectUrl ?? "",
            framerApiKey: framerApiKey ?? "",
            framerCollectionId: framerCollectionId ?? "",
          }
        : {}),
    };

    return NextResponse.json({ success: true, settings: responseSettings });
  } catch (err: any) {
    console.error("PATCH /api/user/settings error", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export const runtime = "edge";
