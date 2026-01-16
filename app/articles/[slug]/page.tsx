import React from "react";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/client";
import { getUser } from "@/lib/auth";

interface Article {
  id: string;
  title: string;
  content: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  keyword: string | null;
  created_at: string | null;
  generated_images?: string[] | null;
}

function renderContentWithImages(
  content: string,
  images: string[] = [],
  maxImagesToInsert = 3
) {
  if (!content) return null;

  const paragraphs = content
    .split(/<\/p>/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith("</p>") ? s : `${s}</p>`));

  const imgs = images.filter(Boolean);
  const imagesToInsert = imgs.slice(0, Math.min(maxImagesToInsert, imgs.length));
  const interval =
    imagesToInsert.length > 0
      ? Math.max(1, Math.floor(paragraphs.length / (imagesToInsert.length + 1)))
      : paragraphs.length;

  const nodes: React.ReactNode[] = [];
  let imgIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    nodes.push(
      <div key={`p-${i}`} className="mb-6 last:mb-0">
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{
            __html: paragraphs[i]
              .replace(/<p>/g, '<p class="mb-4 leading-relaxed">')
              .replace(/<h1>/g, '<h1 class="text-3xl font-semibold mt-8 mb-4">')
              .replace(/<h2>/g, '<h2 class="text-2xl font-semibold mt-6 mb-3">')
              .replace(/<h3>/g, '<h3 class="text-xl font-semibold mt-5 mb-2">')
              .replace(/<ul>/g, '<ul class="list-disc pl-6 mb-4">')
              .replace(/<ol>/g, '<ol class="list-decimal pl-6 mb-4">')
              .replace(/<li>/g, '<li class="mb-2">')
              .replace(
                /<blockquote>/g,
                '<blockquote class="border-l-4 border-slate-200 pl-4 italic my-6">'
              ),
          }}
        />
      </div>
    );

    if (
      imagesToInsert.length &&
      imgIndex < imagesToInsert.length &&
      (i + 1) % interval === 0
    ) {
      nodes.push(
        <figure
          key={`img-${imgIndex}`}
          className="my-8 overflow-hidden rounded-xl border bg-slate-50 shadow-sm"
        >
          <img
            src={imagesToInsert[imgIndex]}
            alt="Article illustration"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </figure>
      );
      imgIndex++;
    }
  }

  while (imgIndex < imagesToInsert.length) {
    nodes.push(
      <figure
        key={`img-end-${imgIndex}`}
        className="my-8 overflow-hidden rounded-xl border bg-slate-50 shadow-sm"
      >
        <img
          src={imagesToInsert[imgIndex]}
          alt="Article illustration"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </figure>
    );
    imgIndex++;
  }

  return nodes;
}

async function getArticle(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, title, content, slug, meta_title, meta_description, og_title, og_description, keyword, created_at, generated_images"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("Error fetching article", error);
    return null;
  }

  return data;
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Check authentication
  const { data: user } = await getUser();
  if (!user?.id) {
    redirect('/login');
  }

  // Check if user needs onboarding
  const supabaseAdmin = supabase; // Using same client for now, should use admin client
  const { data: predata } = await supabaseAdmin
    .from('pre_data')
    .select('*')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const needsOnboarding = !predata || (() => {
    const hasWebsite = predata.website && predata.website.trim() !== '';
    const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0;
    const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0;
    return !hasWebsite || (!hasCompetitors && !hasKeywords);
  })();

  if (needsOnboarding) {
    redirect('/auth/onboarding-required');
  }

  // Check subscription status
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('subscribe')
    .eq('id', user.id)
    .single();

  if (!userData?.subscribe) {
    redirect('/paywall');
  }

  const article = await getArticle(slug);

  if (!article) {
    return notFound();
  }

  const publishedDate = article.created_at
    ? new Date(article.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 border-b pb-6">
        <p className="text-sm text-slate-500">{publishedDate}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          {article.title}
        </h1>
        {article.meta_description && (
          <p className="mt-3 text-base text-slate-600">
            {article.meta_description}
          </p>
        )}
        {article.keyword && (
          <p className="mt-2 text-sm font-medium text-slate-500">
            Focus keyword: {article.keyword}
          </p>
        )}
      </header>

      <section className="prose prose-lg prose-slate max-w-none">
        {renderContentWithImages(
          article.content,
          article.generated_images || [],
          3
        )}
      </section>
    </main>
  );
}
