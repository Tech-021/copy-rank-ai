// ...existing code...
import { NextResponse } from "next/server";
import { analyzeWithQwen } from "@/lib/qwen";
import { scrapeWithCheerio } from "@/lib/cheerioScraper";
import { scrapeWithPuppeteer } from "@/lib/puppeteerScraper";
import type { ScrapeResult } from "@/lib/types";
// ...existing code...

export async function hybridScraper(url: string): Promise<ScrapeResult | null> {
  console.log(`🔍 Scraping: ${url}`);
  let result = await scrapeWithCheerio(url);

  if (!result || result.wordCount < 50) {
    console.log("⚠️ Low content detected, switching to Puppeteer...");
    result = await scrapeWithPuppeteer(url);
  } else {
    console.log("✅ Cheerio scrape successful!");
  }

  return result;
}

/**
 * Route Handlers for Next.js app directory
 * GET ?url=...
 * POST { "url": "..." }
 */
async function handleRequest(urlCandidate: string | null) {
  if (!urlCandidate) {
    return NextResponse.json(
      { error: "Missing 'url' (GET query or POST JSON body)." },
      { status: 400 }
    );
  }

  try {
    new URL(urlCandidate);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  try {
    const data = await hybridScraper(urlCandidate);
    if (!data) {
      return NextResponse.json(
        { error: "Failed to scrape the site." },
        { status: 502 }
      );
    }

    // -- QWEN configuration check --
    const qwenUrl = process.env.QWEN_API_URL;
    const qwenKey = process.env.QWEN_API_KEY;
    if (!qwenUrl || !qwenKey) {
      // don't include scraped data on errors
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "QWEN_NOT_CONFIGURED",
            message:
              "Qwen API not configured on server. Set QWEN_API_URL and QWEN_API_KEY (or activate the API key).",
          },
        },
        { status: 500 }
      );
    }

    // call Qwen to classify niche
    let nicheResult = null;
    try {
      nicheResult = await analyzeWithQwen(data);
    } catch (e) {
      console.error("Qwen analysis failed:", (e as Error)?.message ?? e);

      const anyErr = e as any;
      const statusCode = anyErr?.status ?? anyErr?.response?.status;
      const upstreamBody = anyErr?.body ?? anyErr?.response?.data;

      // Auth / activation errors from Qwen
      if (statusCode === 401 || statusCode === 403) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "QWEN_AUTH_ERROR",
              message:
                "Qwen API key invalid or not activated. Received authentication error from Qwen.",
              details: { status: statusCode, body: upstreamBody },
            },
          },
          { status: 502 }
        );
      }

      // Bad request -> surface upstream validation message
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

      // Generic LLM/remote failure
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

    // success: include scraped data and niche result
    return NextResponse.json({ ok: true, niche: nicheResult });
  } catch (err) {
    console.error(
      "Scrape route error:",
      (err as Error)?.message ?? String(err)
    );
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  return handleRequest(url);
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // ignore parse errors; handled below
  }
  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).url)
      : null;
  return handleRequest(url);
}
// ...existing code...