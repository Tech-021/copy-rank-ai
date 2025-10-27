import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapeResult } from "./types";

function safeParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function scrapeWithCheerio(
  url: string
): Promise<ScrapeResult | null> {
  try {
    const response = await axios.get<string>(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    });
    const data = response.data;
    const status = response.status;
    const $ = cheerio.load(data);

    const title =
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $('meta[name="title"]').attr("content") ||
      "";

    const metaDescription =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="Description"]').attr("content") ||
      "";
    const headings = $("h1, h2")
      .map((_, el) => $(el).text().trim())
      .get()
      .join(" | ");
    const navLinks = $("nav a")
      .map((_, el) => $(el).text().trim())
      .get()
      .join(", ");

    const $bodyClone = $("body").clone();
    $bodyClone
      .find("script, style, noscript, header, nav, footer, form, iframe")
      .remove();
    const mainTextRaw = $bodyClone.text();
    const mainText = (mainTextRaw || "").replace(/\s+/g, " ").trim();

    const schemaData: unknown[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const jsonText = $(el).html();
      if (jsonText) {
        const parsed = safeParseJSON(jsonText);
        if (parsed !== null) schemaData.push(parsed);
      }
    });

    const openGraph: Record<string, string> = {};
    const twitter: Record<string, string> = {};
    $("meta").each((_, el) => {
      const $el = $(el);
      const prop = $el.attr("property") ?? $el.attr("name");
      const content = $el.attr("content") ?? $el.attr("value") ?? "";
      if (!prop) return;
      if (prop.startsWith("og:")) openGraph[prop.replace(/^og:/, "")] = content;
      if (prop.startsWith("twitter:"))
        twitter[prop.replace(/^twitter:/, "")] = content;
    });

    const canonical = $('link[rel="canonical"]').attr("href") ?? "";
    const lang = $("html").attr("lang") ?? "";
    const charset =
      $("meta[charset]").attr("charset") ??
      $('meta[http-equiv="Content-Type"]')
        .attr("content")
        ?.match(/charset=([^;]+)/)?.[1] ??
      "";
    const author = $('meta[name="author"]').attr("content") ?? "";
    const robots = $('meta[name="robots"]').attr("content") ?? "";

    const links = $("a[href]")
      .map((_, el) => ({
        text: $(el).text().trim(),
        href: $(el).attr("href") ?? "",
      }))
      .get()
      .slice(0, 500);
    const images = $("img[src]")
      .map((_, el) => ({
        src: $(el).attr("src") ?? "",
        alt: $(el).attr("alt") ?? "",
      }))
      .get()
      .slice(0, 200);

    const wordCount = mainText
      ? mainText.split(/\s+/).filter(Boolean).length
      : 0;

    return {
      title,
      metaDescription,
      headings,
      navLinks,
      mainText: mainText.slice(0, 4000),
      schemaData,
      wordCount,
      source: "cheerio",
      status,
      canonical,
      lang,
      charset,
      author,
      robots,
      openGraph,
      twitter,
      links,
      images,
    };
  } catch (err) {
    console.error(
      "Cheerio scrape failed:",
      (err as Error)?.message ?? String(err)
    );
    return null;
  }
}
