import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { hybridScraper } from "@/app/api/scraper/route";
import { analyzeWithQwen } from "@/lib/qwen";
import { fetchKeywordsFromDataForSEO, filterKeywords, fetchKeywordOverview } from "@/lib/dataforseo";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OnboardingRequest {
  clientDomain: string;
  competitors: string[]; // Array of 3 competitor URLs
  targetKeywords?: string[]; // Optional, for frontend only
  userId: string;
}

interface CompetitorResult {
  domain: string;
  topic: string;
  keywords: any[];
  success: boolean;
  error?: string;
}

async function generateArticlesAutomatically(
  keywords: any[],
  websiteId: string,
  userId: string,
  totalArticles: number = 30
): Promise<void> {
  try {
    console.log(`\n🚀 Starting automatic article generation in background...`);
    console.log(`📝 Generating ${totalArticles} articles with ${keywords.length} keywords`);
    
    // Extract keyword strings from keyword objects
    const keywordStrings = keywords.map(kw => 
      typeof kw === 'string' ? kw : kw.keyword
    ).filter(kw => kw && kw.trim() !== '');

    if (keywordStrings.length === 0) {
      console.warn("⚠️ No valid keywords found for article generation");
      return;
    }

    console.log(`✅ Extracted ${keywordStrings.length} keywords for article generation`);

    // Construct the base URL for internal API calls
    // In production, use the actual domain, in development use localhost
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    console.log(`🌐 Using base URL: ${baseUrl}`);

    // Generate articles in background
    for (let i = 0; i < totalArticles; i++) {
      const articleNumber = i + 1;
      
      try {
        console.log(`📄 Generating article ${articleNumber}/${totalArticles}...`);

        const response = await fetch(`${baseUrl}/api/test-generate-article`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keywords: keywordStrings,
            userId: userId,
            websiteId: websiteId,
            articleNumber: articleNumber,
            totalArticles: totalArticles,
            targetWordCount: 2000
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ Failed to generate article ${articleNumber}:`, errorData);
          continue; // Continue with next article even if one fails
        }

        const data = await response.json();
        if (data.success) {
          console.log(`✅ Generated article ${articleNumber}/${totalArticles}`);
        } else {
          console.error(`❌ Article ${articleNumber} generation failed:`, data.error);
        }

        // Small delay between requests to avoid rate limiting
        if (i < totalArticles - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error) {
        console.error(`❌ Error generating article ${articleNumber}:`, error);
        // Continue with next article even if one fails
      }
    }

    console.log(`\n✅ Background article generation complete for website ${websiteId}`);

  } catch (error) {
    console.error("💥 Error in automatic article generation:", error);
  }
}


export async function POST(request: Request) {
  try {
    const body: OnboardingRequest = await request.json();

    const { clientDomain, competitors, targetKeywords, userId } = body;

    // Validation
    if (!clientDomain) {
      return NextResponse.json(
        { error: "Client domain is required" },
        { status: 400 }
      );
    }

    if (!competitors || !Array.isArray(competitors) || competitors.length !== 3) {
      return NextResponse.json(
        { error: "Exactly 3 competitors are required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log("🚀 Starting onboarding process...");
    console.log("📋 Client domain:", clientDomain);
    console.log("📋 Competitors:", competitors);

    // STEP 1: Find topic for client domain (NO keywords)
    console.log("🔍 Step 1: Finding topic for client domain...");
    let clientTopic = "General";

    try {
      const clientScrape = await hybridScraper(clientDomain);
      if (clientScrape) {
        const clientAnalysis = await analyzeWithQwen(clientScrape);
        clientTopic = clientAnalysis.niche || "General";
        console.log(`✅ Client topic detected: ${clientTopic}`);
      } else {
        console.warn("⚠️ Failed to scrape client domain, using default topic");
      }
    } catch (error) {
      console.error("❌ Error finding client topic:", error);
      // Continue with default topic
    }

    // STEP 2: Process each competitor (find topic + keywords)
    console.log("🔍 Step 2: Processing competitors...");
    const competitorResults: CompetitorResult[] = [];
    const allKeywords: any[] = [];

    for (let i = 0; i < competitors.length; i++) {
      const competitorUrl = competitors[i];
      console.log(`\n📊 Processing competitor ${i + 1}/3: ${competitorUrl}`);

      try {
        // 2a. Scrape competitor domain
        const competitorScrape = await hybridScraper(competitorUrl);

        if (!competitorScrape) {
          console.warn(`⚠️ Failed to scrape competitor ${i + 1}`);
          competitorResults.push({
            domain: competitorUrl,
            topic: "Unknown",
            keywords: [],
            success: false,
            error: "Failed to scrape domain"
          });
          continue;
        }

        // 2b. Find topic for competitor
        const competitorAnalysis = await analyzeWithQwen(competitorScrape);
        const competitorTopic = competitorAnalysis.niche || "General";
        console.log(`✅ Competitor ${i + 1} topic: ${competitorTopic}`);

        // 2c. Fetch keywords for competitor topic
        console.log(`🔍 Fetching keywords for topic: ${competitorTopic}`);
        const rawKeywords = await fetchKeywordsFromDataForSEO(competitorTopic);

        // Apply filters: 100-500 volume, competition ≤0.3
        const filteredKeywords = filterKeywords(
          rawKeywords,
          70,    // maxDifficulty
          100,   // minVolume
          500,   // maxVolume
          0.3    // maxCompetition (low competition)
        );

        console.log(`✅ Found ${filteredKeywords.length} keywords for competitor ${i + 1}`);

        // Add to merged keywords array
        allKeywords.push(...filteredKeywords);

        competitorResults.push({
          domain: competitorUrl,
          topic: competitorTopic,
          keywords: filteredKeywords,
          success: true
        });

      } catch (error) {
        console.error(`❌ Error processing competitor ${i + 1}:`, error);
        competitorResults.push({
          domain: competitorUrl,
          topic: "Unknown",
          keywords: [],
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // STEP 2.5: Process target keywords (NO filtering - explicit keywords)
    console.log("\n🔍 Step 2.5: Processing target keywords...");
    let targetKeywordData: any[] = [];

    if (targetKeywords && targetKeywords.length > 0) {
      // Filter out empty keywords
      const validTargetKeywords = targetKeywords.filter(kw => kw && kw.trim() !== '');

      if (validTargetKeywords.length > 0) {
        try {
          console.log(`📋 Processing ${validTargetKeywords.length} target keywords:`, validTargetKeywords);

          // Call keyword overview API (processes keywords one by one internally)
          const overviewResults = await fetchKeywordOverview(validTargetKeywords);

          // NO filtering - use whatever data we get (explicit keywords)
          targetKeywordData = overviewResults.map(kw => ({
            ...kw,
            is_target_keyword: true // Flag to identify target keywords
          }));

          console.log(`✅ Retrieved data for ${targetKeywordData.length} target keywords`);

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
    console.log(`📊 Total before deduplication: ${allKeywords.length} competitor + ${targetKeywordData.length} target = ${allMergedKeywords.length} total`);

    // Remove duplicate keywords (by keyword text, case-insensitive)
    const uniqueKeywords = allMergedKeywords.filter((keyword, index, self) =>
      index === self.findIndex(k => k.keyword.toLowerCase() === keyword.keyword.toLowerCase())
    );
    console.log(`✅ Merged ${allMergedKeywords.length} total keywords → ${uniqueKeywords.length} unique keywords`);

    // STEP 4: Sort by search volume (highest first) and limit
    const finalKeywords = uniqueKeywords
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 50); // Limit to top 50 keywords

    console.log(`✅ Final keyword count: ${finalKeywords.length}`);
    console.log(`   - Competitor keywords: ${finalKeywords.filter(k => !k.is_target_keyword).length}`);
    console.log(`   - Target keywords: ${finalKeywords.filter(k => k.is_target_keyword).length}`);

    // STEP 5: Save to database
    console.log("\n💾 Step 5: Saving to database...");

    // Prepare competitor data for the competitors column
    const competitorsData = competitorResults.map(c => ({
      domain: c.domain,
      topic: c.topic,
      keywords: c.keywords,
      keywords_count: c.keywords.length,
      success: c.success,
      error: c.error || null
    }));

    const insertData = {
      url: clientDomain,
      topic: clientTopic,
      keywords: {
        keywords: finalKeywords,
        competitors: competitorsData, // Save competitor data here
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          total_keywords: finalKeywords.length,
          total_competitors: competitorResults.length, // Update with actual count
          onboarding_data: {
            competitor_domains: competitors,
            competitor_results: competitorResults.map(c => ({
              domain: c.domain,
              topic: c.topic,
              keywords_count: c.keywords.length,
              success: c.success
            })),
            target_keywords: targetKeywords || []
          }
        }
      },
      // Add top-level competitors column if your schema has it
      competitors: competitorsData, // Save to top-level competitors column (jsonb)
      total_competitors: competitorResults.length, // Save to total_competitors column (int4)
      user_id: userId
    };

    const { data: savedWebsite, error: dbError } = await supabase
      .from("websites")
      .insert([insertData])
      .select()
      .single();

    if (dbError) {
      console.error("❌ Database error:", dbError);
      throw new Error("Failed to save to database");
    }

    console.log("✅ Successfully saved to database");

    // STEP 6: Start article generation in background (non-blocking)
    // Don't await - let it run in background while we return the response
    console.log("\n🚀 Step 6: Starting automatic article generation in background...");
    
    // generateArticlesAutomatically(
    //   finalKeywords,
    //   savedWebsite.id,
    //   userId,
    //   30
    // ).catch(error => {
    //   console.error("💥 Background article generation error:", error);
    // });

    // Return response
    return NextResponse.json({
      success: true,
      clientDomain,
      clientTopic,
      totalKeywords: finalKeywords.length,
      keywords: finalKeywords,
      competitorResults: competitorResults.map(c => ({
        domain: c.domain,
        topic: c.topic,
        keywordsCount: c.keywords.length,
        success: c.success
      })),
      websiteId: savedWebsite.id,
      message: "Onboarding completed successfully. Articles are being generated in the background."
    });

  } catch (error) {
    console.error("💥 Onboarding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Onboarding failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}