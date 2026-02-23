import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptText } from '@/lib/crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    const body = await request.json();
    const updates: any = {};
    if (body.is_default !== undefined) updates.is_default = Boolean(body.is_default);
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.collectionId !== undefined) updates.collection_id = body.collectionId;
    updates.updated_at = new Date().toISOString();

    if (updates.is_default) {
      await supabase
        .from('webflow_connections')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data, error } = await supabase
      .from('webflow_connections')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, connection: data });
  } catch (err: any) {
    console.error('PATCH /api/webflow/connections/:id error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    const { data, error } = await supabase
      .from('webflow_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/webflow/connections/:id error:', err);
    return NextResponse.json({ error: err?.message || 'server_error' }, { status: 500 });
  }
}