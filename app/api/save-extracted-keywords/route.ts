import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables for save-extracted-keywords API route");
}

// Service-role client for safe server-side writes
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface IncomingKeyword {
  keyword: string;
  frequency?: number;
}

interface SaveKeywordsBody {
  keywords: IncomingKeyword[];
  websiteId?: string;
}

export async function POST(request: Request) {
  try {
    // Authentication using user token so we know which user's website to update
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user || !user.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: SaveKeywordsBody = await request.json().catch(() => ({ keywords: [] }));

    if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: "No keywords provided" },
        { status: 400 }
      );
    }

    // Identify which website to attach these keywords to
    let targetWebsiteId = body.websiteId || null;

    if (!targetWebsiteId) {
      const { data: websiteRow, error: websiteErr } = await supabaseAdmin
        .from("websites")
        .select("id, keywords")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (websiteErr) {
        console.error("save-extracted-keywords: Failed to fetch website:", websiteErr);
        return NextResponse.json(
          { success: false, error: "Failed to find website for user" },
          { status: 500 }
        );
      }

      if (!websiteRow?.id) {
        return NextResponse.json(
          { success: false, error: "No website found for user" },
          { status: 404 }
        );
      }

      targetWebsiteId = websiteRow.id;
    }

    // Fetch full keywords payload for the target website
    const { data: siteData, error: siteErr } = await supabaseAdmin
      .from("websites")
      .select("id, keywords")
      .eq("id", targetWebsiteId)
      .single();

    if (siteErr) {
      console.error("save-extracted-keywords: Failed to fetch target website:", siteErr);
      return NextResponse.json(
        { success: false, error: "Failed to load website for saving keywords" },
        { status: 500 }
      );
    }

    const existingPayload = (siteData as any)?.keywords || {};
    const existingList: any[] = Array.isArray(existingPayload?.keywords)
      ? existingPayload.keywords
      : [];

    // Merge & dedupe by keyword text (case-insensitive)
    const map = new Map<string, any>();

    // Add existing keywords first
    existingList.forEach((k) => {
      const key = String(k?.keyword || k || "").toLowerCase();
      if (!key) return;
      map.set(key, k);
    });

    // Add/update with new scraped keywords
    body.keywords.forEach((kw) => {
      const rawText = kw?.keyword;
      if (!rawText) return;
      const key = String(rawText).toLowerCase();
      if (!key) return;

      const existing = map.get(key) || {};

      map.set(key, {
        ...existing,
        keyword: rawText,
        // Preserve any richer metrics already stored; otherwise fall back to frequency-based data
        frequency: kw.frequency ?? existing.frequency ?? 1,
        is_target_keyword: existing.is_target_keyword ?? true,
        post_status: existing.post_status || "No Plan",
      });
    });

    const mergedList = Array.from(map.values());

    const newPayload = {
      ...existingPayload,
      keywords: mergedList,
      analysis_metadata: {
        ...existingPayload.analysis_metadata,
        total_keywords: mergedList.length,
        analyzed_at: new Date().toISOString(),
      },
    };

    const { error: updateErr } = await supabaseAdmin
      .from("websites")
      .update({ keywords: newPayload })
      .eq("id", targetWebsiteId);

    if (updateErr) {
      console.error("save-extracted-keywords: Failed to update website keywords:", updateErr);
      return NextResponse.json(
        { success: false, error: "Failed to save keywords to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      websiteId: targetWebsiteId,
      total_keywords: mergedList.length,
      added_keywords: body.keywords.length,
    });
  } catch (error) {
    console.error("save-extracted-keywords:Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected error while saving keywords",
      },
      { status: 500 }
    );
  }
}

