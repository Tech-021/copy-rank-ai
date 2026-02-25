// lib/dataforseo.ts

/**
 * Fetch keyword gaps between two domains using DataForSEO Domain Intersection API.
 * Returns keywords where domainA ranks and domainB does not.
 */
export async function fetchKeywordGap(
  domainA: string,
  domainB: string,
  limit: number = 100,
  keywordFilter?: string[]
): Promise<any[]> {
  const normalizeDomain = (value: string) =>
    value
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");

  const apiLogin = process.env.DATAFORSEO_API_LOGIN;
  const apiPassword = process.env.DATAFORSEO_API_PASSWORD;
  if (!apiLogin || !apiPassword) throw new Error("Missing DataForSEO credentials");

  const auth = Buffer.from(`${apiLogin}:${apiPassword}`).toString("base64");
  const endpoint = "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live";

  const task: any = {
    target1: normalizeDomain(domainA),
    target2: normalizeDomain(domainB),
    language_code: "en",
    location_code: 2840, // US
    intersections: "false", // Get keyword gaps
    limit,
  };
  if (keywordFilter && keywordFilter.length > 0) {
    task.filters = [["keyword_data.keyword", "in", keywordFilter]];
  }
  const body = [task];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  const data = await response.json();
  const items = data.tasks?.[0]?.result?.[0]?.items || [];

  // Map the API response to extract relevant fields
  return items.map((item: any) => {
    const keywordData = item.keyword_data;
    const firstDomainSERP = item.first_domain_serp_element;

    return {
      keyword: keywordData.keyword,
      searchVolume: keywordData.keyword_info?.search_volume,
      difficulty: keywordData.keyword_properties?.keyword_difficulty,
      cpc: keywordData.keyword_info?.cpc,
      competition: keywordData.keyword_info?.competition,
      lowTopVol: keywordData.keyword_info?.low_top_of_page_bid,
      highTopVol: keywordData.keyword_info?.high_top_of_page_bid,
      trafficPotential: keywordData.keyword_info?.search_volume
        ? keywordData.keyword_info.search_volume * 0.3 * (1 - (keywordData.keyword_info.competition || 0))
        : 0,
      mainIntent: keywordData.search_intent_info?.main_intent,
      firstDomainSERP: {
        title: firstDomainSERP?.title,
        url: firstDomainSERP?.url,
        description: firstDomainSERP?.description,
      },
      backlinks: keywordData.avg_backlinks_info?.backlinks,
    };
  });
}
