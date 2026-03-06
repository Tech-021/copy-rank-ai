import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connect } from "framer-api";
import crypto from "crypto";

// Supabase admin client – used to read articles and user settings
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FramerConfig = {
  projectUrl?: string | null;
  apiKey?: string | null;
  collectionId?: string | null;
};

// Decrypt API keys stored with AES-256-GCM (same helper as in user settings).
const CREDENTIALS_ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || "";
const hasEncryptionKey = Boolean(CREDENTIALS_ENCRYPTION_KEY);
const encryptionKeyBuffer = hasEncryptionKey
  ? crypto.createHash("sha256").update(CREDENTIALS_ENCRYPTION_KEY).digest()
  : null;

function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!encryptionKeyBuffer) return value;
  try {
    const data = Buffer.from(value, "base64");
    if (data.length < 12 + 16) return value;
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const text = data.subarray(28);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKeyBuffer,
      iv
    );
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return value;
  }
}

export async function POST(request: Request) {
  try {
    // 1) Auth: verify Supabase user from Bearer token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    // 2) Read JSON body
    const body = await request.json();
    const { articleId } = body as { articleId?: string };

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // 3) Load article from Supabase and ensure it belongs to the current user
    console.log("Framer publish: incoming articleId", articleId, "userId", user.id);
    const { data: article, error: articleError } = await supabaseAdmin
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      console.warn("Framer publish: article lookup failed", {
        articleId,
        userId: user.id,
        error: articleError,
      });
      return NextResponse.json(
        {
          error: "Article not found",
          details: articleError?.message ?? null,
        },
        { status: 404 }
      );
    }

    if (article.user_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this article" },
        { status: 403 }
      );
    }

    // 4) Load per-user Framer settings from dedicated credentials table
    let framerConfig: FramerConfig | undefined;
    try {
      const { data: credRow, error: credError } = await supabaseAdmin
        .from("framer_credentials")
        .select("project_url, api_key, collection_id")
        .eq("user_id", user.id)
        .is("website_id", null)
        .maybeSingle();

      if (!credError && credRow) {
        const c = credRow as any;
        framerConfig = {
          projectUrl: c.project_url,
          apiKey: decryptSecret(c.api_key),
          collectionId: c.collection_id,
        };
      }
    } catch (err) {
      console.warn("Failed to load per-user Framer credentials", err);
    }

    if (
      !framerConfig ||
      !framerConfig.projectUrl ||
      !framerConfig.apiKey ||
      !framerConfig.collectionId
    ) {
      return NextResponse.json(
        {
          error: "Framer is not configured for this user",
          details:
            "Please set Framer Project URL, API key, and Collection ID in Settings → Connections.",
        },
        { status: 400 }
      );
    }

    // 5) Connect to Framer Server API
    console.log("Framer publish: connecting to project", framerConfig.projectUrl);
    const framer = await connect(
      framerConfig.projectUrl,
      framerConfig.apiKey
    );

    // Try to resolve the collection either by ID or name (user-friendly)
    let collection: any = null;
    try {
      const hasGetCollections = typeof (framer as any).getCollections === "function";
      const hasGetCollection = typeof (framer as any).getCollection === "function";

      let allCollections: any[] = [];

      if (hasGetCollections) {
        allCollections = await (framer as any).getCollections();
        console.log(
          "Framer publish: available collections",
          allCollections.map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: (c as any).slug,
          }))
        );
      }

      console.log(
        "Framer publish: resolving collection with id/name",
        framerConfig.collectionId
      );

      const targetRaw = framerConfig.collectionId;
      if (targetRaw && allCollections.length > 0) {
        const target = String(targetRaw).toLowerCase();
        const meta =
          allCollections.find((c: any) => {
            const id = String(c.id ?? "").toLowerCase();
            const name = String(c.name ?? "").toLowerCase();
            const slug = String((c as any).slug ?? "").toLowerCase();
            return id === target || name === target || slug === target;
          }) || null;

        if (meta && hasGetCollection && meta.id) {
          // Resolve to a managed collection by its ID (recommended)
          collection = await (framer as any).getCollection(meta.id);
        } else {
          // Fall back to using the meta object directly if it exposes addItems/createItem
          collection = meta;
        }
      } else if (targetRaw && hasGetCollection) {
        // Fallback: older API with no getCollections – treat the value as the ID
        collection = await (framer as any).getCollection(targetRaw);
      }
    } catch (err) {
      console.error("Framer publish: error resolving collection", err);
      collection = null;
    }

    if (!collection) {
      return NextResponse.json(
        {
          error: "Framer collection not found",
          details:
            "Ensure the Collection ID or name matches a CMS collection in your Framer project.",
        },
        { status: 400 }
      );
    }

    // 6) Try to load fields so we can map title/slug/excerpt/content by name
    let fields: any[] = [];
    try {
      if (typeof (collection as any).getFields === "function") {
        fields = await (collection as any).getFields();
      } else if (Array.isArray((collection as any).fields)) {
        fields = (collection as any).fields;
      }
      console.log(
        "Framer publish: collection fields",
        fields.map((f: any) => ({
          id: f.id,
          name: f.name,
          slug: (f as any).slug,
          type: f.type,
        }))
      );
    } catch (err) {
      console.warn("Framer publish: failed to load collection fields", err);
    }

    const findField = (candidates: string[]) => {
      const lowerCandidates = candidates.map((c) => c.toLowerCase());
      return (
        fields.find((f) =>
          lowerCandidates.includes(String(f.slug || f.name || "").toLowerCase())
        ) || null
      );
    };

    const titleField = findField(["title", "name"]);
    const slugField = findField(["slug"]);
    const excerptField = findField(["excerpt", "summary"]);
    const contentField = findField(["content", "body", "article"]);

    console.log("Framer publish: resolved field mapping", {
      hasTitle: !!titleField,
      hasSlug: !!slugField,
      hasExcerpt: !!excerptField,
      hasContent: !!contentField,
    });

    // Only require title + content; slug/excerpt are optional.
    if (!titleField || !contentField) {
      return NextResponse.json(
        {
          error: "Framer collection fields not compatible",
          details:
            "Expected fields named/slugged like title and content (slug and excerpt are optional). Please adjust your Framer CMS or configure a more specific mapping.",
        },
        { status: 400 }
      );
    }

    // 7) Collect any generated image URLs from the article
    const rawImages =
      (article as any).generatedImages ??
      (article as any).generated_images ??
      (article as any).generated_images_urls ??
      (article as any).generated_images_url ??
      (article as any).images ??
      null;

    let imageUrls: string[] = [];
    if (Array.isArray(rawImages)) {
      imageUrls = rawImages.filter(
        (u) => typeof u === "string" && u.length > 0
      );
    } else if (typeof rawImages === "string" && rawImages.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawImages);
        if (Array.isArray(parsed)) {
          imageUrls = parsed.filter(
            (u) => typeof u === "string" && u.length > 0
          );
        } else {
          imageUrls = [rawImages];
        }
      } catch {
        imageUrls = [rawImages];
      }
    }

    // Build final HTML content, including inline <img> tags for any images
    let finalContent: string =
      (article as any).content ||
      `<p>${(article as any).preview || "Content not available."}</p>`;

    if (imageUrls.length > 0) {
      const imagesHtml = imageUrls
        .slice(0, 3)
        .map(
          (src, index) =>
            `<p><img src="${src}" alt="${(article as any).title || "image"} ${
              index + 1
            }" /></p>`
        )
        .join("");
      finalContent += imagesHtml;
    }

    // 8) Build fieldData for Framer CMS item
    const fieldData: Record<string, any> = {};
    const setStringField = (field: any, value: string | null | undefined) => {
      if (!field || !field.id || !value) return;
      fieldData[field.id] = { type: "string", value };
    };

    setStringField(
      titleField,
      (article as any).meta_title || (article as any).title || "Untitled article"
    );
    setStringField(slugField, (article as any).slug || (article as any).id);
    setStringField(
      excerptField,
      (article as any).preview ||
        (article as any).meta_description ||
        null
    );

    if (contentField && contentField.id) {
      fieldData[contentField.id] = {
        type: "formattedText",
        value: finalContent,
        contentType: "html",
      };
    }

    // Let Framer assign the internal item ID; we only provide a slug.
    const itemSlug =
      (article as any).slug ||
      String((article as any).id).slice(0, 48);

    // 8) Create a new item in the Framer collection with a unique slug
    const hasCreateItem = typeof (collection as any).createItem === "function";
    const hasAddItems = typeof (collection as any).addItems === "function";

    if (!hasCreateItem && !hasAddItems) {
      return NextResponse.json(
        {
          error: "Framer collection is not writable",
          details:
            "This collection does not support adding items via the Server API.",
        },
        { status: 400 }
      );
    }

    const maxSlugAttempts = 5;
    let finalSlug = itemSlug;

    for (let attempt = 0; attempt < maxSlugAttempts; attempt++) {
      const slugToTry =
        attempt === 0 ? itemSlug : `${itemSlug}-${attempt + 1}`;

      console.log("Framer publish: creating CMS item", {
        itemSlug: slugToTry,
        fieldKeys: Object.keys(fieldData),
      });

      try {
        if (hasCreateItem) {
          // Preferred: explicit single-item creation
          await (collection as any).createItem({
            slug: slugToTry,
            fieldData,
          });
        } else if (hasAddItems) {
          // Fallback: batch creation without specifying IDs
          await (collection as any).addItems([
            {
              slug: slugToTry,
              fieldData,
            },
          ]);
        }

        finalSlug = slugToTry;
        break;
      } catch (err: any) {
        const message = String(err?.message || "");
        if (message.includes("Duplicate slug")) {
          console.warn(
            "Framer publish: duplicate slug, trying next suffix",
            slugToTry
          );
          if (attempt === maxSlugAttempts - 1) {
            throw err;
          }
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      framerSlug: finalSlug,
    });
  } catch (error) {
    console.error("Error publishing article to Framer:", error);
    return NextResponse.json(
      {
        error: "Unexpected error while publishing to Framer",
      },
      { status: 500 }
    );
  }
}

