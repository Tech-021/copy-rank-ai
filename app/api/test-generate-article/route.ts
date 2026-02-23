import { NextResponse } from "next/server";
import { buildMessages, defaultSampling } from "@/lib/generateArticle";
import { createClient } from "@supabase/supabase-js";

import { getUserArticleLimit } from "@/lib/articleLimits";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Set max duration for Pro plan (60 seconds)
export const maxDuration = 800;

import type { ArticleRequest, EnhancedArticle } from "./articleHelpers";
import {
  validateRequestBody,
  buildArticlePrompt,
  parseStructuredResponse,
  generateEnhancedMetadata,
  generateRecommendations,
  saveArticleToDatabase,
  fetchKeywordsFromWebsite,
} from "./articleHelpers";
import { generateImagesForArticle } from "./imageHelpers";
import { buildArticleUrl, pingIndexNow } from "./indexHelpers";

export async function POST(request: Request) {
  let jobId: string | undefined;

  try {
    // Allow internal server-to-server calls with a shared secret while keeping user-bound auth for others
    const internalKey = request.headers.get('x-internal-api-key');
    const isInternalCall =
      internalKey && internalKey === process.env.ARTICLE_PROCESS_SECRET;

    const body: ArticleRequest = await request.json();

    let user: { id: string; email?: string } | null = null;

    if (!isInternalCall) {
      // Check authentication using JWT token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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
        data: { user: authedUser },
      } = await supabaseAuth.auth.getUser();

      user = authedUser ?? null;

      if (!user || !user.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Verify that the userId matches the authenticated user
      if (body.userId !== user.id) {
        return NextResponse.json(
          { error: "Unauthorized access" },
          { status: 403 }
        );
      }
    } else {
      // Internal calls rely on the job payload; ensure userId exists
      if (!body.userId) {
        return NextResponse.json(
          { error: "Missing userId for internal request" },
          { status: 400 }
        );
      }
      user = { id: body.userId };
      // Internal calls skip onboarding/subscription checks since validation already happened during job enqueue
    }

    // For external calls, verify onboarding and subscription
    if (!isInternalCall) {
      // Check if user needs onboarding
      const { data: predata } = await supabase
        .from('pre_data')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const needsOnboarding = !predata || (() => {
        const hasWebsite = predata.website && predata.website.trim() !== '';
        const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0;
        const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0;
        return !hasWebsite || !hasCompetitors;
      })();

      if (needsOnboarding) {
        return NextResponse.json(
          { error: "Onboarding required" },
          { status: 403 }
        );
      }

      // Check subscription status
      const { data: userData } = await supabase
        .from('users')
        .select('subscribe')
        .eq('id', user.id)
        .single();

      if (!userData?.subscribe) {
        return NextResponse.json(
          { error: "Subscription required" },
          { status: 403 }
        );
      }
    }

    // ========== COMPREHENSIVE DEBUGGING ==========
    console.log("🔍 === DEBUG START ===");
    console.log("📨 RAW REQUEST BODY:", JSON.stringify(body, null, 2));
    console.log("🔑 generateImages value:", body.generateImages);
    console.log("🔑 generateImages type:", typeof body.generateImages);
    console.log("🔑 All body properties:", Object.keys(body));

    // Check if generateImages exists and its value
    if ("generateImages" in body) {
      console.log("✅ generateImages EXISTS in request body");
      console.log("🔍 generateImages raw value:", body.generateImages);
      console.log(
        "🔍 generateImages boolean conversion:",
        Boolean(body.generateImages)
      );
    } else {
      console.log("❌ generateImages DOES NOT EXIST in request body");
    }
    console.log("🔍 === DEBUG END ===");
    // Validate and normalize request body
    const normalized = validateRequestBody(body);
    let keywords = normalized.keywords;
    const { websiteId, userId, targetWordCount, articleNumber, totalArticles, generateImages, imageCount } = normalized;
    jobId = body.jobId; 
    console.log("🖼️ Image generation enabled:", generateImages);

    // If a websiteId was provided, fetch fresh keywords from websites and prefer those
    if (websiteId) {
      try {
        const siteKeywords = await fetchKeywordsFromWebsite(supabase, websiteId);
        if (siteKeywords && siteKeywords.length > 0) {
          console.log('🔁 Using keywords from website:', websiteId, siteKeywords.slice(0, 5));
          keywords = siteKeywords;
        } else {
          console.log('⚠️ No keywords found for website, continuing with request keywords');
        }
      } catch (err) {
        console.warn('⚠️ Error fetching keywords from website - using request keywords', err);
      }
    }
    // ========== MORE DEBUGGING ==========
    console.log("🔄 generateImages after destructuring:", generateImages);
    console.log("🔄 generateImages actual value for logic:", generateImages);
    console.log("🔄 Type of generateImages:", typeof generateImages);
    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "At least one keyword is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check user's package limit
    const userLimit = await getUserArticleLimit(userId);
    if (totalArticles > userLimit) {
      return NextResponse.json(
        {
          error: `Package limit exceeded. Your package allows ${userLimit} articles, but ${totalArticles} were requested.`,
          packageLimit: userLimit,
        },
        { status: 403 }
      );
    }

    const qwenApiKey = process.env.QWEN_API_KEY;
    if (!qwenApiKey) {
      return NextResponse.json(
        { error: "Qwen API key not configured" },
        { status: 500 }
      );
    }

    // Pick a random keyword from the list. Keywords may be strings or objects with metadata like { keyword, description }
    const selectedRaw: any = keywords[Math.floor(Math.random() * keywords.length)];
    const selectedKeywordText = typeof selectedRaw === 'string' ? selectedRaw : (selectedRaw?.keyword || selectedRaw?.name || selectedRaw?.text || '');
    const selectedKeywordMeta = typeof selectedRaw === 'object' ? selectedRaw : null;
    const allKeywordsText = keywords
      .map((k: any) => (typeof k === 'string' ? k : (k?.keyword || k?.name || k?.text || '')))
      .filter(Boolean)
      .join(', ');

    console.log(
      `🚀 Generating article ${articleNumber}/${totalArticles} with keywords:`,
      keywords
    );
    console.log(`📌 Selected keyword for meta title: "${selectedKeywordText}"`, { selectedRaw });
    console.log(
      `🖼️ Image generation: ${generateImages ? "ENABLED" : "disabled"}`
    );

    // Pass the raw selected keyword (could include description/metadata) so the prompt can use it
    const prompt = buildArticlePrompt(selectedRaw, allKeywordsText, targetWordCount, articleNumber, totalArticles);

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Article generation timeout after 3 minutes")),
        180000
      );
    });

    const messages = buildMessages({
      topic: `SEO article with keywords: ${allKeywordsText}`,
      audience: "general web readers",
      words: Math.max(targetWordCount, 800),
      keyword: selectedKeywordText,
      keywordMeta: selectedKeywordMeta,
    });

    // Append your strict formatting and requirements to the final user message
    messages.push({ role: "user", content: prompt });

    const fetchPromise = fetch(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${qwenApiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages,
          temperature: defaultSampling.temperature,
          top_p: defaultSampling.top_p,
          frequency_penalty: defaultSampling.frequency_penalty,
          presence_penalty: defaultSampling.presence_penalty,
          max_tokens: 4500,
        }),
      }
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Qwen API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Qwen API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from Qwen API");
    }

    const fullResponse = data.choices[0].message.content;

    // Parse the structured response
    const parsedData = parseStructuredResponse(fullResponse, selectedKeywordText);

    // Generate enhanced metadata
    const enhancedArticle = generateEnhancedMetadata(
      parsedData,
      selectedKeywordText,
      targetWordCount
    );

    // NEW: Generate images if requested
    let generatedImages: string[] = [];
    if (generateImages) {
      console.log("🎨 Starting image generation...");
      generatedImages = await generateImagesForArticle(
        request,
        enhancedArticle.content,
        enhancedArticle.title,
        keywords,
        imageCount
      );
      enhancedArticle.generatedImages = generatedImages;
      console.log(`✅ Generated ${generatedImages.length} images`);
    }

    // Save to database using helper
    const savedArticle = await saveArticleToDatabase(supabase, enhancedArticle, userId, websiteId, generatedImages);

    console.log(
      "✅ Enhanced article generated and saved to Supabase for user:",
      userId
    );
    console.log("📊 Final word count:", enhancedArticle.wordCount);
    if (generateImages) {
      console.log("🖼️ Images generated:", generatedImages.length);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
    if (siteUrl && savedArticle.slug) {
      const articleUrl = buildArticleUrl(siteUrl, savedArticle.slug);
      await pingIndexNow([articleUrl], siteUrl);
    } else {
      console.warn("⚠️ Skipping IndexNow ping: site URL or slug missing");
    }

    return NextResponse.json({
      success: true,
      article: {
        ...enhancedArticle,
        id: savedArticle.id,
        status: savedArticle.status,
        date: savedArticle.date,
        generatedImages: generatedImages, // Include in response
      },
      analysis: {
        seoReady:
          enhancedArticle.contentScore >= 70 &&
          enhancedArticle.wordCount >= 1800,
        immediatePublish: enhancedArticle.wordCount >= 1800,
        wordCountStatus:
          enhancedArticle.wordCount >= 1800 ? "optimal" : "needs_expansion",
        recommendations: generateRecommendations(enhancedArticle),
      },
      // NEW: Include image generation summary
      images: generateImages
        ? {
            generated: generatedImages.length,
            totalRequested: imageCount,
            urls: generatedImages,
          }
        : undefined,
    });
  } catch (error) {
    console.error("💥 Enhanced article generation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate enhanced article",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ... ALL THE EXISTING HELPER FUNCTIONS REMAIN THE SAME ...
// parseStructuredResponse, generateEnhancedMetadata, calculateContentScore, etc.
// Keep all your existing helper functions exactly as they are

// GET endpoint - update to include generated_images
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get("websiteId");
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
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
      throw error;
    }

    // Transform to camelCase for frontend
    const transformedArticles =
      articles?.map((article) => ({
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
        focusKeyword: article.focus_keyword ?? (Array.isArray(article.keyword) ? article.keyword[0] : article.keyword),
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
        // NEW: Include generated images
        generatedImages: article.generated_images || [],
      })) || [];

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

// PATCH endpoint with user authorization
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");
    const body = await request.json();

    if (!id || !userId) {
      return NextResponse.json(
        { error: "Article ID and User ID are required" },
        { status: 400 }
      );
    }

    // First verify the article belongs to the user
    const { data: existingArticle, error: fetchError } = await supabase
      .from("articles")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (existingArticle.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("articles")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, article: data });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}

// DELETE endpoint with user authorization
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json(
        { error: "Article ID and User ID are required" },
        { status: 400 }
      );
    }

    // First verify the article belongs to the user
    const { data: existingArticle, error: fetchError } = await supabase
      .from("articles")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (existingArticle.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase.from("articles").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}

