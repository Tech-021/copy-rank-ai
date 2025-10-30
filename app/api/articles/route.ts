import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    
    let query = supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (websiteId) {
      query = query.eq('website_id', websiteId);
    }

    const { data: articles, error } = await query;

    if (error) {
      throw error;
    }

    // Transform to camelCase for frontend
    const transformedArticles = articles?.map(article => ({
      id: article.id,
      title: article.title,
      content: article.content,
      keyword: article.keyword,
      status: article.status,
      date: new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      preview: article.preview,
      wordCount: article.word_count,
      metaTitle: article.meta_title,
      metaDescription: article.meta_description,
      slug: article.slug,
      focusKeyword: article.focus_keyword,
      readingTime: article.reading_time,
      contentScore: article.content_score,
      keywordDensity: article.keyword_density,
      ogTitle: article.og_title,
      ogDescription: article.og_description,
      twitterTitle: article.twitter_title,
      twitterDescription: article.twitter_description,
      tags: article.tags || [],
      category: article.category,
      estimatedTraffic: article.estimated_traffic,
      generatedAt: article.created_at
    })) || [];

    return NextResponse.json({
      success: true,
      articles: transformedArticles
    });

  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('articles')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, article: data });

  } catch (error) {
    console.error('Error updating article:', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}