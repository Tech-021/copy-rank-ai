import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

const supabaseAdmin =
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

function isWebhookSignatureValid(
  secret: string,
  submissionId: string,
  payloadBuffer: Buffer,
  signature: string
): boolean {
  if (signature.length !== 71 || !signature.startsWith("sha256=")) {
    return false;
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(payloadBuffer);
  hmac.update(submissionId);

  const expectedSignature = "sha256=" + hmac.digest("hex");
  
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    /* ----------------------------------------------------
       1️⃣ READ BODY FIRST (needed for signature verification)
    ---------------------------------------------------- */
    const rawText = await req.text();
    const payloadBuffer = Buffer.from(rawText, "utf-8");

    /* ----------------------------------------------------
       2️⃣ VERIFY FRAMER SIGNATURE (required)
    ---------------------------------------------------- */
    const signature = req.headers.get("framer-signature");
    const submissionId = req.headers.get("framer-webhook-submission-id");
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!signature || !submissionId) {
      return NextResponse.json(
        { success: false, error: "Missing Framer signature headers" },
        { status: 401 }
      );
    }

    if (!isWebhookSignatureValid(webhookSecret, submissionId, payloadBuffer, signature)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    /* ----------------------------------------------------
       3️⃣ PARSE PAYLOAD
    ---------------------------------------------------- */
    // Framer sometimes sends the payload under `_form_data_json` as a string.
    // Normalize so we always work with a plain object that has `values`.
    const baseBody = rawText ? JSON.parse(rawText) : {};
    const formDataJson = baseBody._form_data_json;
    const parsedFormJson =
      typeof formDataJson === "string"
        ? JSON.parse(formDataJson)
        : typeof formDataJson === "object" && formDataJson !== null
          ? formDataJson
          : null;

    const body = parsedFormJson ? { ...parsedFormJson, ...baseBody } : baseBody;

    /* ----------------------------------------------------
       4️⃣ NORMALIZE FRAMER PAYLOAD
    ---------------------------------------------------- */
    const values = body.values || body.data?.values || {};

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
       5️⃣ VALIDATION
    ---------------------------------------------------- */
    if (!email || !website) {
      return NextResponse.json(
        { success: false, error: "missing email or website" },
        { status: 400 }
      );
    }

    /* ----------------------------------------------------
       6️⃣ PREPARE DB ROW
    ---------------------------------------------------- */
    const row = {
      email,
      website,
      competitors,
      keywords,
      payload: body, // full raw payload for debugging
    };

    /* ----------------------------------------------------
       7️⃣ INSERT INTO SUPABASE
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
       8️⃣ SUCCESS RESPONSE
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
