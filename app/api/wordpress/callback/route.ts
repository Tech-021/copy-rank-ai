import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptToken, testWordPressConnection } from '@/lib/wordpressService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=missing_params`
      );
    }

    // Verify state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('user_id, expires_at')
      .eq('state', state)
      .single();

    if (stateError || !stateData) {
      console.error('Invalid state token:', stateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=invalid_state`
      );
    }

    // Check if state has expired
    if (new Date(stateData.expires_at) < new Date()) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=state_expired`
      );
    }

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      client_id: process.env.WORDPRESS_CLIENT_ID!,
      client_secret: process.env.WORDPRESS_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.WORDPRESS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/wordpress/callback`,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch(
      'https://public-api.wordpress.com/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams,
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();

    // Get site information
    const siteResponse = await fetch(
      'https://public-api.wordpress.com/rest/v1.1/me/sites',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!siteResponse.ok) {
      console.error('Failed to fetch sites');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=site_fetch_failed`
      );
    }

    const siteData = await siteResponse.json();
    const primarySite = siteData.sites && siteData.sites[0]; // Use first site

    if (!primarySite) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=no_sites`
      );
    }

    // Test connection
    const connectionTest = await testWordPressConnection(
      primarySite.URL,
      tokenData.access_token
    );

    if (!connectionTest.success) {
      console.error('Connection test failed:', connectionTest.error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=connection_test_failed`
      );
    }

    // Encrypt and store credentials
    const encryptedToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptToken(tokenData.refresh_token)
      : null;

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    const { error: upsertError } = await supabase
      .from('wordpress_connections')
      .upsert({
        user_id: stateData.user_id,
        site_url: primarySite.URL,
        site_id: primarySite.ID?.toString(),
        site_name: primarySite.name || primarySite.title || 'WordPress Site',
        access_token: encryptedToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: expiresAt?.toISOString(),
        is_active: true,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,site_url',
      });

    if (upsertError) {
      console.error('Failed to store connection:', upsertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=storage_failed`
      );
    }

    // Clean up state token
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?wordpress=connected&site=${encodeURIComponent(primarySite.name || 'WordPress')}`
    );
  } catch (error) {
    console.error('WordPress callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?error=connection_failed`
    );
  }
}
