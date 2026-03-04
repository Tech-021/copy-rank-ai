import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase admin client – used to read articles and user settings
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type WordpressConfig = {
  baseUrl?: string | null;
  username?: string | null;
  appPassword?: string | null;
};

function getWpBaseUrl(config?: WordpressConfig) {
  const base = (config?.baseUrl || process.env.WP_API_URL || "").trim();
  if (!base) {
    throw new Error("No WordPress base URL configured for this user");
  }
  return base.replace(/\/$/, "");
}

function getWpAuthHeader(config?: WordpressConfig) {
  const username = (config?.username || process.env.WP_API_USER || "").trim();
  const password = (
    config?.appPassword ||
    process.env.WP_API_APP_PASSWORD ||
    ""
  ).trim();

  if (!username || !password) {
    throw new Error(
      "No WordPress credentials configured for this user (username/app password missing)"
    );
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
    console.log("WP publish: incoming articleId", articleId, "userId", user.id);
    const { data: article, error: articleError } = await supabaseAdmin
      .from("articles")
      // select all columns; we'll pick what we need in code
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      console.warn("WP publish: article lookup failed", {
        articleId,
        userId: user.id,
        error: articleError,
      });
      return NextResponse.json(
        {
          error: "Article not found",
          details: articleError?.message ?? null,
        },
        { status: 404 }
      );
    }

    if (article.user_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this article" },
        { status: 403 }
      );
    }

    // 4) Load per-user WordPress settings from dedicated credentials table
    let wpConfig: WordpressConfig | undefined;
    try {
      const { data: credRow, error: credError } = await supabaseAdmin
        .from("wordpress_credentials")
        .select("rest_api_url, username, app_password")
        .eq("user_id", user.id)
        .is("website_id", null)
        .maybeSingle();

      if (!credError && credRow) {
        const c = credRow as any;
        wpConfig = {
          baseUrl: c.rest_api_url,
          username: c.username,
          appPassword: c.app_password,
        };
      }
    } catch (err) {
      console.warn("Failed to load per-user WordPress credentials", err);
    }

    // 5) Collect any generated image URLs from article
    const rawImages =
      (article as any).generatedImages ??
      (article as any).generated_images ??
      (article as any).generated_images_urls ??
      (article as any).generated_images_url ??
      (article as any).images ??
      null;

    let imageUrls: string[] = [];
    if (Array.isArray(rawImages)) {
      imageUrls = rawImages.filter((u) => typeof u === "string" && u.length > 0);
    } else if (typeof rawImages === "string" && rawImages.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawImages);
        if (Array.isArray(parsed)) {
          imageUrls = parsed.filter(
            (u) => typeof u === "string" && u.length > 0
          );
        } else {
          imageUrls = [rawImages];
        }
      } catch {
        imageUrls = [rawImages];
      }
    }

    const uploadedMediaIds: number[] = [];
    const uploadedMediaUrls: string[] = [];

    // 6) Upload up to 3 images to WordPress media library (in parallel)
    const imagesToUpload = imageUrls.slice(0, 3);

    const uploadResults = await Promise.allSettled(
      imagesToUpload.map(async (url, index) => {
        const imgRes = await fetch(url);
        if (!imgRes.ok) {
          console.warn("Failed to fetch article image", {
            url,
            status: imgRes.status,
          });
          return null;
        }

        const contentType =
          imgRes.headers.get("content-type") || "image/jpeg";
        const extension = contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
          ? "webp"
          : "jpg";

        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filenameBase =
          (article as any).slug ||
          (article.title as string | undefined) ||
          "image";

        const safeBase = filenameBase
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .substring(0, 40);

        const filename = `${safeBase || "image"}-${index + 1}.${extension}`;

        const mediaRes = await fetch(`${getWpBaseUrl(wpConfig)}/media`, {
          method: "POST",
          headers: {
            Authorization: getWpAuthHeader(wpConfig),
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
          body: buffer,
        });

        const mediaText = await mediaRes.text();
        let mediaJson: any = null;
        try {
          mediaJson = JSON.parse(mediaText);
        } catch {
          // ignore parse error; we'll log below if needed
        }

        if (!mediaRes.ok) {
          console.warn("Failed to upload image to WordPress", {
            url,
            status: mediaRes.status,
            body: mediaText,
          });
          return null;
        }

        if (mediaJson?.id && mediaJson?.source_url) {
          return {
            id: mediaJson.id as number,
            url: mediaJson.source_url as string,
          };
        }

        return null;
      })
    );

    uploadResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        uploadedMediaIds.push(result.value.id);
        uploadedMediaUrls.push(result.value.url);
      } else if (result.status === "rejected") {
        console.warn("Image upload promise rejected", result.reason);
      }
    });

    // 7) Build final content HTML: original content plus appended images using WP URLs (if any)
    let finalContent: string =
      article.content ||
      `<p>${article.preview || "Content not available."}</p>`;

    if (uploadedMediaUrls.length > 0) {
      const imagesHtml = uploadedMediaUrls
        .map(
          (src, index) =>
            `<p><img src="${src}" alt="${(article.title as string) || "image"} ${
              index + 1
            }" /></p>`
        )
        .join("");
      finalContent += imagesHtml;
    }

    // 8) Prepare and send WordPress post request
    const wpBase = getWpBaseUrl(wpConfig);
    const wpAuth = getWpAuthHeader(wpConfig);

    const wpResponse = await fetch(`${wpBase}/posts`, {
      method: "POST",
      headers: {
        Authorization: wpAuth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: article.meta_title || article.title || "Untitled article",
        content: finalContent,
        status: "draft", // keep as draft in WordPress; publishing is a separate flow
        ...(uploadedMediaIds[0] && { featured_media: uploadedMediaIds[0] }),
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

    // 9) Return WordPress info (no status changes / no IndexNow)
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

