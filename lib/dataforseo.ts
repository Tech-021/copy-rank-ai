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

export async function fetchKeywordsFromDataForSEO(topic: string): Promise<KeywordData[]> {
  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;

  console.log(`🔍 DataForSEO Request for: ${topic}`);

  if (!apiLogin || !apiPassword) {
    throw new Error('DataForSEO API credentials are missing');
  }

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString('base64');

  // Try multiple API endpoints
  const endpoints = [
    {
      name: "keywords_for_keywords",
      url: 'https://api.dataforseo.com/v3/keywords_data/google/keywords_for_keywords/live',
      body: [{
        keywords: [topic],
        language: "en",
        location: 2840, // United States
        sort_by: "search_volume",
        limit: 200
      }]
    },
    {
      name: "keywords_for_site",
      url: 'https://api.dataforseo.com/v3/keywords_data/google/keywords_for_site/live',
      body: [{
        target: topic, // Try using the topic as a website/domain
        language: "en",
        location: 2840,
        limit: 200
      }]
    },
    {
      name: "search_volume",
      url: 'https://api.dataforseo.com/v3/keywords_data/google/search_volume/live',
      body: [{
        // broaden seed phrases to generate more related keywords
        keywords: [
          topic,
          `${topic} tips`,
          `best ${topic}`,
          `${topic} 2025`,
          `${topic} guide`,
          `${topic} tutorial`,
          `learn ${topic}`,
          `${topic} for beginners`,
          `what is ${topic}`,
          `latest ${topic}`,
          `${topic} news`,
          `${topic} trends`,
          `${topic} careers`,
          `${topic} jobs`,
          `${topic} meaning`,
          `how to ${topic}`,
          `${topic} examples`,
          `${topic} uses`,
          `${topic} tools`,
          `${topic} ideas`,
          `top ${topic} resources`,
          `best ${topic} tools`,
          `${topic} benefits`,
          `${topic} advantages`,
          `${topic} disadvantages`,
          `${topic} tutorials`,
          `${topic} examples`,
          // related & adjacent terms to broaden discovery
          `${topic} platforms`,
          `${topic} artificial intelligence`,
          `${topic} innovation`,
          `${topic} development`,
          `${topic} framework`,
          `${topic} examples and uses`,
          `how ${topic} works`,
          `${topic} beginner guide`,
          `advanced ${topic}`,
          `intro to ${topic}`,
          `compare ${topic} vs`,
          `best ${topic} companies`,
          `top ${topic} trends 2025`,
          `${topic} tutorial for beginners`,
          `${topic} use cases`,
          `${topic} case studies`,
          `${topic} news 2025`
        ],
        language: "en",
        location: 2840,
        limit: 1000
      }]
    }
  ];

  let allKeywords: KeywordData[] = []; // Collect from ALL endpoints

  for (const endpoint of endpoints) {
    try {
      console.log(`🔧 Trying endpoint: ${endpoint.name}`);
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
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
      
      // Parse response based on endpoint type
      const items = parseApiResponse(data, endpoint.name);
      
      if (items.length > 0) {
        console.log(`✅ ${endpoint.name} success: ${items.length} items`);
        
        const validKeywords = transformItems(items, topic);
        if (validKeywords.length > 0) {
          console.log(`✅ Found ${validKeywords.length} valid keywords from ${endpoint.name}`);
          // COLLECT keywords instead of returning immediately
          allKeywords = [...allKeywords, ...validKeywords];
        }
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint.name} error:`, error.message);
      // Continue to next endpoint
    }
  }

  // Remove duplicate keywords after collecting from all endpoints
  const uniqueKeywords = allKeywords.filter((keyword, index, self) => 
    index === self.findIndex(k => k.keyword.toLowerCase() === keyword.keyword.toLowerCase())
  );

  console.log(`📊 Combined ${uniqueKeywords.length} unique keywords from all endpoints`);
  
  if (uniqueKeywords.length === 0) {
    throw new Error('All DataForSEO API endpoints failed to return keyword data');
  }

  return uniqueKeywords;
}

function parseApiResponse(data: any, endpointName: string): any[] {
  try {
    if (endpointName === "keywords_for_site") {
      // For keywords_for_site, data might be in tasks[0].result[0].items
      return data.tasks?.[0]?.result?.[0]?.items || [];
    } else if (endpointName === "search_volume") {
      // For search_volume, data might be in tasks[0].result
      return data.tasks?.[0]?.result || [];
    } else {
      // For keywords_for_keywords
      return data.tasks?.[0]?.result?.[0]?.items || [];
    }
  } catch (error) {
    console.log(`❌ Error parsing ${endpointName} response:`, error);
    return [];
  }
}

function transformItems(items: any[], topic: string): KeywordData[] {
  return items
    .map(item => {
      // Handle different response structures
      const keyword = item.keyword || item.key || topic;
      const search_volume = item.search_volume || item.monthly_searches?.[0]?.search_volume || 0;
      const difficulty = item.difficulty || item.keyword_difficulty || 50;
      const cpc = item.cpc || item.cost_per_click || 0.5;
      // Normalize competition to 0-1 scale if it's provided as percent (0-100)
      let competitionRaw = item.competition || item.competition_level || item.competition_rate || 0.5;
      const competition = (typeof competitionRaw === 'number' && competitionRaw > 1) ? competitionRaw / 100 : competitionRaw;
      
      return {
        keyword,
        search_volume,
        difficulty,
        cpc,
        competition,
        low_top_vol: item.low_top_vol,
        high_top_vol: item.high_top_vol
      };
    })
    .filter(kw => 
      kw.search_volume > 0 && 
      kw.keyword.toLowerCase() !== topic.toLowerCase()
    );
}

export function filterKeywords(
  keywords: KeywordData[], 
  maxDifficulty: number = 70,
  minVolume: number = 30,
  maxVolume: number = Infinity,  // Allow high-volume keywords by default
  maxCompetition: number = 0.5  // Low competition threshold (50%)
): KeywordData[] {
  console.log(`🔍 Filtering ${keywords.length} keywords with criteria:`);
  console.log(`   minVolume: ${minVolume}, maxVolume: ${maxVolume}`);
  console.log(`   maxDifficulty: ${maxDifficulty}, maxCompetition: ${maxCompetition}`);
  
  const filtered = keywords.filter(kw => {
    const passVolume = kw.search_volume >= minVolume && kw.search_volume <= maxVolume;
    const passDifficulty = kw.difficulty <= maxDifficulty;
    const passCompetition = kw.competition <= maxCompetition;
    
    if (!passVolume) {
      console.log(`   ❌ "${kw.keyword}" - Volume ${kw.search_volume} not in range [${minVolume}, ${maxVolume}]`);
    }
    if (!passDifficulty) {
      console.log(`   ❌ "${kw.keyword}" - Difficulty ${kw.difficulty} > ${maxDifficulty}`);
    }
    if (!passCompetition) {
      console.log(`   ❌ "${kw.keyword}" - Competition ${kw.competition} > ${maxCompetition}`);
    }
    
    return passVolume && passDifficulty && passCompetition;
  });
  
  console.log(`✅ Filtered result: ${filtered.length} keywords passed`);
  
  return filtered
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))  // Sort by volume (highest first)
    .slice(0, 60);
}

// Fetch keyword overview data for target keywords
export async function fetchKeywordOverview(keywords: string[]): Promise<KeywordData[]> {
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
              keywords: [keyword],        // Changed: keywords (array) instead of keyword (string)
              location_code: 2840,
              language_name: "English",   // Changed: language_name instead of language_code
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
