// ✅ Force Node.js runtime (Edge doesn’t support console logs)
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { analyzeWithQwen } from "@/lib/qwen";
import type { ScrapeResult } from "@/lib/types";

// Optional external scraper endpoint (Cheerio + Puppeteer running on a dedicated server)
const EXTERNAL_SCRAPER_URL =
  process.env.EXTERNAL_SCRAPER_URL ||
  "http://192.241.141.21:7000/api/scrape";

async function scrapeWithExternalService(
  url: string
): Promise<ScrapeResult | null> {
  try {
    console.log(
      `🌐 [externalScraper] Calling external scraper at ${EXTERNAL_SCRAPER_URL} for: ${url}`
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s safety timeout

    const res = await fetch(EXTERNAL_SCRAPER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // The external API expects { urls: string | string[], limit: number }
      body: JSON.stringify({ urls: url, limit: 100 }),
      signal: controller.signal,
    }).catch((e) => {
      console.error(
        "❌ [externalScraper] Network/abort error calling external scraper:",
        e
      );
      throw e;
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "❌ [externalScraper] External scraper returned non-OK status:",
        res.status,
        text
      );
      return null;
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      console.error(
        "❌ [externalScraper] Failed to parse JSON from external scraper:",
        e
      );
      return null;
    }

    if (!json.success || !json.data) {
      console.error(
        "❌ [externalScraper] success=false or data missing:",
        json
      );
      return null;
    }

    const data = json.data;
    const maxPage = data.maxTrafficPage || {};

    // Build a mainText based on contentPreview and keywords to give Qwen context
    const keywordString = (data.keywords || [])
      .map((k: any) => `${k.keyword} (${k.frequency})`)
      .join(", ");

    const mainText =
      (data.contentPreview || "") +
      (keywordString ? `\n\nKeywords: ${keywordString}` : "");

    const title = maxPage.title || "";
    const metaDescription = maxPage.description || "";
    const canonical = maxPage.url || "";

    const wordCount =
      typeof maxPage.contentLength === "number"
        ? maxPage.contentLength
        : mainText.split(/\s+/).filter(Boolean).length;

    const scrapingMethod = maxPage.scrapingMethod || "";
    const source: ScrapeResult["source"] =
      scrapingMethod === "PUPPETEER" ? "puppeteer" : "cheerio";

    const result: ScrapeResult = {
      title,
      metaDescription,
      headings: "",
      navLinks: "",
      mainText,
      schemaData: [],
      wordCount,
      source,
      status: res.status,
      canonical,
      lang: undefined,
      charset: undefined,
      author: undefined,
      robots: undefined,
      openGraph: {},
      twitter: {},
      links: [],
      images: [],
    };

    console.log(
      `✅ [externalScraper] Successfully scraped via external service (${result.wordCount} words, source=${result.source})`
    );
    return result;
  } catch (error) {
    console.error(
      "💥 [externalScraper] Unexpected error while calling external scraper:",
      error
    );
    return null;
  }
}

// Unified scraper – now always uses the external scraper service
export async function hybridScraper(url: string): Promise<ScrapeResult | null> {
  console.log(`🔍 [hybridScraper] Starting scrape for: ${url}`);

  const result = await scrapeWithExternalService(url);

  if (!result) {
    console.error("❌ [hybridScraper] External scraper failed.");
    return null;
  }

  console.log(
    `📦 [hybridScraper] Using result from external scraper (${result.wordCount} words, source=${result.source})`
  );
  return result;
}

// Internal handler
async function handleRequest(urlCandidate: string | null) {
  console.log("🧠 handleRequest triggered with URL:", urlCandidate);

  if (!urlCandidate) {
    console.warn("❌ Missing URL in request.");
    return NextResponse.json(
      { error: "Missing 'url' (GET query or POST JSON body)." },
      { status: 400 }
    );
  }

  try {
    new URL(urlCandidate);
  } catch {
    console.warn("❌ Invalid URL:", urlCandidate);
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  try {
    const data = await hybridScraper(urlCandidate);
    if (!data) {
      console.error("❌ No data returned from hybridScraper");
      return NextResponse.json(
        { error: "Failed to scrape the site." },
        { status: 502 }
      );
    }

    // Qwen API credentials
    const qwenUrl = process.env.QWEN_API_URL;
    const qwenKey = process.env.QWEN_API_KEY;
    console.log("🔑 Qwen credentials loaded:", {
      QWEN_API_URL: !!qwenUrl,
      QWEN_API_KEY: !!qwenKey,
    });

    if (!qwenUrl || !qwenKey) {
      console.error("🚨 Missing Qwen API environment variables.");
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "QWEN_NOT_CONFIGURED",
            message:
              "Qwen API not configured. Please set QWEN_API_URL and QWEN_API_KEY in environment variables.",
          },
        },
        { status: 500 }
      );
    }

    // Analyze with Qwen
    let nicheResult = null;
    try {
      console.log("🧠 Starting Qwen analysis...");
      nicheResult = await analyzeWithQwen(data);
      console.log("✅ Qwen analysis complete.");
    } catch (e) {
      console.error("Qwen analysis failed:", (e as Error)?.message ?? e);
      const anyErr = e as any;
      const statusCode = anyErr?.status ?? anyErr?.response?.status;
      const upstreamBody = anyErr?.body ?? anyErr?.response?.data;

      if (statusCode === 401 || statusCode === 403) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "QWEN_AUTH_ERROR",
              message:
                "Qwen API key invalid or not activated. Authentication error received.",
              details: { status: statusCode, body: upstreamBody },
            },
          },
          { status: 502 }
        );
      }

      if (statusCode === 400) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "QWEN_BAD_REQUEST",
              message: "Qwen rejected the request (bad payload).",
              details: { status: statusCode, body: upstreamBody },
            },
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "QWEN_FAILED",
            message: "Niche analysis failed due to an upstream error.",
            details: (e as Error)?.message ?? String(e),
          },
        },
        { status: 502 }
      );
    }

    console.log("🎯 Returning success response with nicheResult");
    return NextResponse.json({ ok: true, niche: nicheResult });
  } catch (err) {
    console.error(
      "💥 Scrape route error:",
      (err as Error)?.message ?? String(err)
    );
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// ✅ Route handlers
export async function GET(request: Request) {
  console.log("📨 GET request received.");
  const url = new URL(request.url).searchParams.get("url");
  return handleRequest(url);
}

export async function POST(request: Request) {
  console.log("📨 POST request received.");
  let body: unknown = null;
  try {
    body = await request.json();
    console.log("📦 Parsed body:", body);
  } catch {
    console.warn("⚠️ Failed to parse JSON body.");
  }
  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).url)
      : null;
  return handleRequest(url);
}
