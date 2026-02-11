export interface ArticleRequest {
  keyword?: string;
  keywords?: string[];
  websiteId?: string;
  userId: string;
  targetWordCount?: number;
  articleNumber?: number;
  totalArticles?: number;
  jobId?: string;
  generateImages?: boolean;
  imageCount?: number;
}

export interface EnhancedArticle {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  readingTime: string;
  wordCount: number;
  contentScore: number;
  keywordDensity: number;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  tags: string[];
  category: string;
  generatedAt: string;
  estimatedTraffic?: number;
  generatedImages?: string[];
}

// Request validation
export function validateRequestBody(body: ArticleRequest) {
  // Normalize keywords: accept ['kw','kw2'] or [{keyword:'kw'},{keyword:'kw2'}]
  const rawKeywords = body.keywords || (body.keyword ? [body.keyword] : []);
  const keywords = (rawKeywords || [])
    .map((kw: any) => {
      if (!kw && kw !== 0) return null;
      if (typeof kw === 'string') return kw;
      if (typeof kw === 'object' && kw.keyword) return String(kw.keyword);
      // Fallback: try toString
      try {
        return String(kw);
      } catch {
        return null;
      }
    })
    .filter((k: string | null) => typeof k === 'string' && k.trim().length > 0) as string[];

  const {
    websiteId,
    userId,
    targetWordCount = 2000,
    articleNumber = 1,
    totalArticles = 1,
    generateImages = true,
    imageCount = 2,
  } = body;

  if (keywords.length === 0) {
    throw new Error('At least one keyword is required.');
  }

  if (!userId) {
    throw new Error('User ID is required.');
  }

  return { keywords, websiteId, userId, targetWordCount, articleNumber, totalArticles, generateImages, imageCount };
}

// Prompt builder
export function buildArticlePrompt(selectedKeywordRaw: any, allKeywordsText: string, targetWordCount: number, articleNumber: number, totalArticles: number) {
  // Normalize the selected keyword into text + optional metadata
  let selectedKeywordText = '';
  let selectedKeywordDesc = '';
  if (!selectedKeywordRaw) {
    selectedKeywordText = '';
  } else if (typeof selectedKeywordRaw === 'string') {
    selectedKeywordText = selectedKeywordRaw;
  } else if (typeof selectedKeywordRaw === 'object') {
    selectedKeywordText = (selectedKeywordRaw.keyword || selectedKeywordRaw.name || selectedKeywordRaw.text || '').toString();
    selectedKeywordDesc = (selectedKeywordRaw.description || selectedKeywordRaw.desc || selectedKeywordRaw.note || '').toString();
  }

  const variationInstructions =
    totalArticles > 1
      ? `\n\nIMPORTANT: This is article ${articleNumber} of ${totalArticles}. Create a UNIQUE variation with a different angle, perspective, or approach. Use different examples, structure, and content flow. Avoid repeating previous article variations.`
      : '';

  return `You are an expert SEO content strategist and writer.

Your task: Write a **high-performing SEO article** focused on the selected keyword and any metadata provided.

Selected keyword (primary focus): → ${selectedKeywordText}
${selectedKeywordDesc ? `Selected keyword description / note: → ${selectedKeywordDesc}\n` : ''}

Secondary / related keywords available: → ${allKeywordsText}

IMPORTANT EDITORIAL RULES (READ CAREFULLY):
- **Do NOT** reuse example placeholders or sample keywords from the prompt (for example "Lahore") verbatim in the article **unless** the selected keyword or its metadata explicitly indicates that the keyword is location-specific or contextually requires that value. If the selected keyword is a short single-word proper noun and there is no metadata indicating location, do not treat it as a location.
- Start with a **unique one-line hook** (not a generic template like "In this article..." or "This guide covers..."). The hook must be original and attention-grabbing.
- Avoid repetitive, templated openings and avoid repeating the same examples across articles. Vary the angle, examples, and lead-in sentences to ensure distinctiveness.
- Create one concise, creative **SEO_TITLE** (55–60 characters) that naturally includes the selected keyword and is not a generic template. Then derive a short, unique URL_SLUG (lowercase, hyphen-separated, no trailing hyphens, max 60 chars) from that title.
- Do not overuse the keyword in the first 200 words; keep usage natural and avoid keyword stuffing.
- If keyword metadata provides intent or user context, use it to choose specific examples, case studies, or industry-relevant hooks.
- Ensure the article feels fresh and original — prefer specific actionable frameworks, unique examples, or data-driven hooks over generic lists.

Target reader:
→ General web audience interested in ${selectedKeywordText}

Business goal:
→ Comprehensive guide that drives organic traffic and positions the site as an authority

Primary keyword:
→ "${selectedKeywordText}"

Target length:
→ ${targetWordCount}–${Math.floor(targetWordCount * 1.3)} words

Writing style:
→ Clear, practical, friendly but expert, no fluff, natural and human-written${
    totalArticles > 1
      ? ', UNIQUE angle different from previous articles'
      : ''
  }

---

## THINK FIRST (SEARCH INTENT + ANGLE)

Before writing, apply these principles:

- Use the keyword description (if provided) to infer search intent and the most useful examples or sections.
- Determine the **dominant search intent** for "${selectedKeywordText}" (informational, commercial investigation, etc.).
- Select the best **content type** (guide, how-to, comparison, checklist).
- Choose the main **content angle** (for beginners, step-by-step, 2026 updated, practical framework).
- Align structure, depth, and examples to **fully satisfy** that intent.
- Cover all key subtopics competitors usually hit for this keyword.

Do not show this reasoning, just apply it in the article.

---

## OUTPUT FORMAT - CRITICAL

Output EXACTLY in this format:

SEO_TITLE: [55-60 character title including "${selectedKeywordText}"]
URL_SLUG: /[short-keyword-phrase]
META_DESCRIPTION: [150-160 character description including "${selectedKeywordText}"]

[Full article content below - NO EM DASHES, NO <m> TAGS, MUST BE ${targetWordCount}+ WORDS]

---

## ARTICLE STRUCTURE (HTML HIERARCHY)

Use **HTML tags** with proper hierarchy:
- **<h1>**: Main title/heading (only one)
- **<h2>**: Main sections (5-7 sections)
- **<h3>**: Subsections under H2s
- **<p>**: Body paragraphs (2-4 sentences each)
- **<ul>**: Bulleted lists for tips/features
- **<ol>**: Numbered lists for steps
- **<li>**: List items
- **<strong>**: Bold emphasis for key terms
- **<em>**: Italic emphasis
- **<table>**: For comparisons (if needed)

NEVER USE: <m>, </m>, em dashes (—), or any other special tags.

${variationInstructions}
`;
}

// Fetch keywords for a website ID and normalize to string[]
export async function fetchKeywordsFromWebsite(supabase: any, websiteId: string): Promise<string[]> {
  if (!websiteId) return [];
  try {
    const { data: websiteData, error } = await supabase
      .from('websites')
      .select('keywords')
      .eq('id', websiteId)
      .single();

    if (error || !websiteData) {
      console.warn('fetchKeywordsFromWebsite: no website data', { websiteId, error });
      return [];
    }

    const raw = websiteData.keywords?.keywords ?? websiteData.keywords ?? [];
    const keywords = (Array.isArray(raw) ? raw : []).map((kw: any) => {
      if (!kw && kw !== 0) return null;
      if (typeof kw === 'string') return kw;
      if (typeof kw === 'object' && kw.keyword) return String(kw.keyword);
      try { return String(kw); } catch { return null; }
    }).filter((k: any) => typeof k === 'string' && k.trim().length > 0) as string[];

    return keywords;
  } catch (err) {
    console.error('fetchKeywordsFromWebsite error:', err);
    return [];
  }
}

// ========== Structured response parsing & metadata ==========
export function parseStructuredResponse(response: string, keyword: string) {
  const seoTitleMatch = response.match(/SEO_TITLE:\s*(.+?)(?:\n|$)/);
  const metaDescMatch = response.match(/META_DESCRIPTION:\s*(.+?)(?:\n|$)/);

  // Extract content - everything after META_DESCRIPTION line, skipping the separator line
  const metaDescIndex = response.indexOf('META_DESCRIPTION:');
  let content = '';

  if (metaDescIndex !== -1) {
    const endOfMetaDesc = response.indexOf('\n', metaDescIndex);
    if (endOfMetaDesc !== -1) {
      const afterMetaDesc = response.substring(endOfMetaDesc + 1);
      const separatorIndex = afterMetaDesc.indexOf('---');
      if (separatorIndex !== -1) {
        content = afterMetaDesc.substring(separatorIndex + 3).trim();
      } else {
        content = afterMetaDesc.trim();
      }
    }
  }

  if (!content) {
    const contentMatch = response.match(/CONTENT:\s*([\s\S]*?)(?=META_TITLE:|$)/);
    content = contentMatch ? contentMatch[1].trim() : response;
  }

  // Normalize dashes
  content = content.replace(/—/g, ' - ').replace(/–/g, ' - ').replace(/―/g, ' - ');

  const metaTitle = seoTitleMatch
    ? seoTitleMatch[1].trim()
    : (response.match(/META_TITLE:\s*(.+)/) ? response.match(/META_TITLE:\s*(.+)/)![1].trim() : generateFallbackMetaTitle(keyword));

  const metaDescription = metaDescMatch
    ? metaDescMatch[1].trim()
    : (response.match(/META_DESCRIPTION:\s*(.+)/) ? response.match(/META_DESCRIPTION:\s*(.+)/)![1].trim() : generateFallbackMetaDescription(keyword));

  const ogTitleMatch = response.match(/OG_TITLE:\s*(.+)/);
  const ogDescMatch = response.match(/OG_DESCRIPTION:\s*(.+)/);

  return {
    content,
    metaTitle,
    metaDescription,
    slug: generateSlugFromTitle(metaTitle),
    ogTitle: ogTitleMatch ? ogTitleMatch[1].trim() : generateFallbackOgTitle(keyword),
    ogDescription: ogDescMatch ? ogDescMatch[1].trim() : generateFallbackOgDescription(keyword),
  };
}

export function generateEnhancedMetadata(parsedData: any, keyword: string, targetWordCount: number): EnhancedArticle {
  const content = parsedData.content;
  const wordCount = content.split(/\s+/).length;
  const titleCandidate = extractMainTitle(content) || parsedData.metaTitle || parsedData.ogTitle || keyword;
  const title = titleCandidate;

  return {
    title,
    content: content,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription,
    slug: generateSlugFromTitle(title),
    focusKeyword: keyword,
    readingTime: calculateReadingTime(wordCount),
    wordCount,
    contentScore: calculateContentScore(content, keyword, targetWordCount),
    keywordDensity: calculateKeywordDensity(content, keyword),
    ogTitle: parsedData.ogTitle,
    ogDescription: parsedData.ogDescription,
    twitterTitle: parsedData.ogTitle,
    twitterDescription: parsedData.ogDescription,
    tags: generateTags(keyword),
    category: determineCategory(keyword),
    generatedAt: new Date().toISOString(),
    estimatedTraffic: estimateTrafficPotential(keyword),
  };
}

function calculateContentScore(content: string, keyword: string, targetWordCount: number): number {
  let score = 50;
  const wordCount = content.split(/\s+/).length;

  if (wordCount >= targetWordCount) score += 25;
  else if (wordCount >= 1800) score += 20;
  else if (wordCount >= 1500) score += 15;
  else if (wordCount >= 1200) score += 10;
  else if (wordCount >= 1000) score += 5;

  if (content.includes('<h1>')) score += 5;
  if ((content.match(/<h2>/g) || []).length >= 3) score += 10;
  if ((content.match(/<h3>/g) || []).length >= 5) score += 10;

  if (content.toLowerCase().includes(keyword.toLowerCase())) score += 10;

  return Math.min(score, 100);
}

function generateSlugFromTitle(title: string): string {
  const base = (title || 'article').toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 60);
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

function calculateKeywordDensity(content: string, keyword: string): number {
  const words = content.toLowerCase().split(/\s+/);
  const keywordCount = words.filter((word) => word.includes(keyword.toLowerCase())).length;
  return Number(((keywordCount / words.length) * 100).toFixed(2));
}

function generateTags(keyword: string): string[] {
  const baseTags = [keyword];
  const relatedTerms = keyword.split(' ').slice(0, 3);
  return [...new Set([...baseTags, ...relatedTerms])].slice(0, 5);
}

function determineCategory(keyword: string): string {
  const lowerKeyword = (keyword || '').toLowerCase();

  if (lowerKeyword.includes('workout') || lowerKeyword.includes('fitness') || lowerKeyword.includes('exercise')) return 'fitness';
  if (lowerKeyword.includes('marketing') || lowerKeyword.includes('seo') || lowerKeyword.includes('social')) return 'marketing';
  if (lowerKeyword.includes('money') || lowerKeyword.includes('finance') || lowerKeyword.includes('investment')) return 'finance';
  if (lowerKeyword.includes('health') || lowerKeyword.includes('diet') || lowerKeyword.includes('nutrition')) return 'health';
  if (lowerKeyword.includes('tech') || lowerKeyword.includes('ai') || lowerKeyword.includes('software')) return 'technology';
  return 'general';
}

function estimateTrafficPotential(keyword: string): number {
  const wordCount = keyword.split(' ').length;
  if (wordCount === 1) return 1000;
  if (wordCount === 2) return 500;
  return 200;
}

export function generateRecommendations(article: EnhancedArticle): string[] {
  const recommendations: string[] = [];

  if (article.contentScore < 70) {
    recommendations.push('Consider adding more subheadings and detailed examples');
  }

  if (article.keywordDensity < 1) {
    recommendations.push('Increase keyword density naturally throughout the content');
  }

  if (article.wordCount < 1800) {
    recommendations.push(`Expand content to reach optimal SEO word count (1800+ words). Current: ${article.wordCount} words`);
  }

  return recommendations.length > 0 ? recommendations : ['Content is optimized and ready for immediate publishing!'];
}

// Save article to DB is left in helpers or can be imported from here if preferred
export async function saveArticleToDatabase(
  supabase: any,
  article: EnhancedArticle,
  userId: string,
  websiteId?: string,
  generatedImages: string[] = []
) {
  const baseSlug = (article.slug || generateSlugFromTitle(article.title || 'article')).substring(0, 60);

  // Try multiple times to avoid unique slug conflict by appending a numeric suffix
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`.substring(0, 60);

    console.log(`Attempting to save article with slug: ${candidateSlug} (attempt ${attempt + 1})`);

    const { data: savedArticle, error: dbError } = await supabase
      .from('articles')
      .insert({
        title: article.title,
        content: article.content,
        keyword: article.focusKeyword,
        status: 'draft',
        date: new Date().toISOString().split('T')[0],
        preview: article.metaDescription || article.content.substring(0, 150) + '...',
        meta_title: article.metaTitle,
        meta_description: article.metaDescription,
        slug: candidateSlug,
        reading_time: article.readingTime,
        word_count: article.wordCount,
        content_score: article.contentScore,
        keyword_density: article.keywordDensity,
        og_title: article.ogTitle,
        og_description: article.ogDescription,
        twitter_title: article.twitterTitle,
        twitter_description: article.twitterDescription,
        tags: article.tags,
        category: article.category,
        estimated_traffic: article.estimatedTraffic,
        generated_images: generatedImages,
        ...(websiteId && { website_id: websiteId }),
        user_id: userId,
      })
      .select()
      .single();

    if (!dbError && savedArticle) {
      return savedArticle;
    }

    // If the error is about duplicate slug, retry with a different suffix
    const msg = dbError?.message || '';
    if (msg.includes('duplicate key') && msg.includes('articles_slug_key')) {
      console.warn(`Slug conflict for "${candidateSlug}"; retrying with a new suffix`);
      // continue loop to retry
      continue;
    }

    // Otherwise, fail fast with the original database error
    throw new Error('Failed to save article to database: ' + (dbError?.message || 'Unknown error'));
  }

  throw new Error('Failed to save article to database: could not find a unique slug after multiple attempts');
}
