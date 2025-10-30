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

  // CORRECTED PROMPT - Always DataForSEO compatible
  const prompt = `Classify this website into EXACTLY ONE category from this list:
"technology", "marketing", "business", "health", "fitness", "education", "finance", "web development", "software", "programming", "digital marketing", "ecommerce", "lifestyle", "travel", "cooking", "gaming"

RULES:
- Developers/Programmers/Engineers → "web development"
- Designers → "technology"
- Marketers/Agencies → "digital marketing"
- Business/Startups/Entrepreneurs → "business"
- Health/Fitness/Nutrition → "health" or "fitness"
- Education/Teachers/Courses → "education"
- Food/Recipes/Restaurants → "cooking"
- Travel/Bloggers → "travel"
- Games/Gaming → "gaming"
- Everything else → "technology"

CONTENT:
Title: ${scrape.title || ""}
Meta: ${scrape.metaDescription || ""}
Headings: ${scrape.headings || ""}
MainText: ${mainText}

Return JSON: { "niche": "exact category from list", "confidence": 0.9 }`;

  // CORRECTED SYSTEM PROMPT - More strict
  const messages = [
    {
      role: "system",
      content: `You are a strict classifier. ALWAYS return a category from this exact list: 
technology, marketing, business, health, fitness, education, finance, web development, 
software, programming, digital marketing, ecommerce, lifestyle, travel, cooking, gaming.
NEVER use any other categories. Always return valid JSON.`,
    },
    { role: "user", content: prompt },
  ];

  const payload = {
    model,
    messages,
    max_tokens: 256,
    temperature: 0.0,
    response_format: { type: "json_object" } // Force JSON output
  };

  try {
    console.log("🔍 Analyzing niche with strict DataForSEO categories...");
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

    let niche = "technology"; // Default to technology (always works with DataForSEO)
    let confidence: number | null = 0.9;

    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        const extractedNiche = parsed.niche?.toLowerCase().trim();
        
        // VALIDATE the niche is from our approved list
        const validNiches = [
          "technology", "marketing", "business", "health", "fitness", 
          "education", "finance", "web development", "software", 
          "programming", "digital marketing", "ecommerce", "lifestyle", 
          "travel", "cooking", "gaming"
        ];
        
        if (extractedNiche && validNiches.includes(extractedNiche)) {
          niche = extractedNiche;
          console.log(`✅ Valid niche: ${niche}`);
        } else {
          console.log(`⚠️ Invalid niche "${extractedNiche}", defaulting to "technology"`);
          niche = "technology";
        }
        
        confidence =
          typeof parsed.confidence === "number"
            ? parsed.confidence
            : confidence;
      } catch {
        console.log(`❌ Failed to parse response, defaulting to "technology"`);
        niche = "technology";
      }
    } else if (body?.niche) {
      niche = String(body.niche);
      confidence =
        typeof body.confidence === "number" ? body.confidence : confidence;
    }

    console.log(`🎯 Final niche for DataForSEO: "${niche}"`);
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
};