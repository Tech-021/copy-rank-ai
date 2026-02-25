import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Test endpoint to verify webhook setup
export async function GET(req: Request) {
  try {
    const checks = {
      hasWebhookSecret: !!process.env.WEBHOOK_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
    };

    // Test database connection
    let dbTest = "not_configured";
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Test if pre_data table exists and is accessible
        const { data, error } = await supabaseAdmin
          .from("pre_data")
          .select("id")
          .limit(1);

        if (error) {
          dbTest = `error: ${error.message} (code: ${error.code})`;
        } else {
          dbTest = "connected";
        }
      } catch (err: any) {
        dbTest = `exception: ${err.message}`;
      }
    }

    return NextResponse.json({
      status: "ok",
      checks,
      dbTest,
      message: "Webhook test endpoint - check the values above",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        error: err.message,
      },
      { status: 500 }
    );
  }
}

// POST endpoint to test webhook payload processing
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("🧪 Test webhook payload received:", body);

    // Simulate the same parsing logic as the real webhook
    const formDataJson = body._form_data_json;
    let parsedFormJson: any = null;

    if (typeof formDataJson === "string") {
      parsedFormJson = JSON.parse(formDataJson);
    } else if (typeof formDataJson === "object" && formDataJson !== null) {
      parsedFormJson = formDataJson;
    }

    const finalBody = parsedFormJson ? { ...parsedFormJson, ...body } : body;
    const values = finalBody.values || finalBody.data?.values || {};

    const email = finalBody.email || values.Email || values.email || null;
    const website = finalBody.website || values.Website || values.website || null;

    return NextResponse.json({
      status: "ok",
      parsed: {
        email,
        website,
        values,
        formDataJsonType: typeof formDataJson,
        parsedFormJson: parsedFormJson ? "parsed" : "null",
      },
      originalBody: body,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        error: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}

