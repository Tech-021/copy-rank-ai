import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptText } from '@/lib/crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const token = authHeader.substring(7);

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data, error } = await supabase
      .from('webflow_connections')
      .select('id, site_id, site_name, collection_id, is_active, is_default, last_sync_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, connections: data });
  } catch (err: any) {
    console.error('GET /api/webflow/connections error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const token = authHeader.substring(7);

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { siteId, collectionId, apiKey, isDefault = false, siteName } = body;

    if (!siteId || !apiKey) return NextResponse.json({ error: 'siteId and apiKey are required (Site ID taken from Webflow Project Settings → General → Site ID)' }, { status: 400 });

    // Validate access to the provided site using the token. The validator may resolve slugs/domains to the canonical machine Site ID and return it.
    let siteIdToUse: string = siteId;
    try {
      const { validateSiteAccess } = await import('@/lib/webflowPublisher');
      const resolved = await validateSiteAccess(apiKey, siteId);
      if (resolved) siteIdToUse = resolved;
    } catch (err: any) {
      console.error('Site validation failed:', err);

      // Build detailed diagnostics for the client. If Webflow indicates the Site ID is invalid, provide an explicit hint/suggestion.
      const details: any = { status: err?.status, body: err?.body, hint: err?.hint };
      if (err?.body && typeof err.body === 'object') {
        const msg = String(err.body.msg || err?.body?.message || '');
        if (/Provided IDs are invalid: Site ID/i.test(msg) || (err.body.name && String(err.body.name).toLowerCase().includes('validationerror') && msg.toLowerCase().includes('site id'))) {
          details.hint = 'The provided Site ID appears invalid (Webflow rejected it). Make sure you use the Site ID shown in Webflow Project Settings → General → Site ID (it looks like a 24-character hex id, not the site slug or domain).';
          details.suggestion = 'Copy the Site ID from Webflow Project Settings → General → Site ID (e.g., 6464c7393abcd7023ad2a80a) and paste it into the Site ID field.';
        }
      }

      const statusCode = err?.status === 400 ? 400 : 500;
      return NextResponse.json({ error: err?.message || 'Site validation failed', details }, { status: statusCode });
    }

    // Encrypt API key
    let encrypted: string;
    try {
      encrypted = encryptText(apiKey, process.env.WEBFLOW_ENCRYPTION_KEY);
    } catch (err: any) {
      console.error('Encryption error:', err);
      return NextResponse.json({ error: 'Encryption failed' }, { status: 500 });
    }

    if (isDefault) {
      await supabase
        .from('webflow_connections')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data: existing } = await supabase
      .from('webflow_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('site_id', siteIdToUse)
      .limit(1)
      .single();

    if (existing) {
      const updates: any = {
        api_key_encrypted: encrypted,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (isDefault) updates.is_default = true;
      if (collectionId !== undefined) updates.collection_id = collectionId;
      if (siteName !== undefined) updates.site_name = siteName;

      const { data, error } = await supabase
        .from('webflow_connections')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, connection: data, note: 'updated existing' });
    }

    const { data, error } = await supabase
      .from('webflow_connections')
      .insert([{
        user_id: user.id,
        site_id: siteIdToUse,
        collection_id: collectionId || null,
        site_name: siteName || null,
        api_key_encrypted: encrypted,
        is_active: true,
        is_default: isDefault,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      if (String(error.message || '').toLowerCase().includes('unique')) {
        return NextResponse.json({ error: 'A Webflow connection for this site already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, connection: data });
  } catch (err: any) {
    console.error('POST /api/webflow/connections error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}