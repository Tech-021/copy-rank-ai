"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Eye,
  Trash2,
  Edit2,
  BarChart3,
  Clock,
  Target,
  RefreshCw,
  ArrowUpRight,
  Image as ImageIcon,
  Globe,
  Download,
  Copy,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { getUserPackage } from "@/lib/articleLimits";
import { createCheckout } from "@/lib/lemonSqueezy";
import { useToast } from "@/components/ui/toast";
import Image from "next/image";

interface Article {
  id: string;
  title: string;
  content: string;
  keyword: string;
  status: "draft" | "scheduled" | "published";
  date: string;
  preview: string;
  wordCount: number;
  metaTitle?: string;
  metaDescription?: string;
  slug?: string;
  focusKeyword?: string;
  readingTime?: string;
  contentScore?: number;
  keywordDensity?: number;
  tags?: string[];
  category?: string;
  generatedAt?: string;
  estimatedTraffic?: number;
  generatedImages?: string[];
}

interface ArticlesTabProps {
  generatedArticles?: Article[];
  onArticlesUpdate?: (articles: Article[]) => void;
  websiteId?: string;
}

export function ArticlesTab({
  generatedArticles,
  onArticlesUpdate,
  websiteId,
}: ArticlesTabProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [newArticleKeyword, setNewArticleKeyword] = useState("");
  const [newArticleDate, setNewArticleDate] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPackage, setUserPackage] = useState<
    "free" | "pro" | "premium" | null
  >(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedPlanVariantId, setSelectedPlanVariantId] = useState<
    string | null
  >(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [indexingArticle, setIndexingArticle] = useState<string | null>(null);
  const toast = useToast();
  const [editForm, setEditForm] = useState({
    title: "",
    keyword: "",
    slug: "",
    metaTitle: "",
    metaDescription: "",
    preview: "",
    content: "",
  });

  // Helper to build article URL
  const getArticleUrl = (slug: string) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://v0-topic-detection-app-three.vercel.app";
    return `${baseUrl.replace(/\/$/, "")}/articles/${slug}`;
  };

  // Insert generated images between article paragraphs
  // Replace your existing renderContentWithImages function with this:
  function renderContentWithImages(
    content: string,
    images: string[],
    maxImagesToInsert = 3
  ) {
    if (!content) {
      return (
        <div className="text-gray-500 italic text-center py-8">
          No content available
        </div>
      );
    }

    const imgs = images || [];

    // Split content into paragraphs while preserving HTML structure
    const paragraphs = content
      .split(/<\/p>/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.endsWith("</p>") ? s : s + "</p>"));

    if (paragraphs.length === 0) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }

    const imagesToInsert = imgs.slice(
      0,
      Math.min(maxImagesToInsert, imgs.length)
    );
    const interval = Math.max(
      1,
      Math.floor(paragraphs.length / (imagesToInsert.length + 1))
    );

    const nodes: React.ReactNode[] = [];
    let imgIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      // Render paragraph with proper styling
      nodes.push(
        <div
          key={`p-${i}`}
          className="mb-6 last:mb-0"
          dangerouslySetInnerHTML={{
            __html: paragraphs[i]
              .replace(/<p>/g, '<p class="mb-4 leading-relaxed">')
              .replace(/<h1>/g, '<h1 class="text-2xl font-bold mb-4 mt-8">')
              .replace(/<h2>/g, '<h2 class="text-xl font-bold mb-3 mt-6">')
              .replace(/<h3>/g, '<h3 class="text-lg font-bold mb-2 mt-4">')
              .replace(/<ul>/g, '<ul class="list-disc pl-6 mb-4">')
              .replace(/<ol>/g, '<ol class="list-decimal pl-6 mb-4">')
              .replace(/<li>/g, '<li class="mb-2">')
              .replace(
                /<blockquote>/g,
                '<blockquote class="border-l-4 border-gray-300 pl-4 italic my-6">'
              ),
          }}
        />
      );

      // Insert image at intervals
      if (imgIndex < imagesToInsert.length && (i + 1) % interval === 0) {
        nodes.push(
          <div key={`img-${imgIndex}`} className="my-8">
            <div className="rounded-lg overflow-hidden border border-gray-200 shadow-md bg-white">
              <img
                src={imagesToInsert[imgIndex]}
                alt={`Generated image ${imgIndex + 1}`}
                className="w-full h-auto max-h-[400px] object-cover"
                loading="lazy"
                onError={(e) => {
                  // Hide the image if it fails to load
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                {/* <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <ImageIcon className="w-3 h-3" />
                <span>AI-generated image</span>
              </div> */}
              </div>
            </div>
          </div>
        );
        imgIndex++;
      }
    }

    // Append remaining images if any
    while (imgIndex < imagesToInsert.length) {
      nodes.push(
        <div key={`img-end-${imgIndex}`} className="my-8">
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-md bg-white">
            <img
              src={imagesToInsert[imgIndex]}
              alt={`Generated image ${imgIndex + 1}`}
              className="w-full h-auto max-h-[400px] object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              {/* <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ImageIcon className="w-3 h-3" />
              <span>AI-generated image</span>
            </div> */}
            </div>
          </div>
        </div>
      );
      imgIndex++;
    }

    return <div className="space-y-4">{nodes}</div>;
  }

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: user } = await getUser();
      setCurrentUser(user);

      if (user?.id) {
        const packageType = await getUserPackage(user.id);
        setUserPackage(packageType);
      }
    };
    getCurrentUser();
  }, []);

  // ...existing code...
  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);

      if (!currentUser) return;

      const url = websiteId
        ? `/api/articles?websiteId=${websiteId}&userId=${currentUser.id}`
        : `/api/articles?userId=${currentUser.id}`;

      console.log("📡 Fetching articles from:", url);

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch articles: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("📊 Articles API response:", {
        success: data.success,
        count: data.articles?.length || 0,
        firstArticle: data.articles?.[0]
          ? {
              id: data.articles[0].id,
              title: data.articles[0].title,
              generatedImages: data.articles[0].generatedImages,
              generatedImagesCount:
                data.articles[0].generatedImages?.length || 0,
            }
          : null,
      });

      if (data.success) {
        // normalize snake_case fields to camelCase so the UI can read them
        const normalizedArticles = (data.articles || []).map((a: any) => {
          const rawImages =
            a.generatedImages ??
            a.generated_images ??
            a.generated_images_urls ??
            a.generated_images_url ??
            a.images ??
            [];
          const parsedImages =
            typeof rawImages === "string"
              ? (() => {
                  try {
                    return JSON.parse(rawImages);
                  } catch {
                    return rawImages ? [rawImages] : [];
                  }
                })()
              : rawImages ?? [];
          return { ...a, generatedImages: parsedImages };
        });

        console.log(
          "🐞 Normalized first article images count:",
          normalizedArticles[0]?.generatedImages?.length ?? 0
        );
        setArticles(normalizedArticles);
        console.log(`✅ Loaded ${normalizedArticles.length} articles`);
      } else {
        throw new Error(data.error || "Failed to fetch articles");
      }
    } catch (error) {
      console.error("❌ Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, websiteId]);
  // ...existing code...

  useEffect(() => {
    if (currentUser) fetchArticles();
  }, [currentUser, websiteId]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => fetchArticles(), 30000);
    return () => clearInterval(interval);
  }, [currentUser, websiteId, fetchArticles]);

  useEffect(() => {
    if (generatedArticles && generatedArticles.length > 0) {
      setArticles((prev) => {
        const updated = [...generatedArticles, ...prev];
        if (onArticlesUpdate) onArticlesUpdate(updated);
        return updated;
      });
    }
  }, [generatedArticles, onArticlesUpdate]);

  const openEditDialog = (article: Article) => {
    setSelectedArticle(article);
    setEditForm({
      title: article.title || "",
      keyword: article.keyword || "",
      slug: article.slug || "",
      metaTitle: article.metaTitle || "",
      metaDescription: article.metaDescription || "",
      preview: article.preview || "",
      content: article.content || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleGenerateArticle = async () => {
    if (!newArticleKeyword.trim() || !currentUser) return;

    setIsGenerating(true);

    try {
      const requestBody = {
        keyword: newArticleKeyword.trim(),
        websiteId,
        userId: currentUser.id,
        generateImages: true,
        imageCount: 2,
      };

      console.log("🔄 Sending API request with:", requestBody);

      const response = await fetch("/api/test-generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      console.log("📨 API Response:", {
        success: result.success,
        articleId: result.article?.id,
        imagesGenerated:
          result.images?.generated ||
          result.article?.generatedImages?.length ||
          0,
        imageUrls: result.article?.generatedImages,
      });

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate article");
      }

      if (result.success && result.article) {
        console.log("✅ Article generated successfully!");
        console.log("📊 Word count:", result.article.wordCount);
        console.log("🖼️ Images generated:", result.images?.generated || 0);

        await fetchArticles();
        setNewArticleKeyword("");
        setNewArticleDate("");
        alert(
          `Article generated successfully! ${
            result.images?.generated
              ? `(${result.images.generated} images created)`
              : ""
          }`
        );
      }
    } catch (error) {
      console.error("❌ Error generating article:", error);
      alert(
        `Failed to generate article: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (
      !confirm("Are you sure you want to delete this article?") ||
      !currentUser
    )
      return;
    try {
      const response = await fetch(
        `/api/articles?id=${id}&userId=${currentUser.id}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setArticles((prev) => prev.filter((article) => article.id !== id));
        alert("Article deleted successfully!");
      } else throw new Error("Failed to delete article");
    } catch (error) {
      console.error("Error deleting article:", error);
      alert("Failed to delete article. Please try again.");
    }
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: "draft" | "scheduled" | "published"
  ) => {
    if (!currentUser) {
      alert("Please log in to update article status");
      return;
    }

    const articleForUpdate = articles.find((a) => a.id === id);
    setUpdatingStatus(id);

    try {
      const response = await fetch(`/api/articles?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          userId: currentUser.id,
          // ensure slug follows title when publishing
          title: articleForUpdate?.title,
          autoSlugFromTitle: true,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to update article status");

      if (data.success) {
        setArticles((prev) =>
          prev.map((article) =>
            article.id === id
              ? {
                  ...article,
                  status: newStatus,
                  ...(newStatus === "published" &&
                    article.status !== "published" && {
                      date: new Date().toISOString().split("T")[0],
                    }),
                }
              : article
          )
        );
      } else throw new Error(data.error || "Failed to update article status");
    } catch (error) {
      console.error("Error updating article status:", error);
      alert(
        `Failed to update article status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      await fetchArticles();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleSaveEditedArticle = async () => {
    if (!selectedArticle) {
      alert("No article selected to edit");
      return;
    }
    if (!currentUser) {
      alert("Please log in to edit articles");
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await fetch(`/api/articles?id=${selectedArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          title: editForm.title,
          keyword: editForm.keyword,
          slug: editForm.slug,
          autoSlugFromTitle: !editForm.slug,
          metaTitle: editForm.metaTitle,
          metaDescription: editForm.metaDescription,
          preview: editForm.preview,
          content: editForm.content,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update article");
      }

      await fetchArticles();
      setIsEditDialogOpen(false);
      setSelectedArticle(null);
    } catch (error) {
      console.error("Error updating article:", error);
      alert(
        `Failed to update article: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleIndexNow = async (articleId: string, slug: string) => {
    if (!slug) {
      toast.showToast({
        title: "Missing Slug",
        description: "Article has no slug. Please add a slug first.",
        type: "error",
      });
      return;
    }

    setIndexingArticle(articleId);

    try {
      const response = await fetch("/api/articles/index-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger indexing");
      }

      toast.showToast({
        title: "Success!",
        description:
          data.message || "Article submitted to search engines for indexing",
        type: "success",
      });
    } catch (error) {
      console.error("Error triggering IndexNow:", error);
      toast.showToast({
        title: "Indexing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIndexingArticle(null);
    }
  };

  const handleExportArticle = (article: Article) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.metaTitle || article.title}</title>
  <meta name="description" content="${
    article.metaDescription || article.preview
  }">
  ${
    article.slug
      ? `<link rel="canonical" href="https://yourdomain.com/${article.slug}">`
      : ""
  }
</head>
<body>
  <article>
    <h1>${article.title}</h1>
    ${article.content}
  </article>
</body>
</html>`;

    // Copy to clipboard
    navigator.clipboard
      .writeText(html)
      .then(() => {
        alert(
          "Article HTML copied to clipboard! You can now paste it into your CMS."
        );
      })
      .catch(() => {
        // Fallback: download as file
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${article.slug || "article"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("Article HTML downloaded!");
      });
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 border-green-200";
      case "scheduled":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case "published":
        return "Published";
      case "scheduled":
        return "Scheduled";
      case "draft":
        return "Draft";
      default:
        return status;
    }
  };

  const getContentScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === "published").length,
    scheduled: articles.filter((a) => a.status === "scheduled").length,
    draft: articles.filter((a) => a.status === "draft").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin">
            <Image src="/loader.png" alt="" width={92} height={92} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {userPackage === "free" && (
        <Card className="border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  Upgrade Your Plan to Generate More Articles
                </h3>
                <p className="text-sm text-blue-700">
                  You're currently on the free plan (3 articles).
                </p>
              </div>
              <div>
                <Button
                  onClick={() => setIsPlanDialogOpen(true)}
                  variant="secondary"
                >
                  Update Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Articles</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.total}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Published</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.published}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.scheduled}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={fetchArticles}
          className="cursor-pointer gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
        {/* Update Plan Button - only show if user is not premium */}
        {userPackage !== "premium" && (
          <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
            <DialogTrigger asChild></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Your Plan</DialogTitle>
                <DialogDescription>
                  Choose a plan to upgrade your account. After selecting, you'll
                  be redirected to LemonSqueezy to complete the purchase.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Plan</label>
                  <Select
                    onValueChange={(value) => setSelectedPlanVariantId(value)}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Variant IDs: prefer env via NEXT_PUBLIC_LEMON_VARIANT_PRO/PREMIUM, fallback to known 1087280/1087281 */}
                      <SelectItem
                        value={
                          process.env
                            ?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15 || ""
                        }
                      >
                        Pro — 15 articles
                      </SelectItem>
                      <SelectItem
                        value={
                          process.env
                            ?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || ""
                        }
                      >
                        Premium — 30 articles
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setIsPlanDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={isCreatingCheckout}
                    onClick={async () => {
                      if (!currentUser) {
                        alert("Please sign in to update your plan.");
                        return setIsPlanDialogOpen(false);
                      }
                      if (!selectedPlanVariantId) {
                        alert("Please select a plan.");
                        return;
                      }
                      try {
                        setIsCreatingCheckout(true);
                        if (selectedPlanVariantId) {
                          window.location.href = selectedPlanVariantId;
                          return; // fallback in case popup is blocked
                        }
                        const checkout = await createCheckout(
                          selectedPlanVariantId!,
                          currentUser.email,
                          currentUser.user_metadata?.full_name ||
                            currentUser.name,
                          currentUser.id
                        );
                        if (checkout?.url) {
                          // open the checkout in a new tab
                          window.open(checkout.url, "_blank");
                          setIsPlanDialogOpen(false);
                          // Try to refresh user's package after a short delay in case webhook has already fired
                          setTimeout(async () => {
                            try {
                              const packageType = await getUserPackage(
                                currentUser.id
                              );
                              setUserPackage(packageType);
                            } catch (e) {
                              // ignore
                            }
                          }, 5000);
                        } else {
                          alert(
                            "Failed to create checkout session. Please try again."
                          );
                        }
                      } catch (err: any) {
                        console.error("Create checkout failed", err);
                        const message =
                          err?.message ||
                          err?.error ||
                          "Failed to create checkout session. You can try the public checkout URL instead.";
                        // Try static public fallback URLs if available
                        const proVar =
                          process.env.NEXT_PUBLIC_LEMON_VARIANT_PRO ||
                          "1087280";
                        const premVar =
                          process.env.NEXT_PUBLIC_LEMON_VARIANT_PREMIUM ||
                          "1087281";
                        const fallbackUrl15 =
                          process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15;
                        const fallbackUrl30 =
                          process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30;
                        let fallbackUrl: string | null = null;
                        const selected = String(selectedPlanVariantId);
                        if (selected === String(proVar) && fallbackUrl15)
                          fallbackUrl = fallbackUrl15;
                        if (selected === String(premVar) && fallbackUrl30)
                          fallbackUrl = fallbackUrl30;
                        // If selected variant matches silver monthly, we can use the 15 article URL as default
                        const silverVar =
                          process.env
                            .NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY || "";
                        if (
                          !fallbackUrl &&
                          selected === String(silverVar) &&
                          fallbackUrl15
                        )
                          fallbackUrl = fallbackUrl15;

                        if (fallbackUrl) {
                          if (
                            confirm(
                              `${message}\n\nWould you like to open the public checkout URL?`
                            )
                          ) {
                            window.open(fallbackUrl, "_blank");
                            setIsPlanDialogOpen(false);
                          }
                        } else {
                          alert(message);
                        }
                      } finally {
                        setIsCreatingCheckout(false);
                      }
                    }}
                  >
                    Proceed
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Generated Articles</CardTitle>
          <CardDescription>
            SEO-optimized articles with AI-generated images
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {articles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No articles found.</p>
                <p className="text-sm mt-2">
                  Generate your first article using the button above.
                </p>
              </div>
            ) : (
              articles.map((article) => (
                <div
                  key={article.id}
                  className="p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-background/50"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between mb-3">
                    <div className="flex-1 mb-3 md:mb-0">
                      <h3 className="font-semibold text-foreground mb-1 text-lg">
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {article.preview}
                      </p>

                      <div className="flex flex-col sm:flex-row flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Keyword:</span>
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                            {article.keyword}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Words:</span>
                          <span>{article.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Date:</span>
                          <span>{article.date}</span>
                        </div>
                        {article.readingTime && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>{article.readingTime}</span>
                          </div>
                        )}
                        {article.contentScore && (
                          <div
                            className={`flex items-center gap-2 ${getContentScoreColor(
                              article.contentScore
                            )}`}
                          >
                            <BarChart3 className="w-3 h-3" />
                            <span>Score: {article.contentScore}%</span>
                          </div>
                        )}
                      </div>

                      {/* Live URL for published articles */}
                      {article.status === "published" && article.slug && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                          <Globe className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="font-medium text-green-700">
                            Live URL:
                          </span>
                          <a
                            href={getArticleUrl(article.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline truncate flex-1"
                          >
                            {getArticleUrl(article.slug)}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                getArticleUrl(article.slug!)
                              );
                              toast.showToast({
                                title: "Copied!",
                                description: "URL copied to clipboard",
                                type: "success",
                              });
                            }}
                            className="text-green-600 hover:text-green-800 flex-shrink-0"
                            title="Copy URL"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="hidden">{/* spacing placeholder */}</div>
                      <br />
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {article.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{article.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge
                      className={`${getStatusStyles(
                        article.status
                      )} border self-start`}
                    >
                      {getStatusDisplayText(article.status)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" /> Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0">
                        <div className="p-6">
                          <DialogHeader className="mb-6">
                            <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
                              {article.title}
                            </DialogTitle>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Keyword:</span>
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700"
                                >
                                  {article.keyword}
                                </Badge>
                              </div>
                              {article.readingTime && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>{article.readingTime}</span>
                                </div>
                              )}
                              {article.wordCount && (
                                <div className="flex items-center gap-2">
                                  <span>
                                    {article.wordCount.toLocaleString()} words
                                  </span>
                                </div>
                              )}
                              {article.contentScore && (
                                <div
                                  className={`flex items-center gap-2 ${getContentScoreColor(
                                    article.contentScore
                                  )}`}
                                >
                                  <BarChart3 className="w-4 h-4" />
                                  <span className="font-medium">
                                    Content Score: {article.contentScore}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </DialogHeader>

                          <div className="space-y-6">
                            {/* Live URL Section - Only for published articles */}
                            {article.status === "published" && article.slug && (
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-start gap-3">
                                  <Globe className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-green-900 mb-2">
                                      Live Article URL
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={getArticleUrl(article.slug)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm break-all flex-1"
                                      >
                                        {getArticleUrl(article.slug)}
                                      </a>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            getArticleUrl(article.slug!)
                                          );
                                          toast.showToast({
                                            title: "Copied!",
                                            description:
                                              "URL copied to clipboard",
                                            type: "success",
                                          });
                                        }}
                                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded flex-shrink-0"
                                        title="Copy URL"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <p className="text-xs text-green-700 mt-2">
                                      This article is live and indexed by search
                                      engines
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* SEO Preview Section */}
                            {(article.metaTitle || article.metaDescription) && (
                              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <h4 className="font-semibold text-gray-900 mb-3 text-lg">
                                  SEO Preview
                                </h4>
                                <div className="space-y-2">
                                  {article.metaTitle && (
                                    <p className="text-blue-600 font-medium text-lg leading-tight hover:underline cursor-pointer">
                                      {article.metaTitle}
                                    </p>
                                  )}
                                  {article.metaDescription && (
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                      {article.metaDescription}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Article Content Section */}
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="p-6">
                                <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
                                  {/* FIXED: Use renderContentWithImages function instead of dangerouslySetInnerHTML */}
                                  {renderContentWithImages(
                                    article.content,
                                    article.generatedImages || []
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-6 border-t border-gray-200">
                              <Button
                                variant="outline"
                                className="cursor-pointer border-gray-300 hover:bg-gray-50"
                                onClick={() => openEditDialog(article)}
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit Article
                              </Button>
                              <Button
                                className="cursor-pointer bg-primary hover:bg-primary/90 text-white flex-1"
                                onClick={() =>
                                  handleUpdateStatus(article.id, "published")
                                }
                                disabled={article.status === "published"}
                              >
                                {article.status === "published"
                                  ? "Already Published"
                                  : "Publish Now"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Select
                      value={article.status}
                      onValueChange={(value) =>
                        handleUpdateStatus(
                          article.id,
                          value as "draft" | "scheduled" | "published"
                        )
                      }
                      disabled={updatingStatus === article.id}
                    >
                      <SelectTrigger className="w-32 h-9 text-sm">
                        <SelectValue>
                          {updatingStatus === article.id ? (
                            <div className="animate-spin">
                              <Image
                                src="/loader.png"
                                alt=""
                                width={92}
                                height={92}
                              />
                            </div>
                          ) : (
                            getStatusDisplayText(article.status)
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>

                    {article.status === "published" && article.slug && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          handleIndexNow(article.id, article.slug!)
                        }
                        disabled={indexingArticle === article.id}
                      >
                        {indexingArticle === article.id ? (
                          <div className="animate-spin">
                            <Image
                              src="/loader.png"
                              alt=""
                              width={92}
                              height={92}
                            />
                          </div>
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                        Index Now
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => handleDeleteArticle(article.id)}
                      disabled={updatingStatus === article.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedArticle(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Article</DialogTitle>
            <DialogDescription>
              Update the article content and SEO fields, then save your changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Title</p>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Article title"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Keyword</p>
                <Input
                  value={editForm.keyword}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      keyword: e.target.value,
                    }))
                  }
                  placeholder="Focus keyword"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Slug</p>
                <Input
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="my-article-slug"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  value={editForm.preview}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      preview: e.target.value,
                    }))
                  }
                  placeholder="Short preview shown in listings"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Meta Title</p>
              <Input
                value={editForm.metaTitle}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    metaTitle: e.target.value,
                  }))
                }
                placeholder="SEO meta title"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Meta Description
              </p>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
                value={editForm.metaDescription}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    metaDescription: e.target.value,
                  }))
                }
                placeholder="SEO meta description"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Content (HTML)
              </p>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={10}
                value={editForm.content}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="Article content in HTML"
              />
              <p className="text-xs text-muted-foreground">
                Rich text is stored as HTML. Make sure headings, lists, and
                paragraphs are valid markup.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedArticle(null);
                }}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEditedArticle} disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin">
                      <Image src="/loader.png" alt="" width={92} height={92} />
                    </div>{" "}
                    Saving...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
