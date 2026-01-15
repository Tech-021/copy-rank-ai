import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin =
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

export async function POST(req: Request) {
  /* ----------------------------------------------------
     1️⃣ AUTH VIA QUERY PARAM (Framer-safe)
  ---------------------------------------------------- */
  const { searchParams } = new URL(req.url);
  const incomingSecret = searchParams.get("secret");

  if (!incomingSecret || incomingSecret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    /* ----------------------------------------------------
       2️⃣ READ BODY
    ---------------------------------------------------- */
    const rawText = await req.text();
    const body = rawText ? JSON.parse(rawText) : {};

    /* ----------------------------------------------------
       3️⃣ NORMALIZE FRAMER PAYLOAD
    ---------------------------------------------------- */
    const values = body.values || {};

    const email =
      body.email ||
      values.Email ||
      values.email ||
      null;

    const website =
      body.website ||
      values.Website ||
      values.website ||
      null;

    const normalizeToArray = (v: any): string[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map(String);
      return String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const competitors = normalizeToArray(
      body.competitors || values.Competitors
    );

    const keywords = normalizeToArray(
      body.keywords || values.Keywords
    );

    /* ----------------------------------------------------
       4️⃣ VALIDATION
    ---------------------------------------------------- */
    if (!email || !website) {
      return NextResponse.json(
        { success: false, error: "missing email or website" },
        { status: 400 }
      );
    }

    /* ----------------------------------------------------
       5️⃣ PREPARE DB ROW
    ---------------------------------------------------- */
    const row = {
      email,
      website,
      competitors,
      keywords,
      payload: body, // full raw payload for debugging
    };

    /* ----------------------------------------------------
       6️⃣ INSERT INTO SUPABASE
    ---------------------------------------------------- */
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: true, received: row, note: "db-disabled" },
        { status: 200 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("pre_data")
      .insert([row])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    /* ----------------------------------------------------
       7️⃣ SUCCESS RESPONSE
    ---------------------------------------------------- */
    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    );

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "server_error", detail: String(err) },
      { status: 500 }
    );
  }
}
