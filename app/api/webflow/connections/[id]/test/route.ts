import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptText } from '@/lib/crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
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

    const { data: connection, error } = await supabase
      .from('webflow_connections')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    if (!connection.api_key_encrypted) return NextResponse.json({ error: 'No API key stored' }, { status: 400 });

    let apiKey: string;
    try {
      apiKey = decryptText(connection.api_key_encrypted, process.env.WEBFLOW_ENCRYPTION_KEY);
    } catch (err: any) {
      console.error('Decryption error:', err);
      return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
    }

    // Try to call Webflow to fetch site/collections to validate
    try {
      const base = 'https://api.webflow.com';
      const headers = { 'Authorization': `Bearer ${apiKey}`, 'accept-version': '1.0.0' } as any;
      const res = await fetch(`${base}/sites/${connection.site_id}/collections`, { method: 'GET', headers });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch (e) { json = null; }
      if (!res.ok) {
        return NextResponse.json({ error: json || text || 'Webflow API error' }, { status: 500 });
      }

      // Also try fetching site info
      const siteRes = await fetch(`${base}/sites/${connection.site_id}`, { method: 'GET', headers });
      const siteText = await siteRes.text();
      let siteJson: any = null;
      try { siteJson = JSON.parse(siteText); } catch (e) { siteJson = null; }

      return NextResponse.json({ success: true, collections: json, site: siteJson });
    } catch (err: any) {
      console.error('Webflow test error:', err);
      return NextResponse.json({ error: err?.message || 'Webflow connection test failed' }, { status: 500 });
    }
  } catch (err: any) {
    console.error('POST /api/webflow/connections/:id/test error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}