import { notFound } from "next/navigation";
import { supabase } from "@/lib/client";

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
    <main className="mx-auto max-w-4xl px-4 py-10 prose prose-lg prose-slate">
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

      <article
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {article.generated_images && article.generated_images.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">Images</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {article.generated_images.map((url, idx) => (
              <figure
                key={`${article.id}-image-${idx}`}
                className="overflow-hidden rounded-lg border bg-slate-50"
              >
                <img
                  src={url}
                  alt={article.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
