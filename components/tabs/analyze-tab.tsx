"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoaderChevron } from "@/components/ui/LoaderChevron";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import { supabase } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "../ui/skeleton";
import Image from "next/image";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Badge, ChevronLeft, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { CreatePostDialogDashboard } from "../dialog2";
import { WebsiteDialog } from "../dialog1";

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

interface AnalyzeTabProps {
  onViewKeywords: (websiteId: string) => void;
  onViewCompetitors: (websiteId: string) => void;
  generatedArticles?: Article[];
  onArticlesUpdate?: (articles: Article[]) => void;
  websiteId?: string;
}

interface Website {
  id: string;
  url: string;
  topic: string;
  keywords: any;
  auto_publish?: boolean;
  autoPublish?: boolean;
  is_active?: boolean;
  isAnalyzing?: boolean;
  user_id?: string;
  created_at?: string;
}

interface AnalyticsData {
  articlesGenerated: number;
  articlesLive: number;
  estimatedTraffic: number;
  keywordsTracked: number;
  draftArticles: number;
  totalCompetitors: number;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  actionLabel?: string;
  onClick?: () => void;
}

const getKeywordsCount = (keywordsData: any): number => {
  if (!keywordsData) return 0;
  if (keywordsData.keywords && Array.isArray(keywordsData.keywords)) {
    return keywordsData.keywords.length;
  }
  if (Array.isArray(keywordsData)) {
    return keywordsData.length;
  }
  return 0;
};

const getCompetitorsCount = (keywordsData: any): number => {
  if (!keywordsData) return 0;
  if (keywordsData.competitors && Array.isArray(keywordsData.competitors)) {
    return keywordsData.competitors.length;
  }
  return 0;
};

const selectedWebsiteStorageKey = "selected-website-id";

const readSelectedWebsiteId = () => {
  try {
    return sessionStorage.getItem(selectedWebsiteStorageKey);
  } catch {
    return null;
  }
};

const writeSelectedWebsiteId = (websiteId: string) => {
  try {
    sessionStorage.setItem(selectedWebsiteStorageKey, websiteId);
  } catch {
    // ignore storage failures
  }
};

export function AnalyzeTab({
  onViewKeywords,
  onViewCompetitors,
  generatedArticles,
  onArticlesUpdate,
  websiteId,
}: AnalyzeTabProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState("all");
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  {
    /*------Competitor Dialog---- */
  }
  const [showAddCompetitorDialog, setShowAddCompetitorDialog] = useState(false);
  const [addCompetitorCompleted, setAddCompetitorCompleted] = useState(false);
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorTags, setCompetitorTags] = useState<string[]>([]);
  const toggleCompetitorTag = (tag: string) => {
    setCompetitorTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };
  const handleAddCompetitorSubmit = async () => {
    try {
      const toAdd: string[] = [];
      if (competitorInput.trim()) {
        toAdd.push(
          ...competitorInput
            .split(/[,\n]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        );
      }
      if (competitorTags.length > 0) {
        toAdd.push(...competitorTags.map((t) => t.trim()).filter(Boolean));
      }

      if (toAdd.length === 0) {
        // Nothing to add - show brief completed state
        setAddCompetitorCompleted(true);
        setTimeout(() => {
          setShowAddCompetitorDialog(false);
          setAddCompetitorCompleted(false);
          setCompetitorInput("");
          setCompetitorTags([]);
        }, 1200);
        return;
      }

      const siteId =
        selectedWebsiteId ||
        (websites && websites.length > 0 ? websites[0].id : undefined);
      if (!siteId) {
        toast.showToast({
          title: "No website selected",
          description: "Please add or select a website first.",
          type: "error",
        });
        await loadUserWebsites();
        return;
      }

      setIsSubmitting(true);
      const success = await persistCompetitorsToWebsite(siteId, toAdd);
      setIsSubmitting(false);

      if (success) {
        setAddCompetitorCompleted(true);
        await loadUserWebsites();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await fetchAnalytics(user.id, selectedWebsiteId);

        // refresh briefly then close
        setTimeout(() => {
          setShowAddCompetitorDialog(false);
          setAddCompetitorCompleted(false);
          setCompetitorInput("");
          setCompetitorTags([]);
        }, 1200);
      } else {
        toast.showToast({
          title: "Failed to add",
          description: "Unable to save competitors. Try again.",
          type: "error",
        });
        setShowAddCompetitorDialog(false);
      }
    } catch (err) {
      console.error("Error adding competitor from analyze tab:", err);
      toast.showToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
      setShowAddCompetitorDialog(false);
      setIsSubmitting(false);
    }
  };

  // Persist competitor domains into the website.keywords.competitors array
  const persistCompetitorsToWebsite = async (
    siteId: string,
    domains: string[]
  ) => {
    try {
      const { data: siteData, error: siteErr } = await supabase
        .from("websites")
        .select("id, keywords")
        .eq("id", siteId)
        .single();

      if (siteErr) {
        console.error("Failed to fetch website:", siteErr);
        return false;
      }

      const existingPayload = (siteData as any)?.keywords || {};
      const existingList: any[] = Array.isArray(existingPayload?.competitors)
        ? existingPayload.competitors
        : [];

      const map = new Map<string, any>();
      existingList.forEach((c) => {
        const key = String(c.domain || "").toLowerCase();
        if (key) map.set(key, c);
      });

      domains.forEach((d) => {
        const domain = d.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
        const key = domain.toLowerCase();
        if (!key) return;
        const existing = map.get(key) || {};
        map.set(key, {
          ...existing,
          domain,
          topic: existing.topic || null,
          keywords: existing.keywords || [],
          keywords_count:
            existing.keywords_count ||
            (existing.keywords ? existing.keywords.length : 0),
          success: existing.success !== false,
        });
      });

      const merged = Array.from(map.values());
      const newPayload = {
        ...existingPayload,
        competitors: merged,
        analysis_metadata: {
          ...existingPayload.analysis_metadata,
          totalCompetitors: merged.length,
          analyzed_at: new Date().toISOString(),
        },
      };

      const { error: updateErr } = await supabase
        .from("websites")
        .update({ keywords: newPayload })
        .eq("id", siteId);

      if (updateErr) {
        console.error("Failed to update website competitors:", updateErr);
        return false;
      }

      toast.showToast({
        title: "Competitors added",
        description: `${domains.length} competitor(s) saved.`,
        type: "success",
      });
      return true;
    } catch (e) {
      console.error("Error persisting competitors:", e);
      return false;
    }
  };
  const handleAddCompetitor = () => {
    setShowAddCompetitorDialog(true);
    setAddCompetitorCompleted(false);
  };
  {
    /*------Competitor Dialog Ends--- */
  }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTab, setEditTab] = useState("basic");
  const [open, setOpen] = useState(false);
  const [openPostDialog, setOpenPostDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    keyword: "",
    slug: "",
    metaTitle: "",
    metaDescription: "",
    preview: "",
    content: "",
  });

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    articlesGenerated: 0,
    articlesLive: 0,
    estimatedTraffic: 0,
    keywordsTracked: 0,
    draftArticles: 0,
    totalCompetitors: 0,
  });

  const filteredArticles = articles.filter((article) => {
    if (filterStatus === "all") return true;
    // Normalize status to lowercase for comparison
    const status = (article.status || "").toLowerCase();
    return status === filterStatus;
  });

  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    null
  );
  // Articles state (replace old mock list with dynamic data)
  // const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  // const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const actionsRequired = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    const draftCount = analytics.draftArticles;
    const hasWebsites = websites.length > 0;
    const unpublishedArticles =
      analytics.articlesGenerated > analytics.articlesLive;
    const autoPublishDisabled = websites.some(
      (site) => site.auto_publish === false || site.autoPublish === false
    );
    const publishingPaused =
      autoPublishDisabled || websites.some((site) => site.is_active === false);

    if (draftCount > 0) {
      items.push({
        id: "drafts",
        title: `${draftCount} post${draftCount > 1 ? "s" : ""} draft${
          draftCount > 1 ? "s" : ""
        } waiting for review`,
        description: "Finish them to start ranking.",
        icon: "/lastdark1.png",
        actionLabel: "Review drafts",
      });
    }

    if (publishingPaused || unpublishedArticles) {
      items.push({
        id: "publishing",
        title:
          analytics.articlesLive === 0
            ? "Publishing is paused"
            : "Some posts are not live",
        description:
          analytics.articlesLive === 0
            ? "Turn on auto-publish to ship faster."
            : "Publish the remaining posts to capture traffic.",
        icon: "/lastdark2.png",
        actionLabel: "View posts",
      });
    }

    if (!hasWebsites) {
      items.push({
        id: "add-website",
        title: "Add your first website",
        description: "Connect a site to start tracking and publishing.",
        icon: "/globe.png",
        actionLabel: "Add website",
        onClick: () => setOpen(true),
      });
    }

    return items;
  }, [analytics, websites, selectedWebsiteId, onViewCompetitors]);

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

  const loadUserWebsites = async () => {
    try {
      setShowSkeletons(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // If onboarding was started before signup/login, consume it now
      try {
        const pending = localStorage.getItem('pendingOnboarding');
        if (pending) {
          console.log('Found pending onboarding, processing...');
          const payload = JSON.parse(pending);
          // Ensure userId is set
          payload.userId = payload.userId || user.id;

          try {
            const resp = await fetch('/api/onboarding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const d = await resp.json().catch(() => ({}));
            if (resp.ok && d.success) {
              localStorage.removeItem('pendingOnboarding');
              console.log('Pending onboarding processed successfully');
            } else {
              console.error('Pending onboarding failed', d);
            }
          } catch (err) {
            console.error('Error sending pending onboarding:', err);
          }
        }
      } catch (err) {
        // ignore localStorage parsing errors
      }

      const { data, error } = await supabase
        .from("websites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading websites:", error);
        return;
      }

      if (data) {
        setWebsites(data);
        if (data.length > 0 && !selectedWebsiteId) {
          const stored = readSelectedWebsiteId();
          const nextId =
            stored && data.some((w) => w.id === stored) ? stored : data[0].id;
          setSelectedWebsiteId(nextId);
          writeSelectedWebsiteId(nextId);
        }
      }
      await fetchAnalytics(user.id, selectedWebsiteId);
    } catch (error) {
      console.error("Error loading websites:", error);
    } finally {
      setTimeout(() => setShowSkeletons(false), 700);
    }
  };

  const deleteWebsiteFromDB = async (id: string) => {
    const { error } = await supabase.from("websites").delete().eq("id", id);
    if (error) throw error;
  };

  const handleRemoveWebsite = async (id: string) => {
    try {
      await deleteWebsiteFromDB(id);
      setWebsites(websites.filter((site) => site.id !== id));

      toast.showToast({
        title: "Website Removed",
        description: "Website has been removed from your list",
        type: "success",
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await fetchAnalytics(user.id, selectedWebsiteId);
      }
    } catch (error) {
      toast.showToast({
        title: "Delete Failed",
        description: "Failed to remove website. Please try again.",
        type: "error",
      });
    }
  };

  const handleSubmitOnboarding = async () => {
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.showToast({
          title: "Authentication Required",
          description: "Please log in to continue",
          type: "error",
        });
        setIsSubmitting(false);
        return;
      }

      const onboardingData = {
        clientDomain: websiteName.trim(),
        competitors: [
          competitor1.trim(),
          competitor2.trim(),
          competitor3.trim(),
        ],
        targetKeywords: [keyword1.trim(), keyword2.trim(), keyword3.trim()],
        userId: user.id,
      };

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingData),
      });

      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "Onboarding failed");

      setIsDialogOpen(false);

      setWebsiteName("");
      setCompetitor1("");
      setCompetitor2("");
      setCompetitor3("");
      setKeyword1("");
      setKeyword2("");
      setKeyword3("");

      await loadUserWebsites();

      toast.showToast({
        title: "Website Added Successfully!",
        description: `Found ${data.totalKeywords} keywords. 3 articles are being generated in the background.`,
        type: "success",
      });
    } catch (error) {
      toast.showToast({
        title: "Failed to Add Website",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed =
    websiteName.trim() &&
    competitor1.trim() &&
    competitor2.trim() &&
    competitor3.trim() &&
    keyword1.trim() &&
    keyword2.trim() &&
    keyword3.trim();

  const getReadingTime = (wordCount?: number) => {
    if (!wordCount) return "—";
    const minutes = Math.max(1, Math.round(wordCount / 200));
    return `${minutes} min read`;
  };

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

  const handleWebsiteChange = async (websiteId: string) => {
    setSelectedWebsiteId(websiteId);
    writeSelectedWebsiteId(websiteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await fetchAnalytics(user.id, websiteId);
    }
  };

  const handleTriggerArticleProcessing = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/article-jobs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger article processing");
      }

      toast.showToast({
        title: "Processing Started",
        description:
          "Article processing has been triggered. Check back in a moment for updates.",
        type: "success",
      });

      // Refresh articles after a short delay
      setTimeout(async () => {
        fetchArticles();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await fetchAnalytics(user.id, selectedWebsiteId);
        }
      }, 2000);
    } catch (error) {
      toast.showToast({
        title: "Failed to Trigger Processing",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserWebsites();
  }, []);

  // Fetch articles for current user / website
  const fetchArticles = async () => {
    try {
      setLoadingArticles(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const siteId = selectedWebsiteId || undefined;
      const url = siteId
        ? `/api/articles?websiteId=${siteId}&userId=${user.id}`
        : `/api/articles?userId=${user.id}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch articles");
      const data = await res.json();

      if (data.success) {
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

        setArticles(normalizedArticles);
      }
    } catch (err) {
      console.error("Error fetching articles:", err);
    } finally {
      setLoadingArticles(false);
    }
  };

  useEffect(() => {
    // Skip fetching while viewing an article page to avoid background
    // polling triggering visible reloads when navigating to /articles/[slug].
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/articles")) return;
    fetchArticles();
  }, [selectedWebsiteId]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/articles")) return;

    const interval = setInterval(() => fetchArticles(), 30000);
    return () => clearInterval(interval);
  }, [selectedWebsiteId]);

  useEffect(() => {
    const refreshAnalytics = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await fetchAnalytics(user.id, selectedWebsiteId);
      }
    };

    if (selectedWebsiteId !== null) {
      refreshAnalytics();
    }
  }, [selectedWebsiteId]);

  const handlePostCreated = async () => {
    try {
      await fetchArticles();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await fetchAnalytics(user.id, selectedWebsiteId);
    } catch (err) {
      console.error("Error refreshing after post creation:", err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-2">
      <div className="space-y-6 md:w-3/5 w-full min-w-0">
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-4 lg:gap-0 lg:flex-row lg:items-center justify-between">
            <div>
              <h2 className="text-3xl font-normal">Performance overview</h2>
              <p className="text-gray-500 text-sm mt-2">
                Turn competitor keywords into SEO-ready long blog posts in one
                click.
              </p>
            </div>
            <div>
              <Select
                value={selectedWebsiteId || undefined}
                onValueChange={handleWebsiteChange}
              >
                <SelectTrigger className="h-10  bg-[rgba(83,248,112,0.1)]!  rounded-[5px] focus-visible:outline-none focus-visible:ring-0 border-[#0000001a] focus-visible:border-[#0000001a] focus:outline-none cursor-pointer outline-none active:outline-none px-3.5 py-2.5 text-[#53F870]">
                  <SelectValue placeholder="Select your website" />
                </SelectTrigger>
                <SelectContent className="cursor-pointer bg-[#142517]! ">
                  {websites.map((website, index) => (
                    <SelectItem
                      key={website.id}
                      value={website.id}
                      className={`cursor-pointer data-[state=checked]:text-[#53F870] data-[state=checked]:opacity-40 ${
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
          <div className="lg:border-r lg:pr-3 flex flex-col gap-5">
            <div className="flex items-center flex-wrap lg:flex-nowrap">
              <Card className="border-[#53f8701a] bg-[#101110] lg:rounded-none lg:rounded-l-xl backdrop-blur-sm w-[180px] lg:w-[222px] h-[184px] rounded-none rounded-tl-xl">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm font-normal text-gray-500">
                    Articles Generated
                  </CardTitle>
                  <Image src="/dark1.png" alt="" width={20} height={20} />
                </CardHeader>
                <CardContent>
                  <div className="text-[#53F870] text-4xl font-bold mt-12">
                    {showSkeletons ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      analytics.articlesGenerated
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#53f8701a]  bg-[#101110] lg:rounded-none rounded-none rounded-tr-xl backdrop-blur-sm w-[180px] lg:w-[222px] h-[184px]">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm font-normal text-gray-500">
                    Articles <br className="hidden lg:block" />
                    Live
                  </CardTitle>
                  <Image src="/dark2.png" alt="" width={20} height={20} />
                </CardHeader>
                <CardContent>
                  <div className="text-[#53F870] text-4xl font-bold mt-12">
                    {showSkeletons ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      analytics.articlesLive
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#53f8701a] bg-[#101110] lg:rounded-none rounded-none rounded-bl-xl backdrop-blur-sm w-[180px] lg:w-[222px] h-[184px]">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm font-normal text-gray-500">
                    Est. Traffic Potential
                  </CardTitle>
                  <Image src="/dark3.png" alt="" width={20} height={20} />
                </CardHeader>
                <CardContent>
                  <div className="text-[#53F870] text-4xl font-bold mt-12">
                    {showSkeletons ? (
                      <Skeleton className="h-10 w-24" />
                    ) : (
                      analytics.estimatedTraffic.toLocaleString()
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#53f8701a] bg-[#101110] lg:rounded-none lg:rounded-r-xl backdrop-blur-sm w-[180px] lg:w-[222px] h-[184px] rounded-none rounded-br-xl">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-sm font-normal text-gray-500">
                    Keyword Tracked
                  </CardTitle>
                  <Image src="/dark4.png" alt="" width={20} height={20} />
                </CardHeader>
                <CardContent>
                  <div className="text-[#53F870] text-4xl font-bold mt-12">
                    {showSkeletons ? (
                      <Skeleton className="h-10 w-16" />
                    ) : (
                      analytics.keywordsTracked
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="bg-transparent p-5 mt-5">
                <CardTitle>Create a Ranking Post</CardTitle>
                <CardDescription>
                  Turn competitor keywords into SEO ready blog posts in one
                  click.
                </CardDescription>
                <CardContent className="px-0">
                  <Button
                    onClick={() => setOpenPostDialog(true)}
                    className="text-base font-normal text-[#53F870] bg-transparent px-[60px] py-1 w-[170px] h-[50px] border border-[#53F870] rounded-[10px] hover:bg-transparent hover:text-white cursor-pointer"
                  >
                    Create Post
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-2.5 max-w-[700px]">
              <Card className="bg-transparent px-4 py-5 w-[362px] lg:w-[350px]">
                <CardTitle className="text-lg font-normal text-white ml-4">
                  Your Websites
                </CardTitle>
                <CardContent>
                  {websites.length > 0 && (
                    <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-gray-800 w-[300px]">
                      <div className="flex items-center gap-5">
                        <div className="bg-[rgba(50,85,45,0.13)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                          <Image
                            src="/dark10.png"
                            alt=""
                            width={34}
                            height={34}
                          />
                        </div>
                        <div>
                          <p className="text-sm text-white font-normal">
                            {websites.length} website
                            {websites.length > 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-gray-500 font-normal">
                            {websites[0]?.url}
                            {websites.length > 1
                              ? ` and ${websites.length - 1} other${
                                  websites.length > 2 ? "s" : ""
                                }`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="w-[34px] h-[34px] bg-[#00000000] rounded-xl flex items-center justify-center cursor-pointer">
                        <Image
                          src="/menudots.png"
                          alt=""
                          width={3}
                          height={17}
                        />
                      </div>
                    </div>
                  )}
                  <div
                    onClick={() => setOpen(true)}
                    className={`flex items-center justify-between border px-4 pb-4 pt-5 ${
                      websites.length > 0 ? "rounded-b-xl" : "rounded-xl"
                    } border-gray-800 w-[300px] cursor-pointer`}
                  >
                    <div className="flex items-center gap-5 cursor-pointer">
                      <div className="bg-[rgba(50,85,45,0.13)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px] cursor-pointer">
                        <Image
                          src="/dark13.png"
                          alt=""
                          width={34}
                          height={34}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-white font-normal">
                          Add Website
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-transparent px-4 py-5 w-[362px] lg:w-[350px]">
                <CardTitle className="text-lg font-normal text-white ml-4">
                  SEO Competitors
                </CardTitle>
                <CardContent>
                  <div className="cursor-pointer flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-gray-800 w-[300px]">
                    <div className="flex items-center gap-5">
                      <div className="bg-[rgba(50,85,45,0.13)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                        <Image
                          src="/dark11.png"
                          alt=""
                          width={34}
                          height={34}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-white font-normal">
                          {analytics.totalCompetitors} Competitor
                          {analytics.totalCompetitors > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-gray-500 font-normal">
                          Tracked across your websites
                        </p>
                      </div>
                    </div>
                    <div className="w-[34px] h-[34px] bg-transparent rounded-xl flex items-center justify-center cursor-pointer">
                      <Image
                        src="/3dotsblack.png"
                        alt=""
                        width={31}
                        height={17}
                      />
                    </div>
                  </div>
                  <div
                    onClick={handleAddCompetitor}
                    className={`cursor-pointer flex items-center justify-between border px-4 pb-4 pt-5 ${
                      analytics.totalCompetitors > 0
                        ? "rounded-none rounded-b-xl"
                        : "rounded-none rounded-b-xl"
                    } border-gray-800 w-[300px]`}
                  >
                    <div className="flex items-center gap-5">
                      <div className="bg-[rgba(50,85,45,0.13)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                        <Image
                          src="/dark13.png"
                          alt=""
                          width={34}
                          height={34}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-white font-normal">
                          Add Competitor
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-transparent px-4 py-5">
              <h4>Action Required</h4>
              <CardTitle className="text-lg font-normal text-white ml-4"></CardTitle>
              <CardContent>
                {showSkeletons ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : actionsRequired.length === 0 ? (
                  <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-xl border-[#0000001a]">
                    <div className="flex items-center gap-5">
                      <div className="bg-[rgb(247,247,247)] w-[30px] h-[30px] flex items-center justify-center rounded-[10px]">
                        <Image
                          src="/dark15.png"
                          alt=""
                          width={24}
                          height={24}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-white font-normal">
                          You’re all set
                        </p>
                        <p className="text-xs text-[#00000080] font-normal">
                          No outstanding tasks right now.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  actionsRequired.map((action, index) => {
                    const isFirst = index === 0;
                    const isLast = index === actionsRequired.length - 1;
                    return (
                      <div
                        key={action.id}
                        className={`flex items-center justify-between border px-4 pb-4 pt-5 border-gray-800 ${
                          isFirst ? "rounded-t-xl" : ""
                        } ${isLast ? "rounded-b-xl" : "border-b-0"}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className="bg-transparent w-[30px] h-[30px] flex items-center justify-center rounded-[10px]">
                            <Image
                              src={action.icon}
                              alt=""
                              width={24}
                              height={24}
                            />
                          </div>
                          <div>
                            <p className="text-sm text-white font-normal">
                              {action.title}
                            </p>
                            <p className="text-xs text-gray-500 font-normal">
                              {action.description}
                            </p>
                          </div>
                        </div>
                        {action.actionLabel && (
                          <Button
                            onClick={action.onClick}
                            className="border bg-[rgba(121,195,111,0.13)] hover:bg-transparent text-[#53F870] border-[#0000001a] cursor-pointer"
                          >
                            {action.actionLabel}
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <CreatePostDialogDashboard
        open={openPostDialog}
        onOpenChange={setOpenPostDialog}
        websiteId={selectedWebsiteId}
        onCreated={handlePostCreated}
      />
      <WebsiteDialog open={open} onOpenChange={setOpen} onSuccess={loadUserWebsites} />
      {/* Add Competitor Dialog */}
      {showAddCompetitorDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black rounded-lg w-full max-w-[550px] p-8 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowAddCompetitorDialog(false);
                setAddCompetitorCompleted(false);
                setCompetitorInput("");
                setCompetitorTags([]);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5 rotate-180" />
            </button>

            {!addCompetitorCompleted ? (
              <>
                {/* Add New Competitor State */}
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">
                      Add New Competitor
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Type in the URL of your competitor
                    </p>
                  </div>
                  {/* Input Field */}
                  <div className="relative w-full">
                    <Input
                      type="text"
                      placeholder="www.example.com"
                      value={competitorInput}
                      onChange={(e) => setCompetitorInput(e.target.value)}
                      className="
      h-14
      pr-32
      border border-[#2E9839]
      bg-linear-to-b
      from-[rgba(46,152,57,0.38)]
      to-[rgba(4,35,13,1)]
      text-white
      placeholder:text-white/70
      focus-visible:ring-0
      focus-visible:border-[#2E9839]
    "
                    />

                    <button
                      className="
      absolute
      right-2
      top-1/2
      -translate-y-1/2
      h-10
      px-4
      rounded-[9px]
      bg-[#5AFF78]
      text-white
      text-sm
      font-medium
      hover:bg-[#257F31]
      transition
    "
                    >
                      <Check className="text-black" />
                    </button>
                  </div>

                  <div className="bg-transparent border border-[#085110] rounded-2xl w-full h-[81px]">
                    <div className="flex gap-2 p-3  flex-wrap">
                      {[
                        "www.designjoy.com",
                        "www.lander.studio",
                        "www.webflow.com",
                      ].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleCompetitorTag(tag)}
                          className={`
    px-3 py-0.5 text-[11px] rounded-md border transition-colors mr-2 mb-2 h-7 flex items-center
    ${
      competitorTags.includes(tag)
        ? "border-[#4aa85a] bg-[rgba(74,168,90,0.12)] text-white"
        : "bg-[rgba(46,152,57,0.06)] text-[#8fd59a] border-[#274e2a] hover:bg-[rgba(46,152,57,0.08)]"
    }
  `}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Done Button */}
                  <div className="mt-6">
                    <button
                      onClick={handleAddCompetitorSubmit}
                      className="w-full bg-[#2E8B37] hover:bg-[#257F31] text-white font-medium py-3 rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Completed State */}
                <div className="text-center space-y-6">
                  <h2 className="text-2xl font-semibold text-white">
                    Competitor Added!
                  </h2>

                  {/* Success Checkmark */}
                  <div className="flex justify-center py-8">
                    <Image
                      src="/checkfordark.png"
                      height={81}
                      width={81}
                      alt="Success"
                    />
                  </div>

                  {/* View Competitors Button */}
                  <button
                    onClick={() => {
                      setShowAddCompetitorDialog(false);
                      setAddCompetitorCompleted(false);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    View Competitors
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 md:w-2/5 w-full border px-2 py-2 rounded-xl overflow-y-auto min-w-0">
        {loadingArticles ? (
          <div className="text-center flex items-center justify-center py-12">
            <LoaderChevron />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No articles found</p>
          </div>
        ) : (
          articles.map((article) => (
            <div
              key={article.id}
              className={`relative flex gap-3 p-3 bg-transparent border border-[#53f8701a] rounded-lg transition-all ${
                selectedArticle?.id === article.id
                  ? "border-[#53f8701a] bg-transparent"
                  : "border-[#53f8701a]"
              }`}
            >
              <img
                src={article.generatedImages?.[0] || "/article-image.jpg"}
                alt={article.title}
                className="w-20 h-20 rounded object-cover shrink-0"
              />

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex gap-2">
                    <h4 className="font-medium text-white text-sm line-clamp-2">
                      {article.title}
                    </h4>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(article);
                      }}
                      className="text-[#53f870] hover:text-[#53f870] bg-[#53f8701a] hover:bg-[#53f8701a]! cursor-pointer h-8 w-full sm:w-8 px-[18px] sm:px-2 py-1.5 border-[#53f8701a] shrink-0"
                    >
                      Edit
                    </Button>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Image
                        src="/clock.png"
                        height={13}
                        width={13}
                        alt="icon"
                      />
                      <p className="text-xs text-gray-500">
                        {article.readingTime || "—"}
                      </p>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="bg-transparent text-green-700 border border-green-600 px-2 py-0.5 rounded-2xl">
                        {article.status}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 mt-2">
                  {article.preview}
                </p>

                <div className="flex gap-1 flex-wrap mt-2">
                  {article.tags?.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-[rgba(103,159,95,0.13)]  text-[#53F870] px-2 py-0.5 rounded-2xl border border-[#0000001a]"
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

      {/* Edit Dialog with Tabs */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedArticle(null);
            setEditTab("basic");
          }
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Article</DialogTitle>
          </DialogHeader>

          {/* Tabs Navigation */}
          <div className="flex gap-1 border-b border-gray-700 px-0">
            <button
              onClick={() => setEditTab("basic")}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-[2px] ${
                editTab === "basic"
                  ? "border-b-[#53F870] text-[#53F870]"
                  : "border-b-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              Basic Info
            </button>
            <button
              onClick={() => setEditTab("seo")}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-[2px] ${
                editTab === "seo"
                  ? "border-b-[#53F870] text-[#53F870]"
                  : "border-b-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              SEO
            </button>
            <button
              onClick={() => setEditTab("content")}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-[2px] ${
                editTab === "content"
                  ? "border-b-[#53F870] text-[#53F870]"
                  : "border-b-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              Content
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 p-6">
              {/* Basic Info Tab */}
              {editTab === "basic" && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Title</label>
                    <Input
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Article title"
                      className="h-11 text-base border border-gray-700 bg-gray-950"
                    />
                    <p className="text-xs text-gray-500">The main headline of your article</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Focus Keyword</label>
                    <Input
                      value={editForm.keyword}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          keyword: e.target.value,
                        }))
                      }
                      placeholder="e.g., best SEO tools"
                      className="h-11 text-base border border-gray-700 bg-gray-950"
                    />
                    <p className="text-xs text-gray-500">The primary keyword to optimize for</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Slug</label>
                    <Input
                      value={editForm.slug}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, slug: e.target.value }))
                      }
                      placeholder="my-article-slug"
                      className="h-11 text-base border border-gray-700 bg-gray-950"
                    />
                    <p className="text-xs text-gray-500">URL-friendly version of your title</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Preview</label>
                    <textarea
                      className="w-full rounded-md border border-gray-700 bg-gray-950 px-4 py-3 text-base leading-relaxed text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#53F870] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      rows={5}
                      value={editForm.preview}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          preview: e.target.value,
                        }))
                      }
                      placeholder="Short preview shown in article listings..."
                    />
                    <p className="text-xs text-gray-500">Brief summary shown in search results and listings</p>
                  </div>
                </div>
              )}

              {/* SEO Tab */}
              {editTab === "seo" && (
                <div className="space-y-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-400">Optimize your article for search engines with these SEO fields</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Meta Title</label>
                    <Input
                      value={editForm.metaTitle}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          metaTitle: e.target.value,
                        }))
                      }
                      placeholder="Title tag for search results (50-60 chars)"
                      className="h-11 text-base border border-gray-700 bg-gray-950"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">Displayed in search engine results</p>
                      <p className={`text-xs ${editForm.metaTitle.length > 60 ? "text-red-500" : "text-gray-500"}`}>
                        {editForm.metaTitle.length}/60
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Meta Description</label>
                    <textarea
                      className="w-full rounded-md border border-gray-700 bg-gray-950 px-4 py-3 text-base leading-relaxed text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#53F870] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      rows={4}
                      value={editForm.metaDescription}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          metaDescription: e.target.value,
                        }))
                      }
                      placeholder="Meta description for search results (155-160 chars)"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">Shown below title in search results</p>
                      <p className={`text-xs ${editForm.metaDescription.length > 160 ? "text-red-500" : "text-gray-500"}`}>
                        {editForm.metaDescription.length}/160
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Tab */}
              {editTab === "content" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-base font-semibold text-white">Content (HTML)</label>
                    <textarea
                      className="w-full rounded-md border border-gray-700 bg-gray-950 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#53F870] focus-visible:ring-offset-2 focus-visible:ring-offset-black font-mono"
                      rows={14}
                      value={editForm.content}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, content: e.target.value }))
                      }
                      placeholder="&lt;h1&gt;Article title&lt;/h1&gt;&#10;&lt;p&gt;Your content here...&lt;/p&gt;"
                    />
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-300">HTML Content Tips:</p>
                      <ul className="text-xs text-gray-500 space-y-1 ml-3 list-disc">
                        <li>Use proper HTML tags: &lt;h1&gt;, &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;</li>
                        <li>Ensure all tags are properly closed</li>
                        <li>Avoid inline styles when possible</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with Actions */}
          <div className="border-t border-gray-700 bg-black px-6 py-4 flex justify-end gap-3">
            <Button
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedArticle(null);
                setEditTab("basic");
              }}
              className="px-6 h-11 border border-gray-700 bg-transparent text-white hover:bg-gray-900 transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedArticle) return;
                setIsSubmitting(true);
                try {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();

                  if (!user) {
                    throw new Error("User not authenticated");
                  }

                  const response = await fetch(`/api/articles?id=${selectedArticle.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: user.id,
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
                  if (response.ok) {
                    setIsEditDialogOpen(false);
                    setSelectedArticle(null);
                    setEditTab("basic");
                    await fetchArticles();
                    toast.showToast({
                      title: "Success",
                      description: "Article updated successfully",
                      type: "success",
                    });
                  } else {
                    throw new Error(data.error || "Failed to update article");
                  }
                } catch (error) {
                  toast.showToast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Unknown error",
                    type: "error",
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="px-8 h-11 bg-[#53F870] hover:bg-[#53F870] text-black font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
