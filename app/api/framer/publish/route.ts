import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishArticleToFramer } from "@/lib/framerPublisher";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { articleId } = body;
    if (!articleId) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      console.error("Article fetch error:", articleError);
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Determine which Framer connection to use: 1) explicit connectionId in body 2) article's framer_connection_id 3) user's default connection 4) fallback to global env
    let connectionToUse: { projectUrl: string; apiKey: string } | null = null;

    const { connectionId } = body as any;

    try {
      if (connectionId) {
        const { data: conn } = await supabase
          .from('framer_connections')
          .select('*')
          .eq('id', connectionId)
          .single();
        if (conn?.api_key_encrypted) {
          const { decryptText } = await import('@/lib/crypto');
          const apiKey = decryptText(conn.api_key_encrypted);
          connectionToUse = { projectUrl: conn.project_url, apiKey };
        }
      }

      if (!connectionToUse && article.framer_connection_id) {
        const { data: conn } = await supabase
          .from('framer_connections')
          .select('*')
          .eq('id', article.framer_connection_id)
          .single();
        if (conn?.api_key_encrypted) {
          const { decryptText } = await import('@/lib/crypto');
          const apiKey = decryptText(conn.api_key_encrypted);
          connectionToUse = { projectUrl: conn.project_url, apiKey };
        }
      }

      if (!connectionToUse) {
        // Fetch user's default connection
        const { data: defaultConn } = await supabase
          .from('framer_connections')
          .select('*')
          .eq('user_id', article.user_id)
          .eq('is_default', true)
          .limit(1)
          .single();
        if (defaultConn?.api_key_encrypted) {
          const { decryptText } = await import('@/lib/crypto');
          const apiKey = decryptText(defaultConn.api_key_encrypted);
          connectionToUse = { projectUrl: defaultConn.project_url, apiKey };
        }
      }
    } catch (err) {
      console.warn('Failed to resolve Framer connection, will fall back to global env if available', err);
    }

    // If still no connectionToUse, fallback to global env
    if (!connectionToUse && (!process.env.FRAMER_API_KEY || !process.env.FRAMER_PROJECT_URL)) {
      return NextResponse.json({ error: 'Framer not configured on server (set FRAMER_API_KEY and FRAMER_PROJECT_URL) or configure a user connection' }, { status: 501 });
    }

    let result: any;
    try {
      result = await publishArticleToFramer(article, connectionToUse || undefined);
    } catch (err: any) {
      console.error('Framer publish failed:', err);
      return NextResponse.json({ error: 'Failed to publish to Framer', details: err?.message || String(err) }, { status: 500 });
    }

    // Update article with framer info if available
    let updateError: any = null;
    try {
      if (result?.framerUrl) {
        const updateBody: any = {
          framer_item_id: result.framerItemId?.toString() || null,
          framer_url: result.framerUrl,
          last_synced_to_framer: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (connectionId) updateBody.framer_connection_id = connectionId;

        const { data: updated, error: updateErr } = await supabase
          .from('articles')
          .update(updateBody)
          .eq('id', articleId)
          .select();

        if (updateErr) {
          updateError = updateErr;
          console.error('Failed to update article with Framer info:', updateErr);
        }
      }
    } catch (err) {
      updateError = err;
      console.error('Failed to update article with Framer info:', err);
    }

    return NextResponse.json({ success: true, framerUrl: result?.framerUrl, framerItemId: result?.framerItemId, updateError: updateError ? String(updateError) : null });
  } catch (err: any) {
    console.error("Framer publish route error:", err);
    return NextResponse.json({ error: "Failed to publish to Framer", details: String(err) }, { status: 500 });
  }
}
