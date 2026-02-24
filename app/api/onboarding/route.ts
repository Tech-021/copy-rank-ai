export const runtime = "nodejs";
export const maxDuration = 300;
export const deploymentTarget = "v8-worker"; // Enables background tasks
export const maxRetries = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hybridScraper } from "@/app/api/scraper/route";
import { analyzeWithQwen } from "@/lib/qwen";
import { fetchKeywordOverview } from "@/lib/dataforseo";
import { getUserArticleLimit } from '@/lib/articleLimits';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OnboardingRequest {
  clientDomain: string;
  competitors?: string[]; // Array of 3 competitor URLs (optional for quick adds)
  targetKeywords?: string[]; // Optional, for frontend only
  userId: string;
  isQuickAdd?: boolean; // Flag to indicate quick add without competitors
}

interface CompetitorResult {
  domain: string;
  topic: string;
  keywords: any[];
  success: boolean;
  error?: string;
}

/**
 * Get the correct base URL for internal API calls
 * Uses localhost in development, otherwise uses NEXT_PUBLIC_SITE_URL
 */
function getInternalBaseUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Process a single competitor using the new flow:
 * 1) Call /api/relevant-pages to get the most important page
 * 2) Call /api/extract-keywords on that page URL
 * 3) Map the extracted keywords into the standard keyword shape
 */
async function processCompetitorWithRelevantPages(
  competitorUrl: string,
  baseUrl: string,
  token: string,
  keywordLimit: number
): Promise<CompetitorResult> {
  try {
    console.log(`🔍 [Onboarding] Fetching relevant pages for ${competitorUrl}`);

    const relevantRes = await fetch(`${baseUrl}/api/relevant-pages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        competitor: competitorUrl,
        limit: 10,
      }),
    });

    if (!relevantRes.ok) {
      const text = await relevantRes.text().catch(() => "");
      console.error(
        `❌ [Onboarding] relevant-pages failed for ${competitorUrl}:`,
        relevantRes.status,
        text
      );
      return {
        domain: competitorUrl,
        topic: "Unknown",
        keywords: [],
        success: false,
        error: `relevant-pages failed with status ${relevantRes.status}`,
      };
    }

    const relevantJson: any = await relevantRes.json();
    const topPage = relevantJson.pages?.[0];

    if (!topPage || (!topPage.url && !topPage.page_address)) {
      console.warn(`⚠️ [Onboarding] No relevant pages returned for ${competitorUrl}`);
      return {
        domain: competitorUrl,
        topic: "Unknown",
        keywords: [],
        success: false,
        error: "No relevant pages found",
      };
    }

    const pageUrl = topPage.url || topPage.page_address;
    const pageTitle = topPage.title || relevantJson.target || competitorUrl;

    console.log(
      `🔗 [Onboarding] Using top relevant page for ${competitorUrl}: ${pageUrl}`
    );

    const extractRes = await fetch(`${baseUrl}/api/extract-keywords`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: pageUrl,
        limit: keywordLimit,
      }),
    });

    if (!extractRes.ok) {
      const text = await extractRes.text().catch(() => "");
      console.error(
        `❌ [Onboarding] extract-keywords failed for ${pageUrl}:`,
        extractRes.status,
        text
      );
      return {
        domain: competitorUrl,
        topic: pageTitle,
        keywords: [],
        success: false,
        error: `extract-keywords failed with status ${extractRes.status}`,
      };
    }

    const extractJson: any = await extractRes.json();
    const rawKeywords = Array.isArray(extractJson.keywords)
      ? extractJson.keywords
      : [];

    console.log(
      `✅ [Onboarding] Got ${rawKeywords.length} keywords from extract-keywords for ${competitorUrl}`
    );

    // Map extract-keywords result into the same shape used by the rest of the app
    const transformedKeywords = rawKeywords
      .map((k: any) => ({
        keyword: String(k.keyword || "").trim(),
        search_volume: k.frequency || 0, // use frequency as "volume" surrogate
        difficulty: null,
        cpc: null,
        competition: null,
        source: "relevant_page",
      }))
      .filter((k: any) => k.keyword);

    return {
      domain: competitorUrl,
      topic: pageTitle,
      keywords: transformedKeywords,
      success: true,
    };
  } catch (error) {
    console.error(
      `❌ [Onboarding] Error in processCompetitorWithRelevantPages for ${competitorUrl}:`,
      error
    );
    return {
      domain: competitorUrl,
      topic: "Unknown",
      keywords: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function normalizeUrl(websiteUrl: string): string | null {
  if (!websiteUrl) return null;

  const cleanDomain = websiteUrl
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split("/")[0];

  return `https://www.${cleanDomain}`;
}

async function generateArticlesAutomatically(
  keywords: any[],
  websiteId: string,
  userId: string,
  totalArticles?: number
): Promise<void> {
  try {
    // Get user's package limit if totalArticles not provided
    const userLimit = await getUserArticleLimit(userId);
    const finalArticleCount = totalArticles ? Math.min(totalArticles, userLimit) : userLimit;

    console.log(`\n🚀 Starting automatic article generation in background...`);
    console.log(
      `📝 Generating ${finalArticleCount} articles (package limit: ${userLimit}) with ${keywords.length} keywords`
    );

    // Extract keyword strings from keyword objects
    const keywordStrings = keywords
      .map((kw) => (typeof kw === "string" ? kw : kw.keyword))
      .filter((kw) => kw && kw.trim() !== "");

    if (keywordStrings.length === 0) {
      console.warn("⚠️ No valid keywords found for article generation");
      return;
    }

    console.log(
      `✅ Extracted ${keywordStrings.length} keywords for article generation`
    );

    // Construct the base URL for internal API calls
    // In production, use the actual domain, in development use localhost
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}`
      : "http://localhost:3000";

    console.log(`🌐 Using base URL: ${baseUrl}`);

    // Generate articles in background (up to package limit)
    for (let i = 0; i < finalArticleCount; i++) {
      const articleNumber = i + 1;

      try {
        console.log(
          `📄 Triggering article ${articleNumber}/${finalArticleCount}...`
        );

        // 🔥 Fire-and-forget request
        fetch(`${baseUrl}/api/test-generate-article`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            keywords: keywordStrings,
            userId,
            websiteId,
            articleNumber,
            totalArticles: finalArticleCount,
            targetWordCount: 2000,
          }),
        }).catch((err) => {
          console.error(
            `❌ Fire request failed for article ${articleNumber}`,
            err
          );
        });

        console.log(`🚀 Streaming started for article ${articleNumber}`);

        // Optional: slight delay between firing next stream
        await new Promise((res) => setTimeout(res, 300));
      } catch (error) {
        console.error(`❌ Error triggering article ${articleNumber}:`, error);
      }
    }

    console.log(
      `\n✅ Background article generation complete for website ${websiteId}`
    );
  } catch (error) {
    console.error("💥 Error in automatic article generation:", error);
  }
}

export async function POST(request: Request) {
  try {
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
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user || !user.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: OnboardingRequest = await request.json();

    const { clientDomain, competitors, targetKeywords, userId, isQuickAdd } = body;

    // Verify that the userId matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    // Normalize competitor input to an array early for consistent length checks
    const competitorList: string[] = Array.isArray(competitors)
      ? competitors
      : competitors
        ? [competitors]
        : [];

    // Treat fewer than 3 competitors as quick-add mode automatically
    const quickMode = isQuickAdd || competitorList.length < 3;

    // Validation
    if (!clientDomain) {
      return NextResponse.json(
        { error: "Client domain is required" },
        { status: 400 }
      );
    }

    // For full onboarding, require exactly 3 competitors
    // For quick adds (explicit or auto when <3 competitors), allow fewer
    if (!quickMode) {
      if (competitorList.length !== 3) {
        return NextResponse.json(
          { error: "Exactly 3 competitors are required" },
          { status: 400 }
        );
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Normalize client domain
    const normalizedClientDomain = normalizeUrl(clientDomain);
    if (!normalizedClientDomain) {
      return NextResponse.json(
        { error: "Invalid client domain" },
        { status: 400 }
      );
    }

    // Normalize competitor URLs (only if provided)
    let normalizedCompetitors: string[] = [];
    if (competitorList && competitorList.length > 0) {
      normalizedCompetitors = competitorList
        .map((comp) => normalizeUrl(comp))
        .filter(Boolean) as string[];
      if (!quickMode && normalizedCompetitors.length !== 3) {
        return NextResponse.json(
          { error: "Failed to normalize one or more competitor URLs" },
          { status: 400 }
        );
      }
    }

    console.log("🚀 Starting onboarding process...");
    console.log("📋 Client domain (normalized):", normalizedClientDomain);
    console.log("📋 Quick add mode:", quickMode);
    if (normalizedCompetitors.length > 0) {
      console.log("📋 Competitors (normalized):", normalizedCompetitors);
    }

    // STEP 1: Find topic for client domain (NO keywords)
    console.log("🔍 Step 1: Finding topic for client domain...");
    let clientTopic = "General";

    try {
      const clientScrape = await hybridScraper(normalizedClientDomain);
      if (clientScrape) {
        const clientAnalysis = await analyzeWithQwen(clientScrape);
        clientTopic = `${clientAnalysis.word} - ${clientAnalysis.intentPhrase}` || "General";
        console.log(`✅ Client analysis - Word: ${clientAnalysis.word}, Intent: ${clientAnalysis.intentPhrase}`);
      } else {
        console.warn("⚠️ Failed to scrape client domain, using default topic");
      }
    } catch (error) {
      console.error("❌ Error finding client topic:", error);
      // Continue with default topic
    }

    // STEP 2: Process each competitor using relevant-pages + extract-keywords
    console.log("🔍 Step 2: Processing competitors with relevant pages...");
    const competitorResults: CompetitorResult[] = [];
    const allKeywords: any[] = [];

    const baseUrl = getInternalBaseUrl();
    const keywordLimit = 100;

    if (normalizedCompetitors.length > 0) {
      for (let i = 0; i < normalizedCompetitors.length; i++) {
        const competitorUrl = normalizedCompetitors[i];
        console.log(
          `\n📊 Processing competitor ${i + 1}/${normalizedCompetitors.length}: ${competitorUrl}`
        );

        const result = await processCompetitorWithRelevantPages(
          competitorUrl,
          baseUrl,
          token,
          keywordLimit
        );

        competitorResults.push(result);

        if (
          result.success &&
          Array.isArray(result.keywords) &&
          result.keywords.length > 0
        ) {
          allKeywords.push(...result.keywords);
        }
      }
    } else {
      console.log(
        "ℹ️ No competitors provided - skipping automatic competitor keyword generation"
      );
    }

    // STEP 2.5: Process target keywords (NO filtering - explicit keywords)
    console.log("\n🔍 Step 2.5: Processing target keywords...");
    let targetKeywordData: any[] = [];

    if (targetKeywords && targetKeywords.length > 0) {
      // Filter out empty keywords
      const validTargetKeywords = targetKeywords.filter(
        (kw) => kw && kw.trim() !== ""
      );

      if (validTargetKeywords.length > 0) {
        try {
          console.log(
            `📋 Processing ${validTargetKeywords.length} target keywords:`,
            validTargetKeywords
          );

          // Call keyword overview API (processes keywords one by one internally)
          const overviewResults = await fetchKeywordOverview(
            validTargetKeywords
          );

          // NO filtering - use whatever data we get (explicit keywords)
          targetKeywordData = overviewResults.map((kw) => ({
            ...kw,
            is_target_keyword: true, // Flag to identify target keywords
          }));

          console.log(
            `✅ Retrieved data for ${targetKeywordData.length} target keywords`
          );
        } catch (error) {
          console.error("❌ Error processing target keywords:", error);
          // Continue even if target keywords fail
        }
      }
    } else {
      console.log("ℹ️ No target keywords provided");
    }

    // STEP 3: Merge competitor keywords + target keywords, then remove duplicates
    console.log("\n🔍 Step 3: Merging all keywords and removing duplicates...");

    // Combine competitor keywords + target keywords
    const allMergedKeywords = [...allKeywords, ...targetKeywordData];
    console.log(
      `📊 Total before deduplication: ${allKeywords.length} competitor + ${targetKeywordData.length} target = ${allMergedKeywords.length} total`
    );

    // Remove duplicate keywords (by keyword text, case-insensitive)
    const uniqueKeywords = allMergedKeywords.filter(
      (keyword, index, self) =>
        index ===
        self.findIndex(
          (k) => k.keyword.toLowerCase() === keyword.keyword.toLowerCase()
        )
    );
    console.log(
      `✅ Merged ${allMergedKeywords.length} total keywords → ${uniqueKeywords.length} unique keywords`
    );

    // STEP 4: Sort by search volume (highest first) and limit
    const finalKeywords = uniqueKeywords
      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, 100); // Limit to top 100 keywords (increased from 50)

    console.log(`✅ Final keyword count: ${finalKeywords.length}`);
    console.log(
      `   - Competitor keywords: ${
        finalKeywords.filter((k) => !k.is_target_keyword).length
      }`
    );
    console.log(
      `   - Target keywords: ${
        finalKeywords.filter((k) => k.is_target_keyword).length
      }`
    );

    // STEP 5: Save to database
    console.log("\n💾 Step 5: Saving to database...");

    // Prepare competitor data for the competitors column
    const competitorsData = competitorResults.map((c) => ({
      domain: c.domain,
      topic: c.topic,
      keywords: c.keywords,
      keywords_count: c.keywords.length,
      success: c.success,
      error: c.error || null,
    }));

    const insertData = {
      url: normalizedClientDomain, // Use normalized URL
      topic: clientTopic,
      keywords: {
        keywords: finalKeywords,
        competitors: competitorsData, // Save competitor data here
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          total_keywords: finalKeywords.length,
          total_competitors: competitorResults.length, // Update with actual count
          onboarding_data: {
            competitor_domains: normalizedCompetitors, // Use normalized URLs
            competitor_results: competitorResults.map((c) => ({
              domain: c.domain,
              topic: c.topic,
              keywords_count: c.keywords.length,
              success: c.success,
            })),
            target_keywords: targetKeywords || [],
          },
        },
      },
      // Add top-level competitors column if your schema has it
      competitors: competitorsData, // Save to top-level competitors column (jsonb)
      total_competitors: competitorResults.length, // Save to total_competitors column (int4)
      user_id: userId,
    };

    // Idempotency: check if this website already exists for this user (same normalized URL)
    let savedWebsite: any = null;
    try {
      const { data: existing, error: existingErr } = await supabase
        .from("websites")
        .select("*")
        .eq("user_id", userId)
        .eq("url", normalizedClientDomain)
        .maybeSingle(); // allow "no row" without throwing

      if (existingErr) {
        console.error("❌ Error checking existing website:", existingErr);
        throw existingErr;
      }

      if (existing) {
        console.log(
          "ℹ️ Website already exists for user, reusing existing record",
          existing.id
        );
        savedWebsite = existing;
      } else {
        const { data: inserted, error: dbError } = await supabase
          .from("websites")
          .insert([insertData])
          .select()
          .single();

        if (dbError) {
          console.error("❌ Database error on insert:", dbError);
          throw new Error("Failed to save to database");
        }

        savedWebsite = inserted;
        console.log("✅ Successfully saved to database", savedWebsite.id);
      }
    } catch (err) {
      console.error("❌ Database check/insert error:", err);
      throw err;
    }

    // STEP 6: Enqueue articles for generation
    console.log("\n🚀 Step 6: Enqueueing articles for generation...");

    const jobBaseUrl = getInternalBaseUrl();

    // Enqueue all articles as jobs - wait for response to ensure jobs are created
    // The enqueue endpoint will enforce package limits automatically
    try {
      // Get user's package limit to pass to enqueue
      const userLimit = await getUserArticleLimit(userId);
      
      const enqueueResponse = await fetch(`${jobBaseUrl}/api/article-jobs/enqueue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: finalKeywords,
          websiteId: savedWebsite.id,
          userId: userId,
          totalArticles: userLimit // Use package limit instead of hardcoded 30
        }),
      });

      if (!enqueueResponse.ok) {
        const errorData = await enqueueResponse.json().catch(() => ({}));
        console.error("💥 Error enqueueing articles:", errorData);
        throw new Error(`Failed to enqueue articles: ${JSON.stringify(errorData)}`);
      }

      const enqueueData = await enqueueResponse.json();
      console.log(`✅ Successfully enqueued ${enqueueData.jobCount || enqueueData.actual || 0} article jobs (package limit: ${enqueueData.packageLimit || userLimit})`);
    } catch (error) {
      console.error("💥 Error enqueueing articles:", error);
      // Don't fail the whole onboarding if enqueue fails - user can manually generate
      console.warn("⚠️ Continuing despite enqueue error - articles can be generated manually");
    }

    // Return response immediately
    return NextResponse.json({
      success: true,
      clientDomain: normalizedClientDomain, // Return normalized URL
      clientTopic,
      totalKeywords: finalKeywords.length,
      keywords: finalKeywords,
      competitorResults: competitorResults.map((c) => ({
        domain: c.domain,
        topic: c.topic,
        keywordsCount: c.keywords.length,
        success: c.success,
      })),
      websiteId: savedWebsite.id,
      message: `Onboarding completed successfully. Articles are queued for generation based on your package limit.`
    });
  } catch (error) {
    console.error("💥 Onboarding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Onboarding failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
