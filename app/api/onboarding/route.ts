import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { hybridScraper } from "@/app/api/scraper/route";
import { analyzeWithQwen } from "@/lib/qwen";
import { fetchKeywordsFromDataForSEO, filterKeywords } from "@/lib/dataforseo";

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

    // STEP 3: Remove duplicate keywords (by keyword text)
    console.log("\n🔍 Step 3: Removing duplicate keywords...");
    const uniqueKeywords = allKeywords.filter((keyword, index, self) => 
      index === self.findIndex(k => k.keyword.toLowerCase() === keyword.keyword.toLowerCase())
    );
    console.log(`✅ Merged ${allKeywords.length} total keywords → ${uniqueKeywords.length} unique keywords`);

    // STEP 4: Sort by search volume (highest first) and limit
    const finalKeywords = uniqueKeywords
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 50); // Limit to top 50 keywords

    console.log(`✅ Final keyword count: ${finalKeywords.length}`);

    // STEP 5: Save to database
    console.log("\n💾 Step 5: Saving to database...");
    
    const insertData = {
      url: clientDomain,
      topic: clientTopic,
      keywords: {
        keywords: finalKeywords,
        competitors: [], // No competitor analysis in this flow
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          total_keywords: finalKeywords.length,
          total_competitors: 0,
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
      message: "Onboarding completed successfully"
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