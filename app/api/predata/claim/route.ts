import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// POST /api/predata/claim
// body: { email?: string, ids?: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const ids: string[] | undefined = body.ids;

    if (!email && (!ids || ids.length === 0)) {
      return NextResponse.json({ success: false, error: "email or ids required" }, { status: 400 });
    }

    if (!supabaseAdmin) return NextResponse.json({ success: false, error: "no-db" }, { status: 500 });

    // Build update query
    let query = supabaseAdmin.from("pre_data").update({ processed: true, processed_at: new Date().toISOString() });
    if (ids && ids.length > 0) {
      query = query.in("id", ids).eq("processed", false);
    } else if (email) {
      query = query.eq("email", email).eq("processed", false);
    }

    const { data, error } = await query.select();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, claimed: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
