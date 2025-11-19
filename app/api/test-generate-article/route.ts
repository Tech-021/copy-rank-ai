import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const maxDuration = 300;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ArticleRequest {
  keyword?: string; // Keep for backward compatibility
  keywords?: string[]; // Array of keywords
  websiteId?: string;
  userId: string;
  targetWordCount?: number;
  articleNumber?: number; // NEW: Article number (1-30)
  totalArticles?: number; // NEW: Total articles being generated
}

interface EnhancedArticle {
  // Core Content
  title: string;
  content: string;

  // SEO Metadata
  metaTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;

  // Content Analysis
  readingTime: string;
  wordCount: number;
  contentScore: number;
  keywordDensity: number;

  // Social Media
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;

  // Internal Organization
  tags: string[];
  category: string;

  // Technical
  generatedAt: string;
  estimatedTraffic?: number;
}

export async function POST(request: Request) {
  try {
    const body: ArticleRequest = await request.json();

    const keywords = body.keywords || (body.keyword ? [body.keyword] : []);
    const {
      websiteId,
      userId,
      targetWordCount = 2000,
      articleNumber = 1,
      totalArticles = 1,
    } = body;

    if (keywords.length === 0) {
      return new Response("At least one keyword is required", { status: 400 });
    }

    if (!userId) {
      return new Response("User ID is required", { status: 400 });
    }

    const qwenApiKey = process.env.QWEN_API_KEY;

    const selectedKeywordIndex = (articleNumber - 1) % keywords.length;
    const selectedKeyword = keywords[selectedKeywordIndex];
    const allKeywordsText = keywords.join(", ");

    const variationInstructions =
      totalArticles > 1 ? `This is article ${articleNumber}…` : "";

    // ENHANCED PROMPT for comprehensive, long-form content with multiple keywords
    const prompt = `Generate a comprehensive, in-depth SEO-optimized blog post that naturally incorporates ALL of these keywords: ${allKeywordsText}.${variationInstructions}

ALL KEYWORDS: ${allKeywordsText}
SELECTED KEYWORD FOR META TITLE: "${selectedKeyword}" (use this keyword in the meta title and description)

CRITICAL REQUIREMENTS:

1. MAIN CONTENT (${targetWordCount}+ WORDS - THIS IS NON-NEGOTIABLE):
- Write detailed, well-researched, comprehensive content that naturally weaves in ALL the provided keywords
- Aim for ${targetWordCount}+ words minimum for SEO optimization
- Use proper HTML structure with <h1>, <h2>, and <h3> headings
- Include extensive examples, case studies, and actionable advice
- Naturally integrate ALL keywords throughout the content (1-2% density for the selected keyword "${selectedKeyword}", natural mentions for others)
- Ensure the content flows naturally and doesn't feel keyword-stuffed
- Comprehensive conclusion with key takeaways and next steps
${
  totalArticles > 1
    ? "- Create a unique angle or perspective that makes this article stand out from others on the same topic"
    : ""
}

2. CONTENT STRUCTURE (EXPANDED FOR LENGTH):
- Engaging introduction with hook and problem statement (150-200 words) - naturally include keywords
- Background and context section (200-300 words) - naturally mention related keywords
- 5-7 main sections with multiple subsections (each section 250-400 words)
- Each section should naturally incorporate relevant keywords from the list
- Include: statistics, research findings, expert opinions
- Add: step-by-step guides, checklists, practical applications
- Use: bullet points, numbered lists, comparison tables where relevant
- Comprehensive conclusion summarizing all key points (200-250 words) - naturally reinforce keywords
${
  totalArticles > 1
    ? "- Vary the section structure and order to create uniqueness"
    : ""
}

3. KEYWORD INTEGRATION REQUIREMENTS:
- The selected keyword "${selectedKeyword}" should appear naturally throughout (1-2% density)
- All other keywords should be naturally woven into relevant sections
- Keywords should feel organic, not forced
- Use variations and related terms naturally
- Ensure content reads naturally for humans while optimizing for SEO

4. DEPTH AND DETAIL REQUIREMENTS:
- Cover the topic from multiple angles and perspectives
- Include recent data, trends, and developments
- Address common questions and misconceptions
- Provide real-world examples and case studies
- Offer actionable tips and implementation strategies
- Compare different approaches or methodologies
${
  totalArticles > 1
    ? "- Use different examples, case studies, and data points than previous articles"
    : ""
}

5. METADATA (Generate these EXACTLY as specified):
- META_TITLE: Create a compelling title (55-60 characters) that includes the keyword "${selectedKeyword}" ${
      totalArticles > 1 ? "with a unique angle" : ""
    }
- META_DESCRIPTION: Write a click-worthy description (150-160 characters) that includes the keyword "${selectedKeyword}" and encourages clicks
- OG_TITLE: Create a social media optimized title (with emoji if appropriate)
- OG_DESCRIPTION: Social media friendly description (120-130 characters)

Please format your response EXACTLY as:

CONTENT:
[Your full article content here with HTML tags - MUST BE ${targetWordCount}+ WORDS and naturally include ALL keywords: ${allKeywordsText}]

META_TITLE: [Optimized title 55-60 chars with keyword "${selectedKeyword}"]
META_DESCRIPTION: [Compelling description 150-160 chars with keyword "${selectedKeyword}"]
OG_TITLE: [Social media title with emoji]
OG_DESCRIPTION: [Social media description 120-130 chars]`;

    // 🔥 QWEN STREAMING REQUEST
    const qwenResponse = await fetch(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${qwenApiKey}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          stream: true, // <--- ENABLE STREAMING
          temperature: 0.7,
          max_tokens: 4000,
          messages: [
            {
              role: "system",
              content: `You are an expert SEO strategist...`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    if (!qwenResponse.ok || !qwenResponse.body) {
      return new Response("Qwen streaming failed", { status: 500 });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let fullText = ""; // We will collect full article here

    const stream = new ReadableStream({
      async start(controller) {
        const reader = qwenResponse.body!.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.replace("data: ", "").trim();
            if (jsonStr === "[DONE]") {
              controller.close();
              break;
            }

            try {
              const json = JSON.parse(jsonStr);
              const delta =
                json?.choices?.[0]?.delta?.content ??
                json?.choices?.[0]?.delta ??
                "";

              fullText += delta;

              // 🔥 Send chunk to frontend immediately
              controller.enqueue(encoder.encode(delta));
            } catch (e) {
              console.log("Chunk parse error", e);
            }
          }
        }

        controller.close();

        // ✔ After stream finishes → Parse metadata and save to Supabase
        const parsed = parseStructuredResponse(fullText, selectedKeyword);
        const enhanced = generateEnhancedMetadata(
          parsed,
          selectedKeyword,
          targetWordCount
        );

        await supabase.from("articles").insert({
          title: enhanced.title,
          content: enhanced.content,
          keyword: keywords.join(", "),
          status: "draft",
          date: new Date().toISOString().split("T")[0],
          preview:
            enhanced.metaDescription ||
            enhanced.content.substring(0, 150) + "...",
          meta_title: enhanced.metaTitle,
          meta_description: enhanced.metaDescription,
          slug: enhanced.slug,
          focus_keyword: selectedKeyword,
          reading_time: enhanced.readingTime,
          word_count: enhanced.wordCount,
          content_score: enhanced.contentScore,
          keyword_density: enhanced.keywordDensity,
          og_title: enhanced.ogTitle,
          og_description: enhanced.ogDescription,
          twitter_title: enhanced.twitterTitle,
          twitter_description: enhanced.twitterDescription,
          tags: enhanced.tags,
          category: enhanced.category,
          estimated_traffic: enhanced.estimatedTraffic,
          ...(websiteId && { website_id: websiteId }),
          user_id: userId,
        });

        console.log("✨ Article saved successfully");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("💥 Streamed generation error:", err);
    return new Response("Failed to stream article", { status: 500 });
  }
}

// GET endpoint to fetch articles with user filtering
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

// Helper functions
function parseStructuredResponse(response: string, keyword: string) {
  const contentMatch = response.match(/CONTENT:\s*([\s\S]*?)(?=META_TITLE:|$)/);
  const metaTitleMatch = response.match(/META_TITLE:\s*(.+)/);
  const metaDescMatch = response.match(/META_DESCRIPTION:\s*(.+)/);
  const ogTitleMatch = response.match(/OG_TITLE:\s*(.+)/);
  const ogDescMatch = response.match(/OG_DESCRIPTION:\s*(.+)/);

  return {
    content: contentMatch ? contentMatch[1].trim() : response,
    metaTitle: metaTitleMatch
      ? metaTitleMatch[1].trim()
      : generateFallbackMetaTitle(keyword),
    metaDescription: metaDescMatch
      ? metaDescMatch[1].trim()
      : generateFallbackMetaDescription(keyword),
    ogTitle: ogTitleMatch
      ? ogTitleMatch[1].trim()
      : generateFallbackOgTitle(keyword),
    ogDescription: ogDescMatch
      ? ogDescMatch[1].trim()
      : generateFallbackOgDescription(keyword),
  };
}

function generateEnhancedMetadata(
  parsedData: any,
  keyword: string,
  targetWordCount: number
): EnhancedArticle {
  const content = parsedData.content;
  const wordCount = content.split(/\s+/).length;

  return {
    // Core Content
    title: extractMainTitle(content) || parsedData.metaTitle,
    content: content,

    // SEO Metadata
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription,
    slug: generateSlug(keyword),
    focusKeyword: keyword,

    // Content Analysis
    readingTime: calculateReadingTime(wordCount),
    wordCount: wordCount,
    contentScore: calculateContentScore(content, keyword, targetWordCount),
    keywordDensity: calculateKeywordDensity(content, keyword),

    // Social Media
    ogTitle: parsedData.ogTitle,
    ogDescription: parsedData.ogDescription,
    twitterTitle: parsedData.ogTitle,
    twitterDescription: parsedData.ogDescription,

    // Internal Organization
    tags: generateTags(keyword),
    category: determineCategory(keyword),

    // Technical
    generatedAt: new Date().toISOString(),
    estimatedTraffic: estimateTrafficPotential(keyword),
  };
}

// Enhanced content scoring that rewards longer articles
function calculateContentScore(
  content: string,
  keyword: string,
  targetWordCount: number
): number {
  let score = 50; // Base score

  const wordCount = content.split(/\s+/).length;

  // Reward longer content significantly more for SEO
  if (wordCount >= targetWordCount) score += 25;
  else if (wordCount >= 1800) score += 20;
  else if (wordCount >= 1500) score += 15;
  else if (wordCount >= 1200) score += 10;
  else if (wordCount >= 1000) score += 5;

  // Check for headings structure
  if (content.includes("<h1>")) score += 5;
  if ((content.match(/<h2>/g) || []).length >= 3) score += 10;
  if ((content.match(/<h3>/g) || []).length >= 5) score += 10;

  // Check keyword optimization
  if (content.toLowerCase().includes(keyword.toLowerCase())) score += 10;

  return Math.min(score, 100);
}

// Metadata generation helpers
function generateSlug(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 60);
}

function generateFallbackMetaTitle(keyword: string): string {
  const currentYear = new Date().getFullYear();
  const baseTitle = `${
    keyword.charAt(0).toUpperCase() + keyword.slice(1)
  } - Complete Guide ${currentYear}`;
  return baseTitle.length > 60 ? baseTitle.substring(0, 57) + "..." : baseTitle;
}

function generateFallbackMetaDescription(keyword: string): string {
  const baseDesc = `Discover the best strategies and tips for ${keyword}. Learn everything you need to know in our comprehensive guide.`;
  return baseDesc.length > 160 ? baseDesc.substring(0, 157) + "..." : baseDesc;
}

function generateFallbackOgTitle(keyword: string): string {
  return `🚀 ${
    keyword.charAt(0).toUpperCase() + keyword.slice(1)
  } - Ultimate Guide`;
}

function generateFallbackOgDescription(keyword: string): string {
  return `Master ${keyword} with our expert guide. Get started today!`;
}

function extractMainTitle(content: string): string {
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1];

  const firstH2Match = content.match(/<h2[^>]*>(.*?)<\/h2>/i);
  if (firstH2Match) return firstH2Match[1];

  return "";
}

function calculateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
}

function calculateKeywordDensity(content: string, keyword: string): number {
  const words = content.toLowerCase().split(/\s+/);
  const keywordCount = words.filter((word) =>
    word.includes(keyword.toLowerCase())
  ).length;
  return Number(((keywordCount / words.length) * 100).toFixed(2));
}

function generateTags(keyword: string): string[] {
  const baseTags = [keyword];
  const relatedTerms = keyword.split(" ").slice(0, 3);
  return [...new Set([...baseTags, ...relatedTerms])].slice(0, 5);
}

function determineCategory(keyword: string): string {
  // Simple category detection based on keyword
  const lowerKeyword = keyword.toLowerCase();

  if (
    lowerKeyword.includes("workout") ||
    lowerKeyword.includes("fitness") ||
    lowerKeyword.includes("exercise")
  ) {
    return "fitness";
  } else if (
    lowerKeyword.includes("marketing") ||
    lowerKeyword.includes("seo") ||
    lowerKeyword.includes("social")
  ) {
    return "marketing";
  } else if (
    lowerKeyword.includes("money") ||
    lowerKeyword.includes("finance") ||
    lowerKeyword.includes("investment")
  ) {
    return "finance";
  } else if (
    lowerKeyword.includes("health") ||
    lowerKeyword.includes("diet") ||
    lowerKeyword.includes("nutrition")
  ) {
    return "health";
  } else if (
    lowerKeyword.includes("tech") ||
    lowerKeyword.includes("ai") ||
    lowerKeyword.includes("software")
  ) {
    return "technology";
  } else {
    return "general";
  }
}

function estimateTrafficPotential(keyword: string): number {
  // Simple estimation based on keyword characteristics
  const wordCount = keyword.split(" ").length;
  if (wordCount === 1) return 1000;
  if (wordCount === 2) return 500;
  return 200;
}

function generateRecommendations(article: EnhancedArticle): string[] {
  const recommendations = [];

  if (article.contentScore < 70) {
    recommendations.push(
      "Consider adding more subheadings and detailed examples"
    );
  }

  if (article.keywordDensity < 1) {
    recommendations.push(
      "Increase keyword density naturally throughout the content"
    );
  }

  if (article.wordCount < 1800) {
    recommendations.push(
      `Expand content to reach optimal SEO word count (1800+ words). Current: ${article.wordCount} words`
    );
  }

  return recommendations.length > 0
    ? recommendations
    : ["Content is optimized and ready for immediate publishing!"];
}
