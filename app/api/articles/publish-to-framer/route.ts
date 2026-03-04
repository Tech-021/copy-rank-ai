import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connect } from "framer-api";

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

    // 4) Load per-user Framer settings
    let framerConfig: FramerConfig | undefined;
    try {
      const { data: settingsRow } = await supabaseAdmin
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .is("website_id", null)
        .maybeSingle();

      const s = (settingsRow as any)?.settings || {};
      if (
        s &&
        (s.framerProjectUrl || s.framerApiKey || s.framerCollectionId)
      ) {
        framerConfig = {
          projectUrl: s.framerProjectUrl,
          apiKey: s.framerApiKey,
          collectionId: s.framerCollectionId,
        };
      }
    } catch (err) {
      console.warn("Failed to load per-user Framer settings", err);
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

    // Try to resolve the collection either by ID or name
    let collection: any = null;
    try {
      if (typeof (framer as any).getCollection === "function") {
        collection = await (framer as any).getCollection(
          framerConfig.collectionId
        );
      } else if (typeof (framer as any).getCollections === "function") {
        const collections = await (framer as any).getCollections();
        collection =
          collections.find(
            (c: any) =>
              c.id === framerConfig!.collectionId ||
              c.name === framerConfig!.collectionId
          ) || null;
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

    if (!titleField || !slugField || !contentField) {
      return NextResponse.json(
        {
          error: "Framer collection fields not compatible",
          details:
            "Expected fields named/slugged like title, slug, content (and optional excerpt). Please adjust your Framer CMS or configure a more specific mapping.",
        },
        { status: 400 }
      );
    }

    // 7) Build fieldData for Framer CMS item
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
        value:
          (article as any).content ||
          `<p>${(article as any).preview || "Content not available."}</p>`,
        contentType: "html",
      };
    }

    const itemId = String((article as any).id);
    const itemSlug =
      (article as any).slug ||
      String((article as any).id).slice(0, 12);

    // 8) Create a new item in the Framer collection
    console.log("Framer publish: creating CMS item", {
      itemId,
      itemSlug,
      fieldKeys: Object.keys(fieldData),
    });

    if (typeof (collection as any).addItems === "function") {
      await (collection as any).addItems([
        {
          id: itemId,
          slug: itemSlug,
          fieldData,
        },
      ]);
    } else if (typeof (collection as any).createItem === "function") {
      await (collection as any).createItem({
        id: itemId,
        slug: itemSlug,
        fieldData,
      });
    } else {
      return NextResponse.json(
        {
          error: "Framer collection is not writable",
          details:
            "This collection does not support adding items via the Server API.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      framerItemId: itemId,
      framerSlug: itemSlug,
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

