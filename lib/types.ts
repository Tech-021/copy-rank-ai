export type Source = "cheerio" | "puppeteer";

export interface ScrapeResult {
  title: string;
  metaDescription: string;
  headings: string;
  navLinks: string;
  mainText: string;
  schemaData: unknown[];
  wordCount: number;
  source: Source;

  status?: number | null;
  canonical?: string;
  lang?: string;
  charset?: string;
  author?: string;
  robots?: string;
  openGraph?: Record<string, string>;
  twitter?: Record<string, string>;
  links?: { text: string; href: string }[];
  images?: { src: string; alt: string }[];
}
