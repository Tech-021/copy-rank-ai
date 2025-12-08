import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildArticleUrl(baseSiteUrl: string, slug: string): string {
  const normalizedBase = baseSiteUrl.replace(/\/$/, "");
  const basePath = process.env.ARTICLE_BASE_PATH || "/articles";
  const normalizedPath = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return `${normalizedBase}${normalizedPath}/${slug}`;
}

async function pingIndexNow(urlList: string[], siteUrl: string) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    throw new Error("INDEXNOW_KEY is not configured");
  }

  const keyLocation =
    process.env.INDEXNOW_KEY_LOCATION ||
    `${siteUrl.replace(/\/$/, "")}/${key}.txt`;

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: new URL(siteUrl).host,
      key,
      keyLocation,
      urlList,
    }),
  });

  const text = await res.text();
  
  if (!res.ok) {
    console.warn("IndexNow ping failed", {
      status: res.status,
      statusText: res.statusText,
      body: text,
      urls: urlList,
      keyLocation,
    });
    // Don't throw - log the error but continue
    // This allows articles to publish even if IndexNow fails
    // (usually due to domain verification not being complete)
    return { success: false, status: res.status, error: text };
  }

  console.log("IndexNow ping success", {
    urls: urlList,
    count: urlList.length,
    status: res.status,
    body: text,
  });

  return { success: true, status: res.status, body: text };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { articleId, slug } = body;

    if (!articleId || !slug) {
      return NextResponse.json(
        { error: "Article ID and slug are required" },
        { status: 400 }
      );
    }

    // Verify article exists and is published
    const { data: article, error } = await supabase
      .from("articles")
      .select("id, slug, status")
      .eq("id", articleId)
      .single();

    if (error || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    if (article.status !== "published") {
      return NextResponse.json(
        { error: "Only published articles can be indexed" },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
    if (!siteUrl) {
      return NextResponse.json(
        { error: "Site URL is not configured" },
        { status: 500 }
      );
    }

    const articleUrl = buildArticleUrl(siteUrl, slug);
    console.log("Manual IndexNow trigger:", { articleId, url: articleUrl });

    const result = await pingIndexNow([articleUrl], siteUrl);

    return NextResponse.json({
      success: true,
      message: "Article submitted to search engines for indexing",
      url: articleUrl,
      indexNowResult: result,
    });
  } catch (error) {
    console.error("Error triggering IndexNow:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger indexing",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
