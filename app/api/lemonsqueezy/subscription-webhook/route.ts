import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { log } from "console";

export const dynamic = "force-dynamic";

const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!webhookSecret) throw new Error("MISSING LEMONSQUEEZY_WEBHOOK_SECRET!");
if (!supabaseUrl) throw new Error("MISSING NEXT_PUBLIC_SUPABASE_URL!");
if (!supabaseServiceRoleKey)
  throw new Error("MISSING SUPABASE_SERVICE_ROLE_KEY!");

function verifySignature(rawBody: string, signature: string, secret: string) {
  const hmac = createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
  const signatureBuf = Buffer.from(signature || '', 'utf8');
  return timingSafeEqual((digest as any), (signatureBuf as any));
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("X-Signature");
  
  if (!sig || !verifySignature(rawBody, sig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const type = event.meta?.event_name;

  console.log("Received LemonSqueezy webhook event:", type);
  console.log("Event data:", event);

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  console.log("Supabase client initialized for webhook processing.");
  // Handle subscription created
  if (type === "subscription_created") {
    const sub = event.data?.attributes;
    const customData = event.meta?.custom_data || {};
    console.log("Custom data received:", customData);
    const userId = customData.user_id;
    const userEmail = sub.user_email;
    console.log("User ID:", userId, "User Email:", userEmail);
    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "Missing user reference (user_id/email)" },
        { status: 400 }
      );
    }

    // Update subscribe status to true (try by user_id first, then by email)
    const { error } = await supabase
      .from("users")
      .update({ subscribe: true })
      .eq(userId ? "id" : "email", userId || userEmail);

    if (error) {
      console.log("Error updating subscription status:", error);
      return NextResponse.json(
        { error: "Error updating subscription status" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "subscription_created processed" },
      { status: 200 }
    );
  }

  // Handle subscription cancelled/expired
  if (type === "subscription_cancelled" || type === "subscription_expired") {
    const sub = event.data?.attributes;
    const customData = event.meta?.custom_data || {};

    const userId = customData.user_id;
    const userEmail = sub.user_email;

    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "Missing user reference (user_id/email)" },
        { status: 400 }
      );
    }

    // Update subscribe status to false
    const { error } = await supabase
      .from("users")
      .update({ subscribe: false })
      .eq(userId ? "id" : "email", userId || userEmail);

    if (error) {
      console.log("Error updating subscription status:", error);
      return NextResponse.json(
        { error: "Error updating subscription status" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: `${type} processed` },
      { status: 200 }
    );
  }

  return NextResponse.json({ message: `Unhandled event ${type}` }, { status: 200 });
}