import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in database temporarily (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const { error: insertError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to store OAuth state:', insertError);
      console.error('Insert error details:', JSON.stringify(insertError));
      return NextResponse.json(
        { 
          error: 'Failed to initiate OAuth',
          details: insertError?.message || 'Database error',
          hint: 'Make sure the migration-wordpress-integration.sql has been run'
        },
        { status: 500 }
      );
    }

    // Build WordPress OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.WORDPRESS_CLIENT_ID!,
      redirect_uri: process.env.WORDPRESS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/wordpress/callback`,
      response_type: 'code',
      scope: 'posts:write media:upload',
      state,
    });

    const authUrl = `https://public-api.wordpress.com/oauth2/authorize?${params}`;

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('WordPress connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate WordPress connection' },
      { status: 500 }
    );
  }
}
