"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Stepper } from "@/components/ui/stepper";
import { CreatePostDialogDashboard } from "@/components/dialog2";
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
import { supabase } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import Image from "next/image";
import { CreatePostDialogDashboard } from "@/components/dialog2";

interface Article {
  id: string;
  title: string;
  content: string;
  keyword: string[];
  status: "draft" | "scheduled" | "published" | "UPLOADED" | "DRAFT";
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

interface AnalyticsData {
  articlesGenerated: number;
  articlesLive: number;
  estimatedTraffic: number;
  keywordsTracked: number;
  draftArticles: number;
  totalCompetitors: number;
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("2-feb-2025");
  const [filterEndDate, setFilterEndDate] = useState("4-mar-2025");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteCompletedDialogOpen, setIsDeleteCompletedDialogOpen] =
    useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
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

  interface Website {
    id: string;
    url: string;
    topic?: string;
    created_at?: string;
  }

  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadingWebsites, setLoadingWebsites] = useState(false);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    websiteId || null
  );
  const [openPostDialog, setOpenPostDialog] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    articlesGenerated: 0,
    articlesLive: 0,
    estimatedTraffic: 0,
    keywordsTracked: 0,
    draftArticles: 0,
    totalCompetitors: 0,
  });

  const loadUserWebsites = async () => {
    try {
      setLoadingWebsites(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("websites")
        .select("id, url, topic, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading websites:", error);
        return;
      }

      if (data && data.length > 0) {
        setWebsites(data as Website[]);
        if (!selectedWebsiteId) setSelectedWebsiteId((data as any)[0].id);
      }
    } catch (err) {
      console.error("Error loading websites:", err);
    } finally {
      setLoadingWebsites(false);
    }
  };

  useEffect(() => {
    if (!websiteId) {
      loadUserWebsites();
    } else {
      setSelectedWebsiteId(websiteId);
    }
  }, [websiteId]);

  // Derived data and helpers
  const filteredArticles = articles.filter((article) => {
    if (filterStatus === "all") return true;
    // Normalize status to lowercase for comparison
    const status = (article.status || "").toLowerCase();
    return status === filterStatus;
  });

  const getReadingTime = (wordCount?: number) => {
    if (!wordCount) return "—";
    const minutes = Math.max(1, Math.round(wordCount / 200));
    return `${minutes} min read`;
  };
  const handlePublish = async () => {
    if (!selectedArticle) return;

    setIsPublishing(true);
    try {
      await handleUpdateStatus(selectedArticle.id, "published");
      setPublishSuccess(true);

      toast.showToast({
        title: "Published!",
        description: "Your article has been published successfully.",
        type: "success",
      });

      setTimeout(() => {
        setPublishSuccess(false);
        // Fetch updated article data from backend to get the correct slug
        fetch(`/api/articles?userId=${currentUser?.id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.articles) {
              const updatedArticle = data.articles.find(
                (a: Article) => a.id === selectedArticle.id
              );
              if (updatedArticle) {
                setSelectedArticle(updatedArticle);
                setArticles(data.articles);
              }
            }
          })
          .catch((err) =>
            console.error("Error fetching updated article:", err)
          );
      }, 1200);
    } catch (error) {
      toast.showToast({
        title: "Error",
        description: "Failed to publish article",
        type: "error",
      });
    } finally {
      setIsPublishing(false);
    }
  };

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

      const siteId = selectedWebsiteId || websiteId || null;
      const url = siteId
        ? `/api/articles?websiteId=${siteId}&userId=${currentUser.id}`
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
  }, [currentUser, selectedWebsiteId]);
  // ...existing code...

  useEffect(() => {
    if (currentUser) fetchArticles();
  }, [currentUser, selectedWebsiteId]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => fetchArticles(), 30000);
    return () => clearInterval(interval);
  }, [currentUser, selectedWebsiteId, fetchArticles]);

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
      keyword: Array.isArray(article.keyword)
        ? article.keyword.join(", ")
        : article.keyword || "",
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

  const getCompetitorsCount = (keywordsData: any): number => {
    if (!keywordsData) return 0;
    if (keywordsData.competitors && Array.isArray(keywordsData.competitors)) {
      return keywordsData.competitors.length;
    }
    return 0;
  };

  const fetchAnalytics = async (userId: string, websiteId?: string | null) => {
    try {
      let articlesQuery = supabase
        .from("articles")
        .select("status, estimated_traffic, keyword, word_count")
        .eq("user_id", userId);

      if (websiteId) {
        articlesQuery = articlesQuery.eq("website_id", websiteId);
      }

      const { data: articles, error: articlesError } = await articlesQuery;

      if (articlesError) throw articlesError;

      const articlesGenerated = articles?.length || 0;
      const articlesLive =
        articles?.filter(
          (a) => a.status === "published" || a.status === "UPLOADED"
        ).length || 0;
      const draftArticles =
        articles?.filter((a) => a.status === "draft" || a.status === "DRAFT")
          .length || 0;

      const estimatedTraffic =
        articles?.reduce((sum, article) => {
          return sum + (article.estimated_traffic || 0);
        }, 0) || 0;

      const allKeywords = new Set<string>();
      articles?.forEach((article) => {
        if (typeof article.keyword === "string") {
          article.keyword.split(",").forEach((k) => allKeywords.add(k.trim()));
        }
      });
      const keywordsTracked = allKeywords.size;

      let websitesQuery = supabase
        .from("websites")
        .select("keywords")
        .eq("user_id", userId);

      if (websiteId) {
        websitesQuery = websitesQuery.eq("id", websiteId);
      }

      const { data: websitesData, error: websitesError } = await websitesQuery;

      if (websitesError) throw websitesError;

      let totalCompetitors = 0;
      websitesData?.forEach((website) => {
        const competitorCount = getCompetitorsCount(website.keywords);
        totalCompetitors += competitorCount;
      });

      setAnalytics({
        articlesGenerated,
        articlesLive,
        estimatedTraffic,
        keywordsTracked,
        draftArticles,
        totalCompetitors,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const handleWebsiteChange = async (websiteId: string) => {
    setSelectedWebsiteId(websiteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await fetchAnalytics(user.id, websiteId);
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
    <div className="space-y-6 ">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-3xl text-white font-medium">Blogs</p>
            <p className="text-[#ffffffb3] mt-3 text-sm">
              Create, review, and publish your AI-generated posts.
            </p>
          </div>
          <div>
            <Select
              value={selectedWebsiteId || undefined}
              onValueChange={handleWebsiteChange}
            >
              <SelectTrigger className="h-10 bg-transparent rounded-[8px] focus-visible:outline-none focus-visible:ring-0 border-[#0000001a] focus-visible:border-[#0000001a] focus:outline-none cursor-pointer outline-none active:outline-none px-3.5 py-2.5 text-[#00000080]">
                <SelectValue placeholder="Select your website" />
              </SelectTrigger>
              <SelectContent className="cursor-pointer">
                {websites.map((website, index) => (
                  <SelectItem
                    key={website.id}
                    value={website.id}
                    className={`cursor-pointer data-[state=checked]:text-[#00000080] data-[state=checked]:opacity-40 ${
                      index < websites.length - 1
                        ? "border-b rounded-none border-[#0000001a]"
                        : ""
                    }`}
                  >
                    {website.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Create a Ranking Post Section */}
        <Card className="border-[#53f8701a] shadow-none bg-transparent">
          <CardContent className="">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">
                Create a Ranking Post
              </h3>
              <p className="text-sm text-[#ffffffb3] mb-4">
                Turn competitor keywords into SEO-ready blog posts in one click.
              </p>
              <Button
                onClick={() => setOpenPostDialog(true)}
                className="bg-black cursor-pointer py-5 px-8 text-[#53f870] border border-[#53f870] hover:bg-black"
              >
                Create Post
              </Button>
            </div>
          </CardContent>
        </Card>
        <CreatePostDialogDashboard
          open={openPostDialog}
          onOpenChange={setOpenPostDialog}
          websiteId={selectedWebsiteId ?? undefined}
          onCreated={() => fetchArticles()}
        />

        {/* Stats Grid */}
        <div className="flex mt-5 mb-2.5 gap-2 text-sm">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="border-none !bg-transparent  ring-0 text-[#ffffff80] focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-gray-300"></span>

          <Select defaultValue="27-jan-2025">
            <SelectTrigger className="border-none !bg-transparent  ring-0 text-[#ffffff80] focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="27-Jan, 2025" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="27-jan-2025">2Feb, 2025</SelectItem>
              <SelectItem value="26-jan-2025">2Feb, 2025</SelectItem>
              <SelectItem value="25-jan-2025">2Feb, 2025</SelectItem>
              <SelectItem value="24-jan-2025">2Feb, 2025</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-gray-300"></span>

          <Select defaultValue="4-mar-2025">
            <SelectTrigger className="border-none !bg-transparent  ring-0 text-[#ffffff80] focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="4 Mar, 2025" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4-mar-2025">4 Mar, 2025</SelectItem>
              <SelectItem value="3-mar-2025">3 Mar, 2025</SelectItem>
              <SelectItem value="2-mar-2025">2 Mar, 2025</SelectItem>
              <SelectItem value="1-mar-2025">1 Mar, 2025</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Layout - Articles + Preview */}
        <div className="flex gap-6 h-auto overflow-hidden">
          {/* Left Side - Articles List */}
          <div className="space-y-3 pr-2">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No articles found</p>
              </div>
            ) : (
              filteredArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => {
                    setSelectedArticle(article);
                    setIsContentExpanded(false);
                  }}
                  className={`relative flex gap-3 px-3 py-5  bg-[#101110] border border-[#53f8701a] rounded-lg cursor-pointer  hover:shadow-sm transition-all ${
                    selectedArticle?.id === article.id
                      ? "border-[#53f8701a] bg-[#101110]"
                      : "border-[#53f8701a]"
                  }`}
                >
                  {/* Thumbnail */}
                  <img
                    src={article.generatedImages?.[0] || "/article-image.jpg"}
                    alt={article.title}
                    className="w-20 h-20 rounded object-cover flex-shrink-0"
                  />

                  {/* Main Content Column */}
                  <div className="flex flex-col min-w-0 flex-1">
                    {/* Title + Meta */}
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-white text-sm line-clamp-2">
                          {article.title}
                        </h4>

                        <div className="flex items-center gap-1 mt-1">
                          <Image
                            src="/clock1.png"
                            height={13}
                            width={13}
                            alt="icon"
                          />
                          <p className="text-xs text-[#]">
                            {getReadingTime(article.wordCount)}
                          </p>
                        </div>

                        <Badge
                          className={`mt-2 text-xs font-medium w-fit ${
                            (article.status || "").toLowerCase() === "uploaded"
                              ? "bg-transparent text-green-700 border border-green-600"
                              : "bg-gray-100 text-gray-600 border border-gray-800"
                          }`}
                        >
                          {article.status}
                        </Badge>
                      </div>

                      {/* Edit Button */}
                      {selectedArticle?.id !== article.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-gray-700 h-8 w-8 p-0 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(article);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>

                    {/* Preview (FULL WIDTH, NOT under image) */}
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2">
                      {article.preview}
                    </p>

                    {/* Tags */}
                    <div className="flex gap-1 flex-wrap mt-2">
                      {article.tags?.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-gray-200  text-gray-600 px-2 py-0.5 rounded-2xl border border-gray-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Side - Edit/Preview Panel */}
          {selectedArticle && (
            <div className=" max-w-[640px] bg-[#0d0d0d] rounded-[9px] border-l border-[#53f8701a] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                <span className="text-sm  text-gray-500">EDIT POST</span>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none font-bold"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1  overflow-y-auto">
                <div className=" space-y-4 p-4">
                  {/* Title */}
                  <div className="flex items-center gap-3">
                    <label className="block text-[10px] mt-1 text-[#ffffff80] ">
                      Title:
                    </label>
                    <h4 className="text-lg text-white font-normal">{selectedArticle.title || ""}</h4>
                  </div>

                  {/* Keywords */}
                  <div className="flex gap-1">
                    <label className="block text-[10px] mt-1 text-[#ffffff80]">
                      Keywords:
                    </label>

                    <div className="flex text-[8px] font-normal flex-wrap gap-2">
                      {(() => {
                        const keywords = Array.isArray(selectedArticle.keyword)
                          ? selectedArticle.keyword
                          : selectedArticle.keyword
                          ? String(selectedArticle.keyword)
                              .split(",")
                              .map((k) => k.trim())
                              .filter(Boolean)
                          : [];
                        return keywords.length > 0 ? (
                          keywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="px-1 py-1  rounded-full text-xs font-medium bg-[#53f8701a] text-[#53f870] border border-[#53f8701a] inline-block"
                            >
                              {keyword}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">
                            No keywords
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Word Count */}
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1">
                      <Image
                        src="/clock2.png"
                        alt="reading time icon"
                        height={16}
                        width={16}
                        priority
                      />
                      <p className="text-[#53f870] text-[10px]">
                        {getReadingTime(selectedArticle.wordCount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Image
                        src="/Union.png"
                        alt="word count icon"
                        height={16}
                        width={16}
                        priority
                      />
                      <p className="text-[#53f870] text-[10px]">
                        {selectedArticle.wordCount?.toLocaleString() || "—"}{" "}
                        words
                      </p>
                    </div>
                    {selectedArticle.contentScore && (
                      <div className="flex items-center gap-1">
                        <Image
                          src="/Union (1).png"
                          alt="content score icon"
                          height={16}
                          width={16}
                          priority
                        />
                        <p className="text-[#53f870] text-[10px]">
                          {selectedArticle.contentScore}% content score
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Preview Text */}
                  <div>
                    {/* <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Preview
                    </label> */}
                    {/* <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded border border-gray-200">
                      {selectedArticle.preview}
                    </p> */}
                  </div>

                  {/* SEO Preview */}
                  <div>
                    <div className="bg-[#101110] border border-[#53f8701a] p-9 rounded-lg shadow-xl">
                      <label className="block text-[15px]  text-white mb-2">
                        SEO Preview
                      </label>
                      <p className="text-blue-600 font-medium text-sm mb-2 line-clamp-2">
                        {selectedArticle.metaTitle || selectedArticle.title}
                      </p>
                      <p className="text-white text-xs leading-relaxed line-clamp-3">
                        {selectedArticle.metaDescription ||
                          selectedArticle.preview}
                      </p>
                    </div>
                  </div>

                  {/* Live URL for published articles */}
                  {selectedArticle.status === "published" &&
                    selectedArticle.slug && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Globe className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-green-900 mb-1">
                              Live Article URL
                            </h4>
                            <div className="flex items-center gap-2">
                              <a
                                href={getArticleUrl(selectedArticle.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all flex-1"
                              >
                                {getArticleUrl(selectedArticle.slug)}
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    getArticleUrl(selectedArticle.slug!)
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
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Tags */}
                </div>
                <div className="border-b border-gray-200 " />
                <div className="p-4">
                  <h4 className="text-2xl mb-4">{selectedArticle.title}</h4>
                  <div
                    className={`text-[14px] text-gray-700 leading-relaxed relative ${
                      isContentExpanded ? "" : "max-h-[400px] overflow-hidden"
                    }`}
                  >
                    {renderContentWithImages(
                      selectedArticle.content,
                      selectedArticle.generatedImages || [],
                      3
                    )}
                    {!isContentExpanded && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
                    )}
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      className="bg-gray-400 hover:bg-gray-400 cursor-pointer"
                      onClick={() => setIsContentExpanded((prev) => !prev)}
                    >
                      {isContentExpanded ? "Show less" : "Read more"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-200 p-4 bg-white flex gap-2 flex-shrink-0">
                <Button
                  className="flex-1 bg-black text-white font-medium hover:bg-gray-900 h-10 text-sm rounded disabled:opacity-60"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    publishSuccess ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )
                  ) : (
                    "Publish"
                  )}
                </Button>
                {selectedArticle.status === "published" &&
                  selectedArticle.slug && (
                    <Button
                      variant="outline"
                      className="h-10 px-4 flex items-center gap-2"
                      onClick={() =>
                        handleIndexNow(
                          selectedArticle.id,
                          selectedArticle.slug!
                        )
                      }
                      disabled={indexingArticle === selectedArticle.id}
                    >
                      {indexingArticle === selectedArticle.id ? (
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
                  className="h-9 w-14 p-0 rounded-sm text-red-500 bg-red-500 hover:bg-red-300 hover:text-red-700 cursor-pointer"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Image src="/bin.png" height={11} width={11} alt="icon" />
                </Button>

                <Dialog
                  open={isDeleteDialogOpen}
                  onOpenChange={setIsDeleteDialogOpen}
                >
                  <DialogContent className="sm:max-w-[550px] text-center p-0 border-0">
                    <VisuallyHidden>
                      <DialogTitle>Confirm delete</DialogTitle>
                    </VisuallyHidden>

                    <div className="flex flex-col items-center gap-4 py-8 px-6">
                      <h2 className="text-2xl  text-gray-900">
                        Confirm delete
                      </h2>
                      <div className=" flex items-center justify-center">
                        <Image
                          src="/deletedocument.png"
                          height={60}
                          width={60}
                          alt="delete"
                          className="text-red-500 mt-6 "
                        />
                      </div>
                      <div></div>
                    </div>

                    <div className="flex gap-3 px-6 pb-6">
                      <Button
                        className="flex-1 h-11  bg-red-500 hover:bg-red-600 text-white font-medium"
                        onClick={async () => {
                          if (selectedArticle) {
                            setIsDeleteDialogOpen(false);
                            await handleDeleteArticle(selectedArticle.id);
                            setSelectedArticle(null);
                            setTimeout(() => {
                              setIsDeleteCompletedDialogOpen(true);
                            }, 300);
                          }
                        }}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-11 text-gray-700 bg-gray-200 border-gray-200 hover:bg-gray-50"
                        onClick={() => setIsDeleteDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isDeleteCompletedDialogOpen}
                  onOpenChange={setIsDeleteCompletedDialogOpen}
                >
                  <DialogContent className="sm:max-w-[550px] text-center p-0 border-0">
                    <VisuallyHidden>
                      <DialogTitle>Delete completed</DialogTitle>
                    </VisuallyHidden>

                    <div className="flex flex-col items-center  gap-4 py-8 px-6">
                      <h2 className="text-2xl  text-gray-900">Completed!</h2>
                      <div className=" flex items-center justify-center">
                        <Image
                          src="/check.png"
                          alt="icon"
                          height={81}
                          width={81}
                          className="mt-9"
                        />
                      </div>
                    </div>

                    <div className="px-6 pb-6">
                      <Button
                        className="w-full h-11 bg-green-600 hover:bg-green-600 text-white font-medium rounded-lg"
                        onClick={() => {
                          setIsDeleteCompletedDialogOpen(false);
                          toast.showToast({
                            title: "Article deleted",
                            description:
                              "The article has been permanently deleted.",
                            type: "success",
                          });
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* {userPackage === "free" && (
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
      )} */}

      <div className="flex gap-4">
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
