// ✅ Force Node.js runtime (Edge doesn’t support console logs)
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { analyzeWithQwen } from "@/lib/qwen";
import { scrapeWithCheerio } from "@/lib/cheerioScraper";
import { scrapeWithPuppeteer } from "@/lib/puppeteerScraper";
import type { ScrapeResult } from "@/lib/types";

// ✅ Global startup log (shows at cold start)
console.log("🚀 Scraper route initialized.");

// Unified scraper
export async function hybridScraper(url: string): Promise<ScrapeResult | null> {
  console.log(`🔍 [hybridScraper] Starting scrape for: ${url}`);

  let result = await scrapeWithCheerio(url);
  console.log("🧩 Cheerio scrape result:", result ? "OK" : "NULL");

  if (!result || result.wordCount < 50) {
    console.log("⚠️ Low content (<50 words), switching to Puppeteer...");
    result = await scrapeWithPuppeteer(url);
  } else {
    console.log("✅ Cheerio scrape successful, skipping Puppeteer.");
  }

  console.log("📦 Final scrape result:", !!result ? "Success" : "Failed");
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
