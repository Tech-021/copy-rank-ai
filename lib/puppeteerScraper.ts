// lib/scrapeWithPuppeteer.ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { ScrapeResult } from "./types";

// Ensures this runs in Node runtime when used in Next.js
export const config = {
  runtime: "nodejs20",
};

// Helper to safely parse JSON inside schema nodes
function safeParseJSON(text: string | null | undefined): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function scrapeWithPuppeteer(url: string): Promise<ScrapeResult> {
  const executablePath = await (chromium as any).executablePath();
  console.log("Chromium path:", executablePath);
  // Launch puppeteer with chromium settings (using `as any` to bypass TS gaps)
  const browser = await puppeteer.launch({
    args: (chromium as any).args,
    executablePath,
    headless: true,
    defaultViewport: (chromium as any).defaultViewport ?? {
      width: 1280,
      height: 720,
    },
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const status = response?.status() ?? null;

    const result: any = await page.evaluate(() => {
      function removeAndGetText(selectors: string[]) {
        const body = document.body.cloneNode(true) as HTMLElement;
        selectors.forEach((sel) =>
          body.querySelectorAll(sel).forEach((el) => el.remove())
        );
        return (body.innerText || "").replace(/\s+/g, " ").trim();
      }

      const title =
        (document.querySelector("title")?.innerText ?? "").trim() ||
        (document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content") ??
          "") ||
        (document
          .querySelector('meta[name="twitter:title"]')
          ?.getAttribute("content") ??
          "");

      const metaDescription =
        (document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") ??
          "") ||
        (document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content") ??
          "") ||
        (document
          .querySelector('meta[name="twitter:description"]')
          ?.getAttribute("content") ??
          "");

      const headings = Array.from(document.querySelectorAll("h1, h2"))
        .map((h) => h.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" | ");

      const navLinks = Array.from(document.querySelectorAll("nav a"))
        .map((a) => a.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(", ");

      const mainText = removeAndGetText([
        "script",
        "style",
        "noscript",
        "header",
        "nav",
        "footer",
        "form",
        "iframe",
      ]);

      const schemaNodes = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      )
        .map((s) => s.textContent)
        .filter(Boolean);

      const og: Record<string, string> = {};
      const tw: Record<string, string> = {};
      Array.from(document.querySelectorAll("meta")).forEach((m) => {
        const prop = m.getAttribute("property") || m.getAttribute("name");
        const content =
          m.getAttribute("content") || m.getAttribute("value") || "";
        if (!prop) return;
        if (prop.startsWith("og:")) og[prop.replace(/^og:/, "")] = content;
        if (prop.startsWith("twitter:"))
          tw[prop.replace(/^twitter:/, "")] = content;
      });

      const canonical =
        (
          document.querySelector(
            'link[rel="canonical"]'
          ) as HTMLLinkElement | null
        )?.href || "";

      const lang = document.documentElement.lang || "";
      const charset =
        document.querySelector("meta[charset]")?.getAttribute("charset") ||
        document
          .querySelector('meta[http-equiv="Content-Type"]')
          ?.getAttribute("content")
          ?.match(/charset=([^;]+)/)?.[1] ||
        "";

      const author =
        document
          .querySelector('meta[name="author"]')
          ?.getAttribute("content") || "";

      const robots =
        document
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content") || "";

      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          text: (a.textContent || "").trim(),
          href: (a.getAttribute("href") || "").trim(),
        }))
        .slice(0, 500);

      const images = Array.from(document.querySelectorAll("img[src]"))
        .map((img) => ({
          src: (img.getAttribute("src") || "").trim(),
          alt: (img.getAttribute("alt") || "").trim(),
        }))
        .slice(0, 200);

      return {
        title,
        metaDescription,
        headings,
        navLinks,
        mainText,
        schemaNodes,
        og,
        tw,
        canonical,
        lang,
        charset,
        author,
        robots,
        links,
        images,
      };
    });

    // Schema parsing
    const schemaData: unknown[] = [];
    for (const txt of result.schemaNodes) {
      const parsed = safeParseJSON(txt);
      if (parsed !== null) schemaData.push(parsed);
    }

    const mainText = (result.mainText ?? "").slice(0, 4000);
    const wordCount = mainText
      ? mainText.split(/\s+/).filter(Boolean).length
      : 0;

    const finalResult: ScrapeResult = {
      title: result.title,
      metaDescription: result.metaDescription,
      headings: result.headings,
      navLinks: result.navLinks,
      mainText,
      schemaData,
      wordCount,
      source: "puppeteer", // ✅ ensure type matches your union
      status,
      canonical: result.canonical,
      lang: result.lang,
      charset: result.charset,
      author: result.author,
      robots: result.robots,
      openGraph: result.og,
      twitter: result.tw,
      links: result.links,
      images: result.images,
    };

    return finalResult;
  } finally {
    await browser.close();
  }
}
