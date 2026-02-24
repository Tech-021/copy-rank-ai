import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken, publishToWordPress } from '@/lib/wordpressService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
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

    const body = await request.json();
    const { articleId, connectionId, status = 'draft' } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    if (!connectionId) {
      return NextResponse.json(
        { error: 'WordPress connection ID is required' },
        { status: 400 }
      );
    }

    // Get article
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      console.error('Article fetch error:', articleError);
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Get WordPress connection
    const { data: connection, error: connectionError } = await supabase
      .from('wordpress_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      console.error('Connection fetch error:', connectionError);
      return NextResponse.json(
        { error: 'WordPress connection not found or inactive' },
        { status: 404 }
      );
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decryptToken(connection.access_token);
    } catch (error) {
      console.error('Token decryption error:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt WordPress credentials. Please reconnect your WordPress site.' },
        { status: 500 }
      );
    }

    // Get featured image (first generated image if available)
    let featuredImage: string | undefined;
    if (article.generated_images && Array.isArray(article.generated_images) && article.generated_images.length > 0) {
      featuredImage = article.generated_images[0];
    } else if (article.hero_image) {
      featuredImage = article.hero_image;
    }

    // Publish to WordPress
    let result;
    try {
      result = await publishToWordPress(
        {
          siteUrl: connection.site_url,
          accessToken,
        },
        {
          title: article.title,
          content: article.content || article.html_content || '',
          slug: article.slug,
          status: status as 'draft' | 'publish',
          excerpt: article.meta_description || '',
          featuredImage,
        }
      );
    } catch (error) {
      console.error('WordPress publish error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to publish to WordPress',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Update article with WordPress info
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        wordpress_post_id: result.id.toString(),
        wordpress_url: result.url,
        wordpress_connection_id: connectionId,
        last_synced_to_wordpress: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateError) {
      console.error('Failed to update article with WordPress info:', updateError);
      // Don't fail the request since the article was published successfully
    }

    return NextResponse.json({
      success: true,
      wordpressUrl: result.url,
      wordpressPostId: result.id,
      message: `Article ${status === 'publish' ? 'published' : 'saved as draft'} to WordPress`,
    });
  } catch (error) {
    console.error('WordPress publish error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to publish to WordPress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
