import axios from "axios";
import type { ScrapeResult } from "./types";

export interface NicheAnalysis {
  word: string; // Broad category like "technology", "clothing", "fitness"
  intentPhrase: string; // Specific intent like "men denim jeans", "AI chatbot tools"
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

  // Updated prompt to extract both broad category and specific intent phrase
  const prompt = `Analyze this website and return TWO things:
1. A broad category (word) - ONE word from this list: "technology", "marketing", "business", "health", "fitness", "education", "finance", "web-development", "software", "programming", "digital-marketing", "ecommerce", "lifestyle", "travel", "cooking", "gaming", "clothing", "fashion", "automotive", "real-estate"

2. A specific intent phrase (2-4 words) that captures what users would search for related to this site's main offering or content focus.

EXAMPLES:
- E-commerce men's jeans → word: "clothing", intentPhrase: "men denim jeans"
- AI chatbot platform → word: "technology", intentPhrase: "AI chatbot tools"
- Fitness coaching → word: "fitness", intentPhrase: "personal training program"
- Digital marketing agency → word: "marketing", intentPhrase: "digital marketing services"

CONTENT:
Title: ${scrape.title || ""}
Meta: ${scrape.metaDescription || ""}
Headings: ${scrape.headings || ""}
MainText: ${mainText}

Return JSON: { "word": "category from list", "intentPhrase": "specific 2-4 word phrase", "confidence": 0.9 }`;

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
    console.log("🔍 Analyzing niche with word + intent phrase...");
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

    let word = "technology"; // Default broad category
    let intentPhrase = "technology solutions"; // Default intent phrase
    let confidence: number | null = 0.9;

    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        const extractedWord = parsed.word?.toLowerCase().trim();
        const extractedIntent = parsed.intentPhrase?.toLowerCase().trim();
        
        // VALIDATE the word is from our approved list
        const validWords = [
          "technology", "marketing", "business", "health", "fitness", 
          "education", "finance", "web-development", "software", 
          "programming", "digital-marketing", "ecommerce", "lifestyle", 
          "travel", "cooking", "gaming", "clothing", "fashion", "automotive", "real-estate"
        ];
        
        if (extractedWord && validWords.includes(extractedWord)) {
          word = extractedWord;
          console.log(`✅ Valid word: ${word}`);
        } else {
          console.log(`⚠️ Invalid word "${extractedWord}", defaulting to "technology"`);
          word = "technology";
        }
        
        if (extractedIntent && extractedIntent.length > 0) {
          intentPhrase = extractedIntent;
          console.log(`✅ Intent phrase: ${intentPhrase}`);
        } else {
          console.log(`⚠️ No intent phrase, using default`);
          intentPhrase = `${word} solutions`;
        }
        
        confidence =
          typeof parsed.confidence === "number"
            ? parsed.confidence
            : confidence;
      } catch {
        console.log(`❌ Failed to parse response, using defaults`);
        word = "technology";
        intentPhrase = "technology solutions";
      }
    }

    console.log(`🎯 Final analysis - Word: "${word}", Intent: "${intentPhrase}"`);
    return { word, intentPhrase, confidence, raw: body };
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