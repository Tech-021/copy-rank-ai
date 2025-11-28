// ...existing code...
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
     console.log("DEBUG: /api/image-generation incoming body:", JSON.stringify(body).slice(0, 1000));
    const prompt = (body.prompt || "").toString().trim();
    const size = (body.size || "1328*1328").toString(); // Use one of the allowed sizes
    let n = Number.isFinite(body.n) ? Number(body.n) : Number(body.n || 1);
    if (!prompt) {
      console.log("DEBUG: missing prompt");
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
    // ...existing code...
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
    // provider returned non-2xx, capture body text for diagnostics
    const text = await resp.text().catch(() => "<unable to read provider response>");
    console.error(`DEBUG: provider error (status ${resp.status}):`, text.slice(0, 2000));
    rawResponses.push({ status: resp.status, body: text });
    return NextResponse.json(
      { ok: false, status: resp.status, provider_body: text, rawResponses },
      { status: resp.status }
    );
  }

  // resp.ok -> try parse JSON and log its keys
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
      if (item?.image) images.push(item.image);
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

    return NextResponse.json({ ok: true, images, raw: rawResponses });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
// ...existing code...
