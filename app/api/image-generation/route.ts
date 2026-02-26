// ...existing code...
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // // Check authentication using JWT token from Authorization header
  // const authHeader = req.headers.get('authorization');
  // if (!authHeader || !authHeader.startsWith('Bearer ')) {
  //   return NextResponse.json(
  //     { error: "Authentication required" },
  //     { status: 401 }
  //   );
  // }

  // const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // const supabase = createClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   {
  //     global: {
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     },
  //   }
  // );

  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();

  // if (!user || !user.id) {
  //   return NextResponse.json(
  //     { error: "Authentication required" },
  //     { status: 401 }
  //   );
  // }

  // // Check if user needs onboarding
  // const { data: predata } = await supabaseAdmin
  //   .from('pre_data')
  //   .select('*')
  //   .eq('email', user.email)
  //   .order('created_at', { ascending: false })
  //   .limit(1)
  //   .maybeSingle();

  // const needsOnboarding = !predata || (() => {
  //   const hasWebsite = predata.website && predata.website.trim() !== '';
  //   const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0;
  //   const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0;
  //   return !hasWebsite || (!hasCompetitors && !hasKeywords);
  // })();

  // if (needsOnboarding) {
  //   return NextResponse.json(
  //     { error: "Onboarding required" },
  //     { status: 403 }
  //   );
  // }

  // // Check subscription status
  // const { data: userData } = await supabaseAdmin
  //   .from('users')
  //   .select('subscribe')
  //   .eq('id', user.id)
  //   .single();

  // // if (!userData?.subscribe) {
  // //   return NextResponse.json(
  // //     { error: "Subscription required" },
  // //     { status: 403 }
  // //   );
  // // }
  try {
    const body = await req.json();
    console.log("DEBUG: /api/image-generation incoming body:", JSON.stringify(body).slice(0, 1000));
    let prompt = (body.prompt || "").toString().trim();
    const size = (body.size || "1328*1328").toString();
    let n = Number.isFinite(body.n) ? Number(body.n) : Number(body.n || 1);
    
    if (!prompt) {
      console.log("DEBUG: missing prompt");
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // ========== ADD TEXT PREVENTION TO PROMPT ==========
    console.log("🖼️ Original prompt:", prompt.substring(0, 200));
    
    // Remove any text-related requests from the original prompt
    const textKeywords = /\b(text|word|letter|title|heading|caption|label|write|writing|written|typography|font|spell|spelling)\b/gi;
    const cleanedPrompt = prompt.replace(textKeywords, '');
    
    // Add STRONG text prevention instructions
    const textPrevention = "CRITICAL INSTRUCTION: This must be a purely visual illustration with ZERO text, ZERO words, ZERO letters, ZERO numbers, ZERO characters of any kind. DO NOT generate, render, or include any textual elements, written content, typography, labels, captions, titles, logos with text, watermarks, or readable characters in any language. The image must be 100% text-free and contain only visual imagery.";
    prompt = `${textPrevention} Create a visual illustration: ${cleanedPrompt}. STRICT REQUIREMENT: NO TEXT ANYWHERE IN THE IMAGE.`;
    
    console.log("🖼️ Enhanced prompt (strict no-text):", prompt.substring(0, 250));
    // ========== END TEXT PREVENTION ==========

    // clamp n to reasonable bounds
    const MAX_N = 4;
    n = Math.max(1, Math.min(MAX_N, isNaN(n) ? 1 : Math.floor(n)));

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );

    const base = (
      process.env.DASHSCOPE_BASE_URL ||
      "https://dashscope-intl.aliyuncs.com/api/v1"
    ).replace(/\/$/, "");
    const url = `${base}/services/aigc/multimodal-generation/generation`;

    // ========== ENHANCED PARAMETERS ==========
    const payloadBase = {
      model: "qwen-image-plus",
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        // ========== ADD NEGATIVE PROMPT ==========
        negative_prompt: "text, words, letters, alphabet, numbers, digits, typography, writing, headings, titles, captions, labels, annotations, logos with text, watermarks, signatures, written text, readable text, symbols, characters, fonts, calligraphy, written content, textual elements, infographic with text, subtitles, quotes, speech bubbles, text overlays, branded text, copyright text, any readable characters, legible writing, inscriptions, manuscript, printed text, handwriting, script, written language",
        // ========== END NEGATIVE PROMPT ==========
        prompt_extend: body.prompt_extend ?? true,
        watermark: body.watermark ?? false,
        size,
        // ========== ADD STYLE GUIDANCE ==========
        style: "illustration", // Force illustration style
        quality: "hd",
        cfg_scale: 9.0, // Maximum guidance scale for strictest prompt adherence and text prevention
        // ========== END STYLE GUIDANCE ==========
      },
    };

    console.log("🖼️ Sending to Qwen with negative_prompt to prevent text");
    // ========== END ENHANCED PARAMETERS ==========

    const images: string[] = [];
    const rawResponses: any[] = [];

    for (let i = 0; i < n; i++) {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payloadBase),
      });

      console.log("DEBUG: provider response status:", resp.status, "ok:", resp.ok);

      if (!resp.ok) {
        const text = await resp.text().catch(() => "<unable to read provider response>");
        console.error(`DEBUG: provider error (status ${resp.status}):`, text.slice(0, 2000));
        rawResponses.push({ status: resp.status, body: text });
        return NextResponse.json(
          { ok: false, status: resp.status, provider_body: text, rawResponses },
          { status: resp.status }
        );
      }

      let data;
      try {
        data = await resp.json();
        console.log("DEBUG: provider OK response keys:", Object.keys(data));
      } catch (parseErr) {
        const text = await resp.text().catch(() => "<unable to read provider response>");
        console.error("DEBUG: provider response not valid JSON. Text:", text.slice(0, 2000));
        rawResponses.push({ status: resp.status, body: text });
        return NextResponse.json({ ok: false, status: resp.status, provider_body: text, rawResponses }, { status: 500 });
      }

      rawResponses.push(data);
      const choices = data?.output?.choices || [];
      for (const choice of choices) {
        const contentArr = choice?.message?.content || [];
        for (const item of contentArr) {
          if (item?.image) {
            console.log(`✅ Generated image ${i + 1} (hopefully without text)`);
            images.push(item.image);
          }
        }
      }

      if (images.length === 0 && i === 0) {
        console.error("DEBUG: provider returned OK but no images in body:", JSON.stringify(data).slice(0, 1200));
        return NextResponse.json(
          { ok: false, message: "No images returned", raw: data },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      ok: true, 
      images, 
      raw: rawResponses,
      message: `Generated ${images.length} images with text prevention` 
    });
  } catch (err) {
    console.error("💥 Image generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}


