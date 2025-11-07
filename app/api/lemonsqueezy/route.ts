// app/api/lemonsqueezy/route.ts
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const lemonSqueezyApiKey = process.env.LEMONSQUEEZY_API_KEY!;
const lemonStoreId = process.env.LEMONSQUEEZY_STORE_ID!;

export async function POST(req: Request) {
  try {
    const { userEmail, userName, userId } = await req.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    // Use your main Viral SEO variant ID for the trial
    const variantId = process.env.NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY!;

    if (!variantId) {
      return NextResponse.json(
        { error: "Variant ID not configured" },
        { status: 500 }
      );
    }

    const checkoutData = {
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            enabled_variants: [parseInt(variantId)],
            redirect_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`,
            receipt_button_text: "Go to Dashboard",
            receipt_thank_you_note: "Thank you for starting your free trial! You now have full access to Viral SEO for 3 days."
          },
          checkout_options: {
            embed: false,
            media: false,
            button_color: "#2563eb"
          },
          checkout_data: {
            email: userEmail,
            name: userName,
            custom: {
              user_id: userId,
              user_email: userEmail,
              trial_days: "3"
            }
          },
          preview: false,
          test_mode: process.env.NODE_ENV === "development" || true
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: lemonStoreId
            }
          },
          variant: {
            data: {
              type: "variants",
              id: variantId
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