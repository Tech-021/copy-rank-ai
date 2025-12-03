import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserArticleLimit } from "@/lib/articleLimits";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Set max duration for Pro plan (60 seconds)
export const maxDuration = 800;

interface ArticleRequest {
  keyword?: string;
  keywords?: string[];
  websiteId?: string;
  userId: string;
  targetWordCount?: number;
  articleNumber?: number;
  totalArticles?: number;
  jobId?: string;
  generateImages?: boolean; // NEW: Flag to enable image generation
  imageCount?: number; // NEW: Number of images to generate
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

  // NEW: Image URLs
  generatedImages?: string[];
}

// NEW: Image generation function
async function generateImagesForArticle(
  content: string,
  title: string,
  keywords: string[],
  count: number = 2
): Promise<string[]> {
  try {
    console.log(`🖼️ Generating ${count} images for article...`);

    const imagePrompts = extractImagePromptsFromContent(
      content,
      title,
      keywords
    );

    const images: string[] = [];

    // Generate multiple images based on extracted prompts
    for (let i = 0; i < Math.min(count, imagePrompts.length); i++) {
      let prompt = imagePrompts[i];
      
      // ========== ADD TEXT PREVENTION ==========
      // Add instructions to avoid text in images
      prompt = `${prompt}. NO TEXT, NO WORDS, NO LETTERS, NO HEADINGS, NO TYPOGRAPHY, NO WRITING, NO LOGOS WITH TEXT. Pure illustration only, no textual elements.`;
      // ========== END TEXT PREVENTION ==========
      
      console.log(`📸 Generating image ${i + 1} with prompt: "${prompt.substring(0, 100)}..."`);

      const imageResponse = await fetch(
        `${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/api/image-generation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt,
            size: "1328*1328",
            n: 1,
            // ========== ADD NEGATIVE PROMPT ==========
            negative_prompt: "text, words, letters, typography, writing, headings, titles, captions, logos with text, watermarks, signatures, written text, numbers, symbols, characters, fonts, calligraphy",
            // ========== END NEGATIVE PROMPT ==========
          }),
        }
      );

      if (!imageResponse.ok) {
        console.error(`❌ Image generation failed for prompt: ${prompt}`);
        continue;
      }

      const imageData = await imageResponse.json();

      if (imageData.ok && imageData.images && imageData.images.length > 0) {
        images.push(imageData.images[0]);
        console.log(`✅ Image ${i + 1} generated successfully`);
      }
    }

    return images;
  } catch (error) {
    console.error("💥 Image generation error:", error);
    return [];
  }
}

// NEW: Extract relevant image prompts from article content
function extractImagePromptsFromContent(
  content: string,
  title: string,
  keywords: string[]
): string[] {
  const prompts: string[] = [];

  // Remove HTML tags for cleaner text processing
  const cleanContent = content.replace(/<[^>]*>/g, " ");

  // Extract main sections (looking for headings and key paragraphs)
  const sections = cleanContent
    .split(/\n+/)
    .filter(
      (section) => section.trim().length > 50 && section.split(" ").length > 10
    );

  // Create prompts based on different strategies

  // 1. Main concept prompt based on title and keywords
  const mainConceptPrompt = `Professional digital illustration, ${title}. ${keywords.join(
    ", "
  )}. Clean, modern, professional blog style, high quality, detailed`;
  prompts.push(mainConceptPrompt);

  // 2. Extract key concepts from first substantial paragraph
  if (sections.length > 0) {
    const firstSection = sections[0].substring(0, 200);
    const sectionPrompt = `Digital illustration concept: ${firstSection}. Professional blog style, clear, engaging visual`;
    prompts.push(sectionPrompt);
  }

  // 3. Create prompt from middle section for variety
  if (sections.length > 2) {
    const middleIndex = Math.floor(sections.length / 2);
    const middleSection = sections[middleIndex].substring(0, 150);
    const middlePrompt = `Concept art: ${middleSection}. Professional illustration, blog content visual`;
    prompts.push(middlePrompt);
  }

  // 4. Generic fallback prompts based on category
  const category = determineCategory(keywords[0]);
  const categoryPrompts = {
    fitness:
      "Professional fitness illustration, active lifestyle, health and wellness, modern graphic style",
    marketing:
      "Digital marketing concept, business growth, analytics, modern professional illustration",
    finance:
      "Financial growth concept, money management, investment strategies, professional business illustration",
    health:
      "Health and wellness concept, balanced lifestyle, nutrition, professional medical illustration",
    technology:
      "Modern technology concept, innovation, digital transformation, clean tech illustration",
    general:
      "Professional blog illustration, content creation, engaging visual concept",
  };

  prompts.push(categoryPrompts[category] || categoryPrompts.general);

  // Ensure we have unique prompts
  return [...new Set(prompts)].slice(0, 4);
}

export async function POST(request: Request) {
  let jobId: string | undefined;

  try {
    const body: ArticleRequest = await request.json();

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
    // Support both single keyword (backward compat) and multiple keywords
    const keywords = body.keywords || (body.keyword ? [body.keyword] : []);
    const {
      websiteId,
      userId,
      targetWordCount = 2000,
      articleNumber = 1,
      totalArticles = 1,
      generateImages = true, // Default to false for backward compatibility
      imageCount = 2, // Default number of images
    } = body;
    jobId = body.jobId;
    console.log("🖼️ Image generation enabled:", generateImages);
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

    // Select a different keyword for each article
    const selectedKeywordIndex = (articleNumber - 1) % keywords.length;
    const selectedKeyword = keywords[selectedKeywordIndex];
    const allKeywordsText = keywords.join(", ");

    console.log(
      `🚀 Generating article ${articleNumber}/${totalArticles} with keywords:`,
      keywords
    );
    console.log(`📌 Selected keyword for meta title: "${selectedKeyword}"`);
    console.log(
      `🖼️ Image generation: ${generateImages ? "ENABLED" : "disabled"}`
    );

    // ... existing article generation code remains the same ...
    const variationInstructions =
      totalArticles > 1
        ? `\n\nIMPORTANT: This is article ${articleNumber} of ${totalArticles}. Create a UNIQUE variation that differs from the previous articles. Use a different angle, perspective, or approach while still incorporating all keywords naturally. Vary the structure, examples, and content flow to ensure each article is distinct and valuable.`
        : "";

const prompt = `Generate a comprehensive, in-depth SEO-optimized blog post that naturally incorporates ALL of these keywords: ${allKeywordsText}.${variationInstructions}

ALL KEYWORDS: ${allKeywordsText}
SELECTED KEYWORD FOR META TITLE: "${selectedKeyword}" (use this keyword in the meta title and description)

CRITICAL REQUIREMENTS - STRICTLY FOLLOW THESE RULES:

1. ABSOLUTELY NO EM DASHES (—):
- **DO NOT USE EM DASHES (—) ANYWHERE IN THE ARTICLE**
- **USE REGULAR DASHES (-) INSTEAD OF EM DASHES**
- **Example: Use "marketing - it's" NOT "marketing—it's"**
- **Example: Use "croissants - rich" NOT "croissants—rich"**
- **Use commas or parentheses for asides instead of em dashes**

2. NO HTML <m> TAGS:
- **DO NOT USE <m> TAGS ANYWHERE IN THE ARTICLE**
- **DO NOT USE <m> OR </m> IN ANY FORM**
- **ONLY USE STANDARD HTML TAGS: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>**
- If you need to emphasize text, use <strong> or <em> tags instead

3. HUMAN-LIKE WRITING STYLE:
- Write in a natural, conversational tone that sounds human-written
- Avoid AI-sounding phrases like "In conclusion", "Moreover", "Furthermore" at the start of sentences
- Use contractions: you're, it's, don't, can't, won't, etc.
- Ask rhetorical questions to engage readers
- Share personal insights and opinions
- Vary sentence length and structure
- Include storytelling elements and real-world examples

4. MAIN CONTENT (${targetWordCount}+ WORDS):
- Write detailed, comprehensive content with ALL keywords naturally integrated
- Minimum ${targetWordCount} words for SEO optimization
- Use ONLY standard HTML structure with <h1>, <h2>, <h3> headings
- Include examples, case studies, actionable advice
- Natural keyword density: 1-2% for "${selectedKeyword}", others mentioned naturally
- No keyword stuffing - content must flow naturally
- Comprehensive conclusion with practical takeaways
${
  totalArticles > 1
    ? "- Create unique angle different from previous articles"
    : ""
}

5. CONTENT STRUCTURE:
- Engaging introduction with hook (150-200 words)
- Background and context (200-300 words)
- 5-7 main sections with subsections (each 250-400 words)
- Include statistics, research, expert opinions
- Add step-by-step guides, checklists, practical applications
- Use bullet points (<ul>), numbered lists (<ol>), tables if relevant
- Comprehensive conclusion (200-250 words)
${
  totalArticles > 1
    ? "- Vary structure and examples for uniqueness"
    : ""
}

6. METADATA (Format EXACTLY as below):
- META_TITLE: Create compelling title (55-60 chars) with "${selectedKeyword}"
- META_DESCRIPTION: Click-worthy description (150-160 chars) with "${selectedKeyword}"
- OG_TITLE: Social media title with emoji
- OG_DESCRIPTION: Social media description (120-130 chars)

IMPORTANT: 
- **NO EM DASHES (—) - USE REGULAR DASHES (-)**
- **NO <m> TAGS - THIS IS NON-NEGOTIABLE**
- **Content must sound human-written, not AI-generated**
- **Use only standard HTML tags listed above**

Please format your response EXACTLY as:

CONTENT:
[Your full article content here - NO EM DASHES (—), NO <m> TAGS, ONLY standard HTML, MUST BE ${targetWordCount}+ WORDS]

META_TITLE: [Optimized title 55-60 chars with keyword "${selectedKeyword}"]
META_DESCRIPTION: [Compelling description 150-160 chars with keyword "${selectedKeyword}"]
OG_TITLE: [Social media title with emoji]
OG_DESCRIPTION: [Social media description 120-130 chars]`;

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Article generation timeout after 3 minutes")),
        180000
      );
    });

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
          messages: [
            {
              role: "system",
              content: `You are an expert SEO content strategist specializing in long-form, comprehensive articles. Create detailed, well-researched blog posts of ${targetWordCount}+ words that naturally incorporate multiple keywords. Focus on depth, practical value, and natural keyword integration without keyword stuffing.`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
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
    const parsedData = parseStructuredResponse(fullResponse, selectedKeyword);

    // Generate enhanced metadata
    const enhancedArticle = generateEnhancedMetadata(
      parsedData,
      selectedKeyword,
      targetWordCount
    );

    // NEW: Generate images if requested
    let generatedImages: string[] = [];
    if (generateImages) {
      console.log("🎨 Starting image generation...");
      generatedImages = await generateImagesForArticle(
        enhancedArticle.content,
        enhancedArticle.title,
        keywords,
        imageCount
      );
      enhancedArticle.generatedImages = generatedImages;
      console.log(`✅ Generated ${generatedImages.length} images`);
    }

    // Save to Supabase WITH user_id
    const { data: savedArticle, error: dbError } = await supabase
      .from("articles")
      .insert({
        title: enhancedArticle.title,
        content: enhancedArticle.content,
        keyword: keywords.join(", "),
        status: "draft",
        date: new Date().toISOString().split("T")[0],
        preview:
          enhancedArticle.metaDescription ||
          enhancedArticle.content.substring(0, 150) + "...",

        // SEO Metadata
        meta_title: enhancedArticle.metaTitle,
        meta_description: enhancedArticle.metaDescription,
        slug: enhancedArticle.slug,
        focus_keyword: selectedKeyword,

        // Content Analysis
        reading_time: enhancedArticle.readingTime,
        word_count: enhancedArticle.wordCount,
        content_score: enhancedArticle.contentScore,
        keyword_density: enhancedArticle.keywordDensity,

        // Social Media
        og_title: enhancedArticle.ogTitle,
        og_description: enhancedArticle.ogDescription,
        twitter_title: enhancedArticle.twitterTitle,
        twitter_description: enhancedArticle.twitterDescription,

        // Internal Organization
        tags: enhancedArticle.tags,
        category: enhancedArticle.category,

        // Technical
        estimated_traffic: enhancedArticle.estimatedTraffic,

        // NEW: Store generated images
        generated_images: generatedImages,

        // Associate with website if provided
        ...(websiteId && { website_id: websiteId }),

        // CRITICAL: Associate with user
        user_id: userId,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save article to database");
    }

    console.log(
      "✅ Enhanced article generated and saved to Supabase for user:",
      userId
    );
    console.log("📊 Final word count:", enhancedArticle.wordCount);
    if (generateImages) {
      console.log("🖼️ Images generated:", generatedImages.length);
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

function parseStructuredResponse(response: string, keyword: string) {
  const contentMatch = response.match(/CONTENT:\s*([\s\S]*?)(?=META_TITLE:|$)/);
  const metaTitleMatch = response.match(/META_TITLE:\s*(.+)/);
  const metaDescMatch = response.match(/META_DESCRIPTION:\s*(.+)/);
  const ogTitleMatch = response.match(/OG_TITLE:\s*(.+)/);
  const ogDescMatch = response.match(/OG_DESCRIPTION:\s*(.+)/);

  let content = contentMatch ? contentMatch[1].trim() : response;
  
  // ========== REMOVE EM DASHES (—) ==========
  console.log("🔄 Removing em dashes (—) from content...");
  
  // Count em dashes before removal
  const emDashCount = (content.match(/—/g) || []).length;
  console.log(`Found ${emDashCount} em dashes in content`);
  
  // Remove ALL em dashes (—)
  content = content.replace(/—/g, ' - ');
  
  // Also remove any other special dashes
  content = content.replace(/–/g, ' - '); // en dash
  content = content.replace(/―/g, ' - '); // horizontal bar
  
  // ========== END EM DASH REMOVAL ==========

  return {
    content: content,
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
