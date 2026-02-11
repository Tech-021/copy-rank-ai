import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishArticleToWebflow, publishArticleIfConfigured } from '@/lib/webflowPublisher';
import { decryptText } from '@/lib/crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const token = authHeader.substring(7);

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { articleId, connectionId } = body;
    if (!articleId) return NextResponse.json({ error: 'articleId is required' }, { status: 400 });

    const { data: articleRow, error: articleErr } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleErr || !articleRow) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // If connection provided, look it up
    if (connectionId) {
      const { data: connRow, error: connErr } = await supabaseAdmin
        .from('webflow_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (connErr || !connRow) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      if (!connRow.api_key_encrypted) return NextResponse.json({ error: 'No API key stored' }, { status: 400 });

      // Ensure a collection id is configured on the connection (or fallback to env var)
      if (!connRow.collection_id && !process.env.WEBFLOW_COLLECTION_ID) {
        return NextResponse.json({ error: 'Connection is missing `collection_id`. Please set the Webflow collection id on the connection or define `WEBFLOW_COLLECTION_ID` as an env var.' }, { status: 400 });
      }

      let apiKey: string;
      try {
        apiKey = decryptText(connRow.api_key_encrypted);
      } catch (err: any) {
        console.error('Decryption error:', err);
        return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
      }

      try {
        const result = await publishArticleToWebflow(articleRow, { siteId: connRow.site_id, collectionId: connRow.collection_id || undefined, apiKey });
        if (result?.webflowUrl) {
          await supabaseAdmin
            .from('articles')
            .update({
              webflow_item_id: result.webflowItemId?.toString() || null,
              webflow_url: result.webflowUrl,
              webflow_connection_id: connRow.id,
              last_synced_to_webflow: new Date().toISOString(),
            })
            .eq('id', articleRow.id);
        }

        // If we auto-created a collection, persist it to the user's connection for future publishes
        if (result?.createdCollectionId && !connRow.collection_id) {
          try {
            await supabaseAdmin
              .from('webflow_connections')
              .update({ collection_id: result.createdCollectionId })
              .eq('id', connRow.id);
            console.log('[webflow] persisted new collection id to connection:', result.createdCollectionId);
          } catch (persistErr: any) {
            console.warn('[webflow] failed to persist created collection id:', persistErr?.message || persistErr);
          }
        }

        return NextResponse.json({ success: true, webflowUrl: result?.webflowUrl, publishResult: result?.publishResult });
      } catch (err: any) {
        // Log full error details to aid debugging (includes status, body, and optional hint)
        console.error('Webflow publish failed (connection):', {
          message: err?.message,
          status: err?.status,
          statusText: err?.statusText,
          body: err?.body || err?.bodyText,
          hint: err?.hint,
        });

        // If we have a hint from the Webflow client, expose it to the response to guide the operator
        const clientMessage = err?.hint ? `${err.message} - Hint: ${err.hint}` : err?.message || 'Publish failed';
        return NextResponse.json({ error: clientMessage }, { status: 500 });
      }
    }

    // Fallback to global env
    try {
      const result = await publishArticleIfConfigured(articleRow);
      if (result?.webflowUrl) {
        await supabaseAdmin
          .from('articles')
          .update({
            webflow_item_id: result.webflowItemId?.toString() || null,
            webflow_url: result.webflowUrl,
            last_synced_to_webflow: new Date().toISOString(),
          })
          .eq('id', articleRow.id);
      }
      return NextResponse.json({ success: true, webflowUrl: result?.webflowUrl, publishResult: result?.publishResult });
    } catch (err: any) {
      console.error('Webflow publish failed (global):', err);
      return NextResponse.json({ error: err?.message || 'Publish failed' }, { status: 500 });
    }

  } catch (err: any) {
    console.error('POST /api/webflow/publish error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}
