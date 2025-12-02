// app/api/lemonsqueezy/route.ts
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const lemonSqueezyApiKey = process.env.LEMONSQUEEZY_API_KEY!;
const lemonStoreId = process.env.LEMONSQUEEZY_STORE_ID!;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { variantId: requestedVariantId, userEmail, userName, userId } = body || {};

    // if present, use the variant passed in the request, otherwise fallback to env var
    const variantId = requestedVariantId || process.env.NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY;
    if (!variantId) {
      return NextResponse.json(
        { error: "Variant ID not configured or passed in request" },
        { status: 400 }
      );
    }

    // Validate user exists (optional): Use service role supabase client to look up user
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    if (userId || userEmail) {
      const query = userId ? { id: userId } : { email: userEmail };
      const { data: userRow, error: userError } = await supabase.from('users').select('id,email').match(query).maybeSingle();
      if (userError) {
        console.error('Supabase user lookup error:', userError);
        // Not a fatal error; don't block checkout creation but warn
      } else if (!userRow) {
        return NextResponse.json({ error: 'User not found' }, { status: 400 });
      }
    }

    console.log("Preparing LemonSqueezy checkout", { variantId, lemonStoreId, userEmail, userId });

    // Validate variant exists and belongs to this store to avoid 404 from LemonSqueezy
    try {
      const variantCheckRes = await fetch(`https://api.lemonsqueezy.com/v1/variants/${variantId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/vnd.api+json",
          "Accept": "application/vnd.api+json",
          "Authorization": `Bearer ${lemonSqueezyApiKey}`,
        },
      });

      if (!variantCheckRes.ok) {
        const text = await variantCheckRes.text();
        console.error("LemonSqueezy variant lookup failed:", { status: variantCheckRes.status, text });
        return NextResponse.json({ error: `Variant ${variantId} not found (store ${lemonStoreId}).` }, { status: 400 });
      }

      const variantData = await variantCheckRes.json();
      const variantStoreId = variantData?.data?.relationships?.store?.data?.id;

      if (variantStoreId && String(variantStoreId) !== String(lemonStoreId)) {
        console.error("Variant belongs to a different store", { variantStoreId, lemonStoreId });
        return NextResponse.json({ error: `Variant ${variantId} does not belong to the configured store ${lemonStoreId}.` }, { status: 400 });
      }
    } catch (err) {
      console.error("Variant lookup error", err);
      // Check for a public static checkout URL fallback for the selected variant
      const checkoutUrl15 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15;
      const checkoutUrl30 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30;
      const proVariant = process.env.NEXT_PUBLIC_LEMON_VARIANT_PRO || '1087280';
      const premVariant = process.env.NEXT_PUBLIC_LEMON_VARIANT_PREMIUM || '1087281';
      const silverVariant = process.env.NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY || process.env.NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY;

      // Try to map variant to a static url if provided
      const variantStr = String(variantId);
      let fallbackUrl: string | undefined;
      if (variantStr === String(proVariant) && checkoutUrl15) fallbackUrl = checkoutUrl15;
      if (variantStr === String(premVariant) && checkoutUrl30) fallbackUrl = checkoutUrl30;
      if (variantStr === String(silverVariant) && checkoutUrl15) fallbackUrl = checkoutUrl15;

      if (fallbackUrl) {
        console.warn('Variant lookup failed - returning static checkout fallback url', { fallbackUrl, variantId });
        return NextResponse.json({ checkoutUrl: fallbackUrl });
      }

      return NextResponse.json({ error: 'Failed to verify variant existence' }, { status: 500 });
    }

    // Build checkout payload
    const checkoutData: any = {
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            enabled_variants: [parseInt(String(variantId))],
            redirect_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`,
            receipt_button_text: "Go to Dashboard",
            receipt_thank_you_note: "Thank you for your purchase!"
          },
          checkout_options: {
            embed: false,
            media: false,
            button_color: "#2563eb"
          },
          checkout_data: {
            email: userEmail || undefined,
            name: userName || undefined,
            custom: {
              user_id: userId || undefined,
              user_email: userEmail || undefined
            }
          },
          preview: false,
          test_mode: process.env.NODE_ENV === "development"
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: lemonStoreId
            }
          }
        }
      }
    };

    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
        "Authorization": `Bearer ${lemonSqueezyApiKey}`,
      },
      body: JSON.stringify(checkoutData),
    });

    console.log("LemonSqueezy response status:", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LemonSqueezy API error:", errorText);
      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.data?.attributes?.url) {
      return NextResponse.json(
        { error: "Invalid response from LemonSqueezy" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      checkoutUrl: data.data.attributes.url
    });

  } catch (error) {
    console.error("Checkout creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}