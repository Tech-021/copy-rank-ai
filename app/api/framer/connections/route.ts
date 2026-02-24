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
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
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

    const { data, error } = await supabase
      .from('framer_connections')
      .select('id, project_url, is_active, is_default, last_sync_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, connections: data });
  } catch (err: any) {
    console.error('GET /api/framer/connections error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
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
    const { projectUrl, apiKey, isDefault = false, name } = body;

    if (!projectUrl || !apiKey) return NextResponse.json({ error: 'projectUrl and apiKey are required' }, { status: 400 });

    // Encrypt API key
    let encrypted: string;
    try {
      encrypted = encryptText(apiKey);
    } catch (err: any) {
      console.error('Encryption error:', err);
      return NextResponse.json({ error: 'Encryption failed' }, { status: 500 });
    }

    // If isDefault true, unset other defaults for this user
    if (isDefault) {
      await supabase
        .from('framer_connections')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    // If a connection already exists for this user+project, update it instead of inserting (avoid unique constraint error)
    const { data: existing } = await supabase
      .from('framer_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_url', projectUrl)
      .limit(1)
      .single();

    if (existing) {
      const updates: any = {
        api_key_encrypted: encrypted,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (isDefault) updates.is_default = true;

      const { data, error } = await supabase
        .from('framer_connections')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update existing Framer connection:', error);
        return NextResponse.json({ error: 'Failed to update existing connection' }, { status: 500 });
      }

      return NextResponse.json({ success: true, connection: data, note: 'updated existing' });
    }

    const { data, error } = await supabase
      .from('framer_connections')
      .insert([{
        user_id: user.id,
        project_url: projectUrl,
        api_key_encrypted: encrypted,
        is_active: true,
        is_default: isDefault,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      // handle unique constraint race or unexpected errors
      if (String(error.message || '').toLowerCase().includes('unique')) {
        return NextResponse.json({ error: 'A Framer connection for this project already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, connection: data });
  } catch (err: any) {
    console.error('POST /api/framer/connections error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}
