import axios from "axios";
import type { ScrapeResult } from "./types";

export interface NicheAnalysis {
  niche: string;
  confidence?: number | null;
  raw?: any;
}

export async function analyzeWithQwen(
  scrape: ScrapeResult
): Promise<NicheAnalysis> {
  const apiUrl = process.env.QWEN_API_URL;
  const apiKey = process.env.QWEN_API_KEY;
  const model = process.env.QWEN_MODEL ?? "qwen-plus";

  if (!apiUrl || !apiKey) {
    const err = new Error(
      "QWEN not configured (missing QWEN_API_URL or QWEN_API_KEY)"
    );
    (err as any).status = 500;
    throw err;
  }

  const mainText = (scrape.mainText || "").slice(0, 4000);
  const schemaSnippet = JSON.stringify(scrape.schemaData || []).slice(0, 1000);

  const prompt = `Classify the niche of this site in one short label and optional confidence.
Title: ${scrape.title || ""}
Meta: ${scrape.metaDescription || ""}
Headings: ${scrape.headings || ""}
MainText: ${mainText}
Schema: ${schemaSnippet}
Return JSON: { "niche": "...", "confidence": 0-1 }`;

  // Build OpenAI-compatible messages payload
  const messages = [
    {
      role: "system",
      content:
        'You are a concise classifier. Reply with JSON: {"niche": "...", "confidence": 0-1} only.',
    },
    { role: "user", content: prompt },
  ];

  const payload = {
    model,
    messages,
    max_tokens: 256,
    temperature: 0.0,
  };

  try {
    console.log("QWEN->compatible-mode payload keys:", Object.keys(payload));
    const resp = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    const body = resp.data;
    // extract from choices -> message.content (OpenAI shape)
    let rawText: string | null = null;
    if (Array.isArray(body?.choices) && body.choices[0]) {
      rawText = (body.choices[0].message?.content ??
        body.choices[0].text ??
        null) as string | null;
    }

    let niche = "unknown";
    let confidence: number | null = null;

    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        niche = parsed.niche ?? niche;
        confidence =
          typeof parsed.confidence === "number"
            ? parsed.confidence
            : confidence;
      } catch {
        niche = rawText.split("\n")[0].slice(0, 200) || niche;
      }
    } else if (body?.niche) {
      niche = String(body.niche);
      confidence =
        typeof body.confidence === "number" ? body.confidence : confidence;
    }

    return { niche, confidence, raw: body };
  } catch (err) {
    const anyErr = err as any;
    if (anyErr?.response) {
      const status = anyErr.response.status;
      const body = anyErr.response.data;
      const error = new Error(`Qwen request failed with status ${status}`);
      (error as any).status = status;
      (error as any).body = body;
      console.error("QWEN upstream error body:", body);
      throw error;
    }
    throw err;
  }
}
