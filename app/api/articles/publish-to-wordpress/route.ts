import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase admin client – used only to read articles table
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getWpBaseUrl() {
  const base = process.env.WP_API_URL;
  if (!base) {
    throw new Error("WP_API_URL is not configured");
  }
  return base.replace(/\/$/, "");
}

function getWpAuthHeader() {
  const username = process.env.WP_API_USER;
  const password = process.env.WP_API_APP_PASSWORD;

  if (!username || !password) {
    throw new Error("WP_API_USER or WP_API_APP_PASSWORD is not configured");
  }

  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

export async function POST(request: Request) {
  try {
    // 1) Auth: verify Supabase user from Bearer token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    // 2) Read JSON body
    const body = await request.json();
    const { articleId } = body as { articleId?: string };

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // 3) Load article from Supabase and ensure it belongs to the current user
    const { data: article, error: articleError } = await supabaseAdmin
      .from("articles")
      .select(
        "id, user_id, title, content, meta_title, meta_description, preview"
      )
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    if (article.user_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this article" },
        { status: 403 }
      );
    }

    // 4) Prepare and send WordPress request
    const wpBase = getWpBaseUrl();
    const wpAuth = getWpAuthHeader();

    const wpResponse = await fetch(`${wpBase}/posts`, {
      method: "POST",
      headers: {
        Authorization: wpAuth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: article.meta_title || article.title || "Untitled article",
        content:
          article.content ||
          `<p>${article.preview || "Content not available."}</p>`,
        status: "draft", // keep as draft in WordPress; publishing is a separate flow
      }),
    });

    const wpBodyText = await wpResponse.text();
    let wpJson: any = null;

    try {
      wpJson = JSON.parse(wpBodyText);
    } catch {
      // if body is not JSON, keep raw text
    }

    if (!wpResponse.ok) {
      return NextResponse.json(
        {
          error: "Failed to publish to WordPress",
          details: wpJson || wpBodyText,
        },
        { status: 502 }
      );
    }

    // 5) Return WordPress info (no status changes / no IndexNow)
    return NextResponse.json({
      success: true,
      wpPostId: wpJson?.id,
      wpLink: wpJson?.link,
      wpRaw: wpJson || wpBodyText,
    });
  } catch (error) {
    console.error("Error publishing article to WordPress:", error);
    return NextResponse.json(
      {
        error: "Unexpected error while publishing to WordPress",
      },
      { status: 500 }
    );
  }
}

