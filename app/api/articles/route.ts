import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildArticleUrl(baseSiteUrl: string, slug: string): string {
  const normalizedBase = baseSiteUrl.replace(/\/$/, "");
  const basePath = process.env.ARTICLE_BASE_PATH || "/articles";
  const normalizedPath = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return `${normalizedBase}${normalizedPath}/${slug}`;
}

function slugifyTitle(title: string): string {
  return (title || "article")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 60);
}

async function pingIndexNow(urlList: string[], siteUrl: string) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.warn("IndexNow: INDEXNOW_KEY missing; skipping ping");
    return;
  }

  const keyLocation =
    process.env.INDEXNOW_KEY_LOCATION ||
    `${siteUrl.replace(/\/$/, "")}/${key}.txt`;

  try {
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
      });
    } else {
      console.log("IndexNow ping success", {
        urls: urlList,
        count: urlList.length,
        status: res.status,
        body: text,
      });
    }
  } catch (err) {
    console.warn("IndexNow ping error", err);
  }
}

export async function GET(request: Request) {
  try {
    console.log('Articles API: Starting request');

    // Check authentication using JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Articles API: No authorization header');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const supabase = createClient(
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
      error: authError
    } = await supabase.auth.getUser();

    console.log('Articles API: Auth check - user:', user?.id, 'error:', authError);

    if (!user || !user.id) {
      console.log('Articles API: Authentication failed');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user needs onboarding
    console.log('Articles API: Checking pre_data for email:', user.email);
    const { data: predata, error: predataError } = await supabaseAdmin
      .from('pre_data')
      .select('*')
      .eq('email', user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Articles API: predata result:', predata, 'error:', predataError);

    const needsOnboarding = !predata || (() => {
      const hasWebsite = predata.website && predata.website.trim() !== '';
      const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0;
      const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0;
      console.log('Articles API: hasWebsite:', hasWebsite, 'hasCompetitors:', hasCompetitors, 'hasKeywords:', hasKeywords);
      return !hasWebsite || (!hasCompetitors && !hasKeywords);
    })();

    console.log('Articles API: needsOnboarding:', needsOnboarding);

    if (needsOnboarding) {
      console.log('Articles API: Onboarding required - rejecting request');
      return NextResponse.json(
        { error: "Onboarding required" },
        { status: 403 }
      );
    }

    // Check subscription status
    console.log('Articles API: Checking subscription for user:', user.id);
    const { data: userData, error: subError } = await supabaseAdmin
      .from('users')
      .select('subscribe')
      .eq('id', user.id)
      .single();

    console.log('Articles API: subscription result:', userData, 'error:', subError);

    if (!userData?.subscribe) {
      console.log('Articles API: Subscription required - rejecting request');
      return NextResponse.json(
        { error: "Subscription required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get("websiteId");
    const userId = searchParams.get("userId");

    console.log("API Request - requested userId:", userId, "authenticated userId:", user.id);

    // Verify that the requested userId matches the authenticated user
    if (!userId || userId !== user.id) {
      console.log('Articles API: User ID mismatch - rejecting request');
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    let query = supabase
      .from("articles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (websiteId) {
      query = query.eq("website_id", websiteId);
    }

    const { data: articles, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    console.log(`Found ${articles?.length || 0} articles for user ${userId}`);

    // Transform to camelCase for frontend
    const transformedArticles =
      articles?.map((article) => {
        // Normalize any image-related columns from the DB into a single generatedImages array
        const rawImages =
          // Preferred column: generated_images
          (article as any).generated_images ??
          // Fallbacks for possible legacy/alternate columns
          (article as any).generated_images_urls ??
          (article as any).generated_images_url ??
          (article as any).images ??
          [];

        const generatedImages =
          typeof rawImages === "string"
            ? (() => {
                try {
                  const parsed = JSON.parse(rawImages);
                  return Array.isArray(parsed)
                    ? parsed
                    : parsed
                    ? [parsed]
                    : [];
                } catch {
                  // If it's a plain string that isn't JSON, just wrap it
                  return rawImages ? [rawImages] : [];
                }
              })()
            : rawImages ?? [];

        return {
          id: article.id,
          title: article.title,
          content: article.content,
          keyword: article.keyword,
          status: article.status,
          date: new Date(article.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          preview: article.preview,
          wordCount: article.word_count,
          metaTitle: article.meta_title,
          metaDescription: article.meta_description,
          slug: article.slug,
          focusKeyword: article.focus_keyword,
          readingTime: article.reading_time,
          contentScore: article.content_score,
          keywordDensity: article.keyword_density,
          ogTitle: article.og_title,
          ogDescription: article.og_description,
          twitterTitle: article.twitter_title,
          twitterDescription: article.twitter_description,
          tags: article.tags || [],
          category: article.category,
          estimatedTraffic: article.estimated_traffic,
          generatedAt: article.created_at,
          userId: article.user_id,
          websiteId: article.website_id,
          // ✅ expose generatedImages to the frontend
          generatedImages,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      articles: transformedArticles,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, ...articleData } = body;

    if (!userId) {
      return NextResponse.json(
        {
          error: "User ID is required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("articles")
      .insert({
        ...articleData,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        article: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      {
        error: "Failed to create article",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();
    const {
      status,
      userId,
      title,
      content,
      metaTitle,
      metaDescription,
      slug,
      keyword,
      preview,
      autoSlugFromTitle,
    } = body;

    console.log(
      "PATCH Request - ID:",
      id,
      "Status:",
      status,
      "User ID:",
      userId
    );

    if (!id) {
      return NextResponse.json(
        {
          error: "Article ID is required",
        },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        {
          error: "User ID is required",
        },
        { status: 400 }
      );
    }

    const hasStatusUpdate = typeof status === "string" && status.length > 0;
    const hasFieldUpdates = [
      title,
      content,
      metaTitle,
      metaDescription,
      slug,
      keyword,
      preview,
    ].some((v) => v !== undefined);

    if (!hasStatusUpdate && !hasFieldUpdates) {
      return NextResponse.json(
        {
          error: "No update fields provided",
        },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (hasStatusUpdate) {
      updateData.status = status;
    }

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (metaTitle !== undefined) updateData.meta_title = metaTitle;
    if (metaDescription !== undefined)
      updateData.meta_description = metaDescription;
    if (slug !== undefined) updateData.slug = slug;
    if (keyword !== undefined) updateData.keyword = keyword;
    if (preview !== undefined) updateData.preview = preview;

    // Auto-generate slug from title when requested
    if (autoSlugFromTitle === true && title) {
      // Force regenerate even if a slug was provided
      updateData.slug = slugifyTitle(title);
    } else if (!slug && title && autoSlugFromTitle !== false) {
      // Default to title-based slug when none provided
      updateData.slug = slugifyTitle(title);
    }

    // Add published_at if publishing for the first time
    if (status === "published") {
      // Check current status to see if we're publishing for the first time
      const { data: currentArticle } = await supabase
        .from("articles")
        .select("status, published_at")
        .eq("id", id)
        .single();

      if (currentArticle && currentArticle.status !== "published") {
        updateData.published_at = new Date().toISOString();
      }
    }

    console.log("Update data:", updateData);

    const { data, error } = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "Article not found or access denied",
        },
        { status: 404 }
      );
    }

    console.log(
      "Successfully updated article:",
      data.id,
      "to status:",
      data.status
    );

    // If article is published, ping IndexNow with the public URL and log results
    if (data.status === "published" && data.slug) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
      if (siteUrl) {
        const articleUrl = buildArticleUrl(siteUrl, data.slug);
        console.log("IndexNow: preparing to ping", {
          articleId: data.id,
          url: articleUrl,
        });
        await pingIndexNow([articleUrl], siteUrl);
      } else {
        console.warn("IndexNow: missing site URL env; skipping ping", {
          articleId: data.id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      article: data,
    });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      {
        error: "Failed to update article",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id) {
      return NextResponse.json(
        {
          error: "Article ID is required",
        },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        {
          error: "User ID is required",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      {
        error: "Failed to delete article",
      },
      { status: 500 }
    );
  }
}
