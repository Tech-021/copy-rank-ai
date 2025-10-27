import puppeteer from "puppeteer";
import type { ScrapeResult } from "./types.js";
function safeParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function scrapeWithPuppeteer(url: string): Promise<ScrapeResult> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );
    const responseObj = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    const status = responseObj?.status() ?? null;

    const result = await page.evaluate(() => {
      function removeAndGetText(selectors: string[]) {
        const body = document.body.cloneNode(true) as HTMLElement;
        selectors.forEach((sel) => {
          body.querySelectorAll(sel).forEach((el) => el.remove());
        });
        return (body.innerText || "").replace(/\s+/g, " ").trim();
      }

      const title =
        (document.querySelector("title")?.innerText ?? "").trim() ||
        (
          document.querySelector(
            'meta[property="og:title"]'
          ) as HTMLMetaElement | null
        )?.getAttribute("content") ||
        (
          document.querySelector(
            'meta[name="twitter:title"]'
          ) as HTMLMetaElement | null
        )?.getAttribute("content") ||
        "";

      const metaDescription =
        (
          document.querySelector(
            'meta[name="description"]'
          ) as HTMLMetaElement | null
        )?.content ||
        (
          document.querySelector(
            'meta[property="og:description"]'
          ) as HTMLMetaElement | null
        )?.getAttribute("content") ||
        (
          document.querySelector(
            'meta[name="twitter:description"]'
          ) as HTMLMetaElement | null
        )?.getAttribute("content") ||
        "";

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
        (
          document.querySelector("meta[charset]") as HTMLMetaElement | null
        )?.getAttribute("charset") ||
        (
          document.querySelector(
            'meta[http-equiv="Content-Type"]'
          ) as HTMLMetaElement | null
        )
          ?.getAttribute("content")
          ?.match(/charset=([^;]+)/)?.[1] ||
        "";

      const author =
        (
          document.querySelector(
            'meta[name="author"]'
          ) as HTMLMetaElement | null
        )?.content || "";
      const robots =
        (
          document.querySelector(
            'meta[name="robots"]'
          ) as HTMLMetaElement | null
        )?.content || "";

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

    const schemaData: unknown[] = [];
    for (const txt of result.schemaNodes) {
      if (txt) {
        const parsed = safeParseJSON(txt);
        if (parsed !== null) schemaData.push(parsed);
      }
    }

    const mainText = (result.mainText ?? "").slice(0, 4000);
    const wordCount = mainText
      ? mainText.split(/\s+/).filter(Boolean).length
      : 0;

    return {
      title: result.title,
      metaDescription: result.metaDescription,
      headings: result.headings,
      navLinks: result.navLinks,
      mainText,
      schemaData,
      wordCount,
      source: "puppeteer",
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
  } finally {
    await browser.close();
  }
}
