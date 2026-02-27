import { log } from "node:console";

export interface KeywordData {
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  competition: number;
  low_top_vol?: number;
  high_top_vol?: number;
}

export async function fetchKeywordsFromDataForSEO(
  topic: string
): Promise<KeywordData[]> {
  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;

  console.log(`🔍 DataForSEO Request for: ${topic}`);

  if (!apiLogin || !apiPassword) {
    throw new Error("DataForSEO API credentials are missing");
  }

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString("base64");

  // Build endpoints based on whether `topic` looks like a domain or a keyword
  const endpoints: Array<{ name: string; url: string; body: any }> = [];

  // Always try keyword discovery by seed keyword
  endpoints.push({
    name: "keywords_for_keywords",
    url: "https://api.dataforseo.com/v3/keywords_data/google/keywords_for_keywords/live",
    body: [
      {
        keywords: [topic],
        language: "en",
        location: 2840, // United States
        sort_by: "search_volume",
        limit: 500,
      },
    ],
  });

  // Only call keywords_for_site when the topic looks like a domain/URL
  const looksLikeDomain = /https?:\/\//i.test(topic) || (/\./.test(topic) && !/\s/.test(topic));
  if (looksLikeDomain) {
    let target = topic;
    if (/^https?:\/\//i.test(topic)) {
      try {
        target = new URL(topic).hostname;
      } catch (e) {
        target = topic;
      }
    }

    endpoints.push({
      name: "keywords_for_site",
      url: "https://api.dataforseo.com/v3/keywords_data/google/keywords_for_site/live",
      body: [
        {
          target,
          language: "en",
          location: 2840,
          limit: 500,
        },
      ],
    });
  }

  let allKeywords: KeywordData[] = []; // Collect from ALL endpoints

  for (const endpoint of endpoints) {
    try {
      console.log(`🔧 Trying endpoint: ${endpoint.name}`);

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(endpoint.body),
      });

      console.log(`🔧 ${endpoint.name} Status: ${response.status}`);

      if (!response.ok) {
        console.log(`❌ ${endpoint.name} failed: ${response.status}`);
        continue; // Try next endpoint
      }

      const data = await response.json();
      console.log(`🔧 ${endpoint.name} response keys:`, Object.keys(data));
      console.log(`🔧 ${endpoint.name} status_code:`, data.status_code);
      console.log(`🔧 ${endpoint.name} status_message:`, data.status_message);
      console.log(`🔧 ${endpoint.name} tasks_count:`, data.tasks_count);
      console.log(`🔧 ${endpoint.name} tasks_error:`, data.tasks_error);
      // Print a small preview of tasks to help debug structure
      try {
        const tasksPreview = JSON.stringify((data.tasks || []).slice(0, 1), null, 2);
        console.log(`🔧 ${endpoint.name} tasks preview:`, tasksPreview);
      } catch (e) {
        console.log(`🔧 ${endpoint.name} tasks preview: could not stringify tasks`);
      }

      // If the API returned an error status, skip
      if (data.status_code !== 20000) {
        console.log(`❌ ${endpoint.name} API error: ${data.status_message}`);
        continue;
      }

      // Parse response based on endpoint type (robust aggregation)
      const items = parseApiResponse(data, endpoint.name);
      console.log(`🔧 ${endpoint.name} parsed items:`, items.length);

      if (items.length > 0) {
        console.log(`✅ ${endpoint.name} success: ${items.length} items`);

        const validKeywords = transformItems(items, topic);
        if (validKeywords.length > 0) {
          console.log(
            `✅ Found ${validKeywords.length} valid keywords from ${endpoint.name}`
          );
          // COLLECT keywords instead of returning immediately
          allKeywords = [...allKeywords, ...validKeywords];
        }
      } else {
        console.log(`⚠️ ${endpoint.name} returned no items`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name} error:`, error.message);
      // Continue to next endpoint
    }
  }

  // Remove duplicate keywords after collecting from all endpoints
  const uniqueKeywords = allKeywords.filter(
    (keyword, index, self) =>
      index ===
      self.findIndex(
        (k) => k.keyword.toLowerCase() === keyword.keyword.toLowerCase()
      )
  );

  console.log(
    `📊 Combined ${uniqueKeywords.length} unique keywords from all endpoints`
  );

  // If no keywords returned, use fallback: generate seed phrases and request search_volume
  if (uniqueKeywords.length === 0) {
    console.log(`⚠️ No keywords found from DataForSEO endpoints — using fallback seed phrases`);

    const seedPhrases = generateSeedPhrases(topic);

    try {
      const svResponse = await fetch(
        "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            {
              keywords: seedPhrases,
              language: "en",
              location: 2840,
              limit: seedPhrases.length,
            },
          ]),
        }
      );

      if (!svResponse.ok) {
        console.log(`❌ search_volume fallback failed: ${svResponse.status}`);
        throw new Error("All DataForSEO API endpoints failed to return keyword data");
      }

      const svData = await svResponse.json();
      console.log(`🔧 search_volume response keys:`, Object.keys(svData));
      console.log(`🔧 search_volume status_code:`, svData.status_code);
      console.log(`🔧 search_volume status_message:`, svData.status_message);

      if (svData.status_code !== 20000) {
        console.log(`❌ search_volume API error: ${svData.status_message}`);
        throw new Error("All DataForSEO API endpoints failed to return keyword data");
      }

      const svItems = parseApiResponse(svData, "search_volume");
      console.log(`🔧 search_volume parsed items:`, svItems.length);

      const fallbackKeywords = transformItems(svItems, topic);

      const uniqueFallback = fallbackKeywords.filter(
        (keyword, index, self) =>
          index ===
          self.findIndex(
            (k) => k.keyword.toLowerCase() === keyword.keyword.toLowerCase()
          )
      );

      if (uniqueFallback.length === 0) {
        throw new Error("All DataForSEO API endpoints failed to return keyword data");
      }

      console.log(`✅ Fallback produced ${uniqueFallback.length} keywords`);
      return uniqueFallback;
    } catch (err) {
      console.log(`❌ DataForSEO fallback error:`, err?.message || err);
      throw new Error("All DataForSEO API endpoints failed to return keyword data");
    }
  }

  return uniqueKeywords;
}

// Fetch search volume for a specific list of keywords using the
// /v3/keywords_data/google/search_volume/live endpoint.
// This is used to enrich already-scraped keywords (e.g. from competitor pages)
// with real search_volume so we can sort by volume.
export async function fetchSearchVolumeForKeywords(
  keywords: string[]
): Promise<KeywordData[]> {
  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;

  if (!apiLogin || !apiPassword) {
    throw new Error("DataForSEO API credentials are missing");
  }

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString("base64");

  const cleaned = Array.from(
    new Set(
      (keywords || [])
        .map((k) => (k || "").trim())
        .filter((k) => k.length > 0)
    )
  );

  if (cleaned.length === 0) {
    return [];
  }

  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords: cleaned,
          language: "en",
          location: 2840, // United States
          limit: cleaned.length,
        },
      ]),
    }
  );

  if (!response.ok) {
    throw new Error(
      `DataForSEO search_volume request failed with status ${response.status}`
    );
  }

  const data = await response.json();

  if (data.status_code !== 20000) {
    throw new Error(
      `DataForSEO search_volume API error: ${data.status_message || data.status_code}`
    );
  }

  const items = parseApiResponse(data, "search_volume");

  const mapped: KeywordData[] = items
    .map((item: any) => {
      if (!item) return null;

      if (typeof item === "string") {
        return {
          keyword: item,
          search_volume: 0,
          difficulty: 0,
          cpc: 0,
          competition: 0,
        } as KeywordData;
      }

      const keyword = item.keyword || item.key;
      if (!keyword) return null;

      const search_volume =
        item.search_volume || item.monthly_searches?.[0]?.search_volume || 0;
      const difficulty = item.difficulty || item.keyword_difficulty || 0;
      const cpc = item.cpc || item.cost_per_click || 0;

      let competitionRaw =
        item.competition ||
        item.competition_level ||
        item.competition_rate ||
        0.5;
      const competition =
        typeof competitionRaw === "number" && competitionRaw > 1
          ? competitionRaw / 100
          : competitionRaw;

      return {
        keyword,
        search_volume,
        difficulty,
        cpc,
        competition,
        low_top_vol: item.low_top_vol,
        high_top_vol: item.high_top_vol,
      } as KeywordData;
    })
    .filter((k: KeywordData | null) => !!k) as KeywordData[];

  // Deduplicate by keyword (case-insensitive)
  const uniqueByKeyword = mapped.filter(
    (kw, index, self) =>
      index ===
      self.findIndex(
        (k) => k.keyword.toLowerCase() === kw.keyword.toLowerCase()
      )
  );

  return uniqueByKeyword;
}

// Generate seed phrases for fallback when API returns nothing
function generateSeedPhrases(topic: string): string[] {
  const base = topic.trim();
  const seeds = [
    base,
    `${base} tips`,
    `best ${base}`,
    `${base} guide`,
    `${base} tutorial`,
    `learn ${base}`,
    `${base} for beginners`,
    `what is ${base}`,
    `${base} news`,
    `${base} trends`,
    `${base} tools`,
    `${base} examples`,
    `${base} use cases`,
    `how to ${base}`,
    `${base} benefits`,
    `top ${base} resources`,
    `${base} careers`,
    `${base} jobs`,
    `${base} companies`,
    `${base} future trends`,
  ];

  // Deduplicate and limit to 30 phrases
  return Array.from(new Set(seeds)).slice(0, 30);
}

function parseApiResponse(data: any, endpointName: string): any[] {
  try {
    const items: any[] = [];

    const tasks = data.tasks || [];
    for (const task of tasks) {
      const results = task.result || [];
      for (const res of results) {
        // Most common: res.items is array of keyword objects
        if (Array.isArray(res.items) && res.items.length > 0) {
          items.push(...res.items);
          continue;
        }

        // Sometimes result is an array of keyword objects directly
        if (Array.isArray(res) && res.length > 0) {
          items.push(...res);
          continue;
        }

        // Sometimes keywords are returned as a 'keywords' array of strings/objects
        if (Array.isArray(res.keywords) && res.keywords.length > 0) {
          items.push(...res.keywords);
          continue;
        }

        // Fallback: rescue single objects that look like keyword records
        if (res && typeof res === 'object') {
          // If object contains 'keyword' property, treat it as a single record
          if (res.keyword || res.key) {
            items.push(res);
            continue;
          }
        }
      }
    }

    return items;
  } catch (error) {
    console.log(`❌ Error parsing ${endpointName} response:`, error);
    return [];
  }
}

function transformItems(items: any[], topic: string): KeywordData[] {
  const topicLower = topic.toLowerCase();
  const topicWords = topicLower
    .split(/\s+/)
    .filter((w) => w.length > 2); // Keywords longer than 2 chars

  console.log(`🔍 Relevance filter: topic="${topic}", words=[${topicWords.join(", ")}]`);

  return items
    .map((item) => {
      if (typeof item === 'string') {
        return {
          keyword: item,
          search_volume: 0,
          difficulty: 0,
          cpc: 0,
          competition: 0,
        } as KeywordData;
      }
      // Handle different response structures
      const keyword = item.keyword || item.key || topic;
      const search_volume =
        item.search_volume || item.monthly_searches?.[0]?.search_volume || 0;
      const difficulty = item.difficulty || item.keyword_difficulty || 50;
      const cpc = item.cpc || item.cost_per_click || 0.5;
      // Normalize competition to 0-1 scale if it's provided as percent (0-100)
      let competitionRaw =
        item.competition ||
        item.competition_level ||
        item.competition_rate ||
        0.5;
      const competition =
        typeof competitionRaw === "number" && competitionRaw > 1
          ? competitionRaw / 100
          : competitionRaw;

      return {
        keyword,
        search_volume,
        difficulty,
        cpc,
        competition,
        low_top_vol: item.low_top_vol,
        high_top_vol: item.high_top_vol,
      };
    })
    .filter((kw) => {
      const kwLower = kw.keyword.toLowerCase();

      // Remove the topic itself
      if (kwLower === topicLower) {
        return false;
      }

      // Remove keywords with zero or very low search volume
      if (kw.search_volume <= 0) {
        return false;
      }

      // RELEVANCE CHECK: At least one topic word must appear in the keyword
      // This prevents completely random keywords like "surgical technician" for "digital marketing"
      const hasRelevantWord = topicWords.some((word) => kwLower.includes(word));

      if (!hasRelevantWord) {
        console.log(
          `   ⚠️  Filtered out irrelevant: "${kw.keyword}" (no match for "${topic}" words)`
        );
        return false;
      }

      console.log(`   ✅ Kept relevant keyword: "${kw.keyword}"`);
      return true;
    });
}

export function filterKeywords(
  keywords: KeywordData[],
  maxDifficulty: number = 70,
  minVolume: number = 30,
  maxVolume: number = Infinity, // Allow high-volume keywords by default
  maxCompetition: number = 0.5 // Low competition threshold (50%)
): KeywordData[] {
  console.log(`🔍 Filtering ${keywords.length} keywords with criteria:`);
  console.log(`   minVolume: ${minVolume}, maxVolume: ${maxVolume}`);
  console.log(
    `   maxDifficulty: ${maxDifficulty}, maxCompetition: ${maxCompetition}`
  );

  const filtered = keywords.filter((kw) => {
    const passVolume =
      kw.search_volume >= minVolume && kw.search_volume <= maxVolume;
    const passDifficulty = kw.difficulty <= maxDifficulty;
    const passCompetition = kw.competition <= maxCompetition;

    if (!passVolume) {
      console.log(
        `   ❌ "${kw.keyword}" - Volume ${kw.search_volume} not in range [${minVolume}, ${maxVolume}]`
      );
    }
    if (!passDifficulty) {
      console.log(
        `   ❌ "${kw.keyword}" - Difficulty ${kw.difficulty} > ${maxDifficulty}`
      );
    }
    if (!passCompetition) {
      console.log(
        `   ❌ "${kw.keyword}" - Competition ${kw.competition} > ${maxCompetition}`
      );
    }

    return passVolume && passDifficulty && passCompetition;
  });

  console.log(`✅ Filtered result: ${filtered.length} keywords passed`);

  return filtered
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0)) // Sort by volume (highest first)
    .slice(0, 100);
}

// Fetch keyword overview data for target keywords
export async function fetchKeywordOverview(
  keywords: string[]
): Promise<KeywordData[]> {
  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;

  if (!apiLogin || !apiPassword) {
    throw new Error("DataForSEO API credentials are missing");
  }

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString("base64");
  console.log(auth);
  const results: KeywordData[] = [];

  for (const keyword of keywords) {
    try {
      console.log(`🔍 Fetching keyword overview for: ${keyword}`);

      const response = await fetch(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            {
              keywords: [keyword], // Changed: keywords (array) instead of keyword (string)
              location_code: 2840,
              language_name: "English", // Changed: language_name instead of language_code
              include_serp_info: false,
              include_clickstream_data: false,
            },
          ]),
        }
      );

      if (!response.ok) {
        console.error(`❌ Keyword overview API failed: ${response.status}`);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.status_code !== 20000) {
        console.error("❌ API Error:", data.status_message);
        continue;
      }

      // FIX: The response structure is data.tasks[0].result[0].items
      const items = data.tasks?.[0]?.result?.[0]?.items || [];

      if (!items || items.length === 0) {
        console.warn(`⚠️ No keyword overview returned for "${keyword}"`);
        continue;
      }

      const item = items[0];
      const info = item.keyword_info || {};
      const props = item.keyword_properties || {};

      results.push({
        keyword: item.keyword,
        search_volume: info.search_volume || 0,
        difficulty: props.keyword_difficulty || 0,
        cpc: info.cpc || 0,
        competition: info.competition || 0,
        low_top_vol: info.low_top_of_page_bid,
        high_top_vol: info.high_top_of_page_bid,
      });

      console.log(`✅ Successfully processed keyword: ${item.keyword}`);
    } catch (err) {
      console.error(`❌ Error fetching keyword "${keyword}":`, err);
    }
  }

  console.log(`✅ Retrieved ${results.length} keyword overview results`);
  return results;
}
