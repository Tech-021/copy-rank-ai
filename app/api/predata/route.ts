import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// GET /api/predata?email=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const emailRaw = url.searchParams.get("email");
    const email = emailRaw ? emailRaw.trim().toLowerCase() : null;
    if (!email) return NextResponse.json({ success: false, error: "missing email" }, { status: 400 });

    if (!supabaseAdmin) return NextResponse.json({ success: false, error: "no-db" }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from("pre_data")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, rows: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
