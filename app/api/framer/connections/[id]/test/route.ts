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
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: connection, error } = await supabase
      .from('framer_connections')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (!connection.api_key_encrypted) return NextResponse.json({ error: 'No API key stored' }, { status: 400 });

    let apiKey: string;
    try {
      apiKey = decryptText(connection.api_key_encrypted);
    } catch (err: any) {
      console.error('Decryption error:', err);
      return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
    }

    // Try to connect to Framer using framer-api
    try {
      const framerModule = await import('framer-api');
      const framer = await framerModule.connect(connection.project_url, apiKey as any);
      const info = await framer.getProjectInfo();
      await framer.disconnect();
      return NextResponse.json({ success: true, info });
    } catch (err: any) {
      console.error('Framer test error:', err);
      return NextResponse.json({ error: err?.message || 'Framer connection test failed' }, { status: 500 });
    }
  } catch (err: any) {
    console.error('POST /api/framer/connections/:id/test error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}
