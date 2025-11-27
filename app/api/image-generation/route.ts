// ...existing code...
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = (body.prompt || "").toString().trim();
    const size = (body.size || "1024*1024").toString();
    let n = Number.isFinite(body.n) ? Number(body.n) : Number(body.n || 1);
    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    // clamp n to reasonable bounds to avoid accidental abuse
    const MAX_N = 4;
    n = Math.max(1, Math.min(MAX_N, isNaN(n) ? 1 : Math.floor(n)));

    // prefer explicit Dashscope key but fall back to QWEN key if that's what you have
    const apiKey = process.env.QWEN_API_KEY || process.env.QWEN_API_KEY;
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
        negative_prompt: body.negative_prompt || "",
        prompt_extend: body.prompt_extend ?? true,
        watermark: body.watermark ?? false,
        size,
      },
    };

    const images: string[] = [];
    const rawResponses: any[] = [];

    // If n === 1, do single call. If n > 1, loop to request multiple images.
    for (let i = 0; i < n; i++) {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payloadBase),
      });

      const data = await resp.json();
      rawResponses.push(data);

      if (!resp.ok) {
        // return provider error and collected responses so far
        return NextResponse.json(
          { ok: false, status: resp.status, data, rawResponses },
          { status: resp.status }
        );
      }

      const choices = data?.output?.choices || [];
      for (const choice of choices) {
        const contentArr = choice?.message?.content || [];
        for (const item of contentArr) {
          if (item?.image) images.push(item.image);
        }
      }

      // stop early if provider returned zero images for this iteration
      if (images.length === 0 && i === 0) {
        // likely request format issue; return provider payload for debugging
        return NextResponse.json(
          { ok: false, message: "No images returned", raw: data },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, images, raw: rawResponses });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
// ...existing code...
