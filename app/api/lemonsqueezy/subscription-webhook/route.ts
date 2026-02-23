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
  
  // Helper function to determine package from variant ID
  function determinePackage(event: any): 'free' | 'pro' | 'premium' {
    const variantId = event.data?.relationships?.variant?.data?.id;
    
    // Check variant ID
    if (variantId) {
      const variantIdStr = variantId.toString();
      const proVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_PRO || '1087280';
      const premVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_PREMIUM || '1087281';
      // 15 articles tier = pro
      if (variantIdStr === String(proVar)) {
        return 'pro';
      }
      // 30 articles tier = premium
      if (variantIdStr === String(premVar)) {
        return 'premium';
      }
    }
    
    // Fallback: Check by price/amount (in cents)
    const sub = event.data?.attributes;
    const unitPrice = sub?.unit_price;
    if (unitPrice) {
      // $58 = 5800 cents (pro)
      if (unitPrice === 5800 || unitPrice === 58) {
        return 'pro';
      }
      // $78 = 7800 cents (premium)
      if (unitPrice === 7800 || unitPrice === 78) {
        return 'premium';
      }
    }
    
    // Default to free if we can't determine
    console.warn("Could not determine package type, defaulting to 'free'");
    return 'free';
  }

  // Handle subscription created (trial start - $1 charge)
  // This happens when the subscription is first created
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

    // Trial start: set subscribe to true and package to free — use upsert so the users row is created if missing
    const payloadCreated = userId
      ? { id: userId, ...(userEmail ? { email: userEmail } : {}), subscribe: true, package: 'free' }
      : { email: userEmail, subscribe: true, package: 'free' };

    const { error } = await supabase
      .from("users")
      .upsert(payloadCreated, { onConflict: userId ? 'id' : 'email', returning: 'minimal' });

    if (error) {
      console.log("Error upserting subscription status:", error);
      return NextResponse.json(
        { error: "Error updating subscription status" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "subscription_created processed", package: 'free' },
      { status: 200 }
    );
  }

  // Handle subscription payment success
  // This fires for both the $1 trial payment AND the $58/$75 renewal payment
  if (type === "subscription_payment_success") {
    const sub = event.data?.attributes;
    const customData = event.meta?.custom_data || {};
    console.log("Payment received - Event type:", type);
    console.log("Payment received - Custom data:", customData);
    const userId = customData.user_id;
    const userEmail = sub.user_email;
    console.log("User ID:", userId, "User Email:", userEmail);
    
    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "Missing user reference (user_id/email)" },
        { status: 400 }
      );
    }

    // Check payment amount to determine if it's trial ($1) or renewal ($58/$75)
    const invoice = event.data?.attributes;
    const total = invoice?.total || invoice?.subtotal || 0;
    const totalInCents = total; // LemonSqueezy sends amounts in cents
    
    console.log("Payment total:", totalInCents);

    // If it's $1 (100 cents) - this is the trial payment, package should already be 'free'
    // We don't need to update anything for the trial payment
    if (totalInCents === 100 || totalInCents === 1) {
      console.log("Trial payment ($1) received - no package update needed");
      return NextResponse.json(
        { message: "subscription_payment_success processed (trial payment)", package: 'free' },
        { status: 200 }
      );
    }

    // If it's $58 or $78 - this is the renewal payment after 3 days
    // Determine package type based on variant ID
    const packageType = determinePackage(event);
    console.log("Renewal payment received - Determined package type:", packageType);

    // Upsert package + ensure subscribe = true so the row is created if missing
    const payloadPayment = userId
      ? { id: userId, ...(userEmail ? { email: userEmail } : {}), package: packageType, subscribe: true }
      : { email: userEmail, package: packageType, subscribe: true };

    const { error } = await supabase
      .from("users")
      .upsert(payloadPayment, { onConflict: userId ? 'id' : 'email', returning: 'minimal' });

    if (error) {
      console.log("Error upserting package:", error);
      return NextResponse.json(
        { error: "Error updating package" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "subscription_payment_success processed (renewal)", package: packageType },
      { status: 200 }
    );
  }

  // Handle subscription updated (optional - fires after payment_success)
  // This is a catch-all event that fires after most subscription changes
  if (type === "subscription_updated") {
    // We can optionally handle this, but subscription_payment_success should be enough
    // This event fires after payment_success, so package should already be updated
    console.log("Subscription updated event received");
    return NextResponse.json(
      { message: "subscription_updated processed" },
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

    // Upsert to ensure the users row exists, then mark subscribe = false and reset package
    const payloadCancel = userId
      ? { id: userId, ...(userEmail ? { email: userEmail } : {}), subscribe: false, package: 'free' }
      : { email: userEmail, subscribe: false, package: 'free' };

    const { error } = await supabase
      .from("users")
      .upsert(payloadCancel, { onConflict: userId ? 'id' : 'email', returning: 'minimal' });

    if (error) {
      console.log("Error upserting subscription cancellation:", error);
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