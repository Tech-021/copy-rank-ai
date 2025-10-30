import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ArticleRequest {
  keyword: string;
  websiteId?: string;
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
    
    const { keyword, websiteId } = body;

    if (!keyword) {
      return NextResponse.json(
        { error: "Keyword is required" },
        { status: 400 }
      );
    }

    const qwenApiKey = process.env.QWEN_API_KEY;
    if (!qwenApiKey) {
      return NextResponse.json(
        { error: "Qwen API key not configured" },
        { status: 500 }
      );
    }

    console.log("🚀 Generating enhanced article for:", keyword);

    // Hardcoded wordCount
    const wordCount = 1200;

    // Enhanced prompt for complete metadata generation
    const prompt = `Generate a comprehensive SEO-optimized blog post about "${keyword}".

CRITICAL REQUIREMENTS:

1. MAIN CONTENT (${wordCount} words):
- Write engaging, well-researched content
- Use proper HTML structure with <h2> and <h3> headings
- Include practical tips, examples, and actionable advice
- Natural keyword integration (1-2% density)
- Conclusion with key takeaways

2. METADATA (Generate these EXACTLY as specified):
- META_TITLE: Create a compelling title (55-60 characters) that includes the main keyword
- META_DESCRIPTION: Write a click-worthy description (150-160 characters) that encourages clicks
- OG_TITLE: Create a social media optimized title (with emoji if appropriate)
- OG_DESCRIPTION: Social media friendly description (120-130 characters)

3. STRUCTURE:
- Start with engaging introduction
- 3-5 main sections with subheadings
- Use bullet points or numbered lists where appropriate
- End with strong conclusion

Please format your response EXACTLY as:

CONTENT:
[Your full article content here with HTML tags]

META_TITLE: [Optimized title 55-60 chars]
META_DESCRIPTION: [Compelling description 150-160 chars]
OG_TITLE: [Social media title with emoji]
OG_DESCRIPTION: [Social media description 120-130 chars]`;

    const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${qwenApiKey}`,
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages: [
          {
            role: "system",
            content: "You are an expert SEO content strategist. Create engaging, well-structured blog posts with perfect metadata for immediate publishing."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }),
    });

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
    const parsedData = parseStructuredResponse(fullResponse, keyword);
    
    // Generate enhanced metadata
    const enhancedArticle = generateEnhancedMetadata(parsedData, keyword);

    // Save to Supabase
    const { data: savedArticle, error: dbError } = await supabase
      .from('articles')
      .insert({
        title: enhancedArticle.title,
        content: enhancedArticle.content,
        keyword: keyword,
        status: 'draft',
        date: new Date().toISOString().split('T')[0],
        preview: enhancedArticle.metaDescription || enhancedArticle.content.substring(0, 150) + '...',
        
        // SEO Metadata
        meta_title: enhancedArticle.metaTitle,
        meta_description: enhancedArticle.metaDescription,
        slug: enhancedArticle.slug,
        focus_keyword: enhancedArticle.focusKeyword,
        
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
        
        // Associate with website if provided
        ...(websiteId && { website_id: websiteId })
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save article to database');
    }

    console.log("✅ Enhanced article generated and saved to Supabase");

    return NextResponse.json({
      success: true,
      article: {
        ...enhancedArticle,
        id: savedArticle.id,
        status: savedArticle.status,
        date: savedArticle.date
      },
      analysis: {
        seoReady: enhancedArticle.contentScore >= 70,
        immediatePublish: true,
        recommendations: generateRecommendations(enhancedArticle)
      }
    });

  } catch (error) {
    console.error("💥 Enhanced article generation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate enhanced article",
        details: error instanceof Error ? error.message : "Unknown error"
      },
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
    metaTitle: metaTitleMatch ? metaTitleMatch[1].trim() : generateFallbackMetaTitle(keyword),
    metaDescription: metaDescMatch ? metaDescMatch[1].trim() : generateFallbackMetaDescription(keyword),
    ogTitle: ogTitleMatch ? ogTitleMatch[1].trim() : generateFallbackOgTitle(keyword),
    ogDescription: ogDescMatch ? ogDescMatch[1].trim() : generateFallbackOgDescription(keyword)
  };
}

function generateEnhancedMetadata(parsedData: any, keyword: string): EnhancedArticle {
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
    contentScore: calculateContentScore(content, keyword),
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
    estimatedTraffic: estimateTrafficPotential(keyword)
  };
}

// Metadata generation helpers
function generateSlug(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 60);
}

function generateFallbackMetaTitle(keyword: string): string {
  const currentYear = new Date().getFullYear();
  const baseTitle = `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - Complete Guide ${currentYear}`;
  return baseTitle.length > 60 ? baseTitle.substring(0, 57) + '...' : baseTitle;
}

function generateFallbackMetaDescription(keyword: string): string {
  const baseDesc = `Discover the best strategies and tips for ${keyword}. Learn everything you need to know in our comprehensive guide.`;
  return baseDesc.length > 160 ? baseDesc.substring(0, 157) + '...' : baseDesc;
}

function generateFallbackOgTitle(keyword: string): string {
  return `🚀 ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - Ultimate Guide`;
}

function generateFallbackOgDescription(keyword: string): string {
  return `Master ${keyword} with our expert guide. Get started today!`;
}

function extractMainTitle(content: string): string {
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) return h1Match[1];
  
  const firstH2Match = content.match(/<h2[^>]*>(.*?)<\/h2>/i);
  if (firstH2Match) return firstH2Match[1];
  
  return '';
}

function calculateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
}

function calculateContentScore(content: string, keyword: string): number {
  let score = 50; // Base score
  
  // Check for headings
  if (content.includes('<h2>')) score += 10;
  if (content.includes('<h3>')) score += 10;
  
  // Check keyword in title
  if (content.toLowerCase().includes(keyword.toLowerCase())) score += 10;
  
  // Check content length
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 800) score += 10;
  if (wordCount > 1200) score += 10;
  
  return Math.min(score, 100);
}

function calculateKeywordDensity(content: string, keyword: string): number {
  const words = content.toLowerCase().split(/\s+/);
  const keywordCount = words.filter(word => word.includes(keyword.toLowerCase())).length;
  return Number(((keywordCount / words.length) * 100).toFixed(2));
}

function generateTags(keyword: string): string[] {
  const baseTags = [keyword];
  const relatedTerms = keyword.split(' ').slice(0, 3);
  return [...new Set([...baseTags, ...relatedTerms])].slice(0, 5);
}

function determineCategory(keyword: string): string {
  // Simple category detection based on keyword
  const lowerKeyword = keyword.toLowerCase();
  
  if (lowerKeyword.includes('workout') || lowerKeyword.includes('fitness') || lowerKeyword.includes('exercise')) {
    return 'fitness';
  } else if (lowerKeyword.includes('marketing') || lowerKeyword.includes('seo') || lowerKeyword.includes('social')) {
    return 'marketing';
  } else if (lowerKeyword.includes('money') || lowerKeyword.includes('finance') || lowerKeyword.includes('investment')) {
    return 'finance';
  } else if (lowerKeyword.includes('health') || lowerKeyword.includes('diet') || lowerKeyword.includes('nutrition')) {
    return 'health';
  } else if (lowerKeyword.includes('tech') || lowerKeyword.includes('ai') || lowerKeyword.includes('software')) {
    return 'technology';
  } else {
    return 'general';
  }
}

function estimateTrafficPotential(keyword: string): number {
  // Simple estimation based on keyword characteristics
  const wordCount = keyword.split(' ').length;
  if (wordCount === 1) return 1000;
  if (wordCount === 2) return 500;
  return 200;
}

function generateRecommendations(article: EnhancedArticle): string[] {
  const recommendations = [];
  
  if (article.contentScore < 70) {
    recommendations.push("Consider adding more subheadings and examples");
  }
  
  if (article.keywordDensity < 1) {
    recommendations.push("Increase keyword density naturally throughout the content");
  }
  
  if (article.wordCount < 800) {
    recommendations.push("Expand content to reach optimal word count (1200+ words)");
  }
  
  return recommendations.length > 0 ? recommendations : ["Content is ready for immediate publishing!"];
}