"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Dialog1 } from "@/components/websitedialog"
import { WebsiteDialog } from "../dialog1";
import { CreatePostDialogDashboard } from "../dialog2";

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
  {/*------Competitor Dialog---- */}
  const [showAddCompetitorDialog, setShowAddCompetitorDialog] = useState(false);
  const [addCompetitorCompleted, setAddCompetitorCompleted] = useState(false);
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorTags, setCompetitorTags] = useState<string[]>([]);
  const toggleCompetitorTag = (tag: string) => {
    setCompetitorTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };
  const handleAddCompetitorSubmit = () => {
    // Simulate adding competitor
    setAddCompetitorCompleted(true);
    setTimeout(() => {
      setShowAddCompetitorDialog(false);
      setAddCompetitorCompleted(false);
      setCompetitorInput("");
      setCompetitorTags([]);
    }, 2000);
  };
  const handleAddCompetitor = () => {
    setShowAddCompetitorDialog(true);
    setAddCompetitorCompleted(false);
  };
  {/*------Competitor Dialog Ends--- */}
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [open, setOpen] = useState(false)
  const [ openWebsiteDialog, setOpenWebsiteDialog ] = useState(false)
  const [ openPostDialog, setOpenPostDialog ] = useState(false)
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

  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
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
        icon: "/actionimg1.png",
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
        icon: "/actionimg2.png",
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
      const articlesLive = articles?.filter(a => a.status === "published" || a.status === "UPLOADED").length || 0;
      const draftArticles = articles?.filter(a => a.status === "draft" || a.status === "DRAFT").length || 0;
      
      const estimatedTraffic = articles?.reduce((sum, article) => {
        return sum + (article.estimated_traffic || 0);
      }, 0) || 0;

      const allKeywords = new Set<string>();
      articles?.forEach(article => {
        if (typeof article.keyword === 'string') {
          article.keyword.split(',').forEach(k => allKeywords.add(k.trim()));
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
      websitesData?.forEach(website => {
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
          setSelectedWebsiteId(data[0].id);
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

const validateTab1 = () => {
  if (!websiteName.trim()) {
    toast.showToast({
      title: "Missing Website URL",
      description: "Please enter your website URL to continue.",
      type: "error",
    });
    return false;
  }
  return true;
};

const validateTab2 = () => {
  if (!competitor1.trim() || !competitor2.trim() || !competitor3.trim()) {
    toast.showToast({
      title: "Missing Competitors",
      description: "Please enter all 3 competitors to continue.",
      type: "error",
    });
    return false;
  }
  return true;
};

const validateTab3 = () => {
  if (!keyword1.trim() || !keyword2.trim() || !keyword3.trim()) {
    toast.showToast({
      title: "Missing Keywords",
      description: "Please enter all 3 keywords before submitting.",
      type: "error",
    });
    return false;
  }
  return true;
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
        description: "Article processing has been triggered. Check back in a moment for updates.",
        type: "success",
      });

      // Refresh articles after a short delay
      setTimeout(() => {
        fetchArticles();
        fetchAnalytics(supabase.auth.getUser().then(({ data: { user } }) => user?.id || ""), selectedWebsiteId);
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
      const { data: { user } } = await supabase.auth.getUser();
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
    fetchArticles();
  }, [selectedWebsiteId]);

  useEffect(() => {
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

  return (
    <div className="flex flex-col md:flex-row gap-5">
      <div className="space-y-6 md:w-3/5 w-full min-w-0">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-normal">Performance overview</h2>
              <p className="text-[#00000080] text-sm mt-2">Turn competitor keywords into SEO-ready long blog posts in one click.</p>
            </div>
            <div>
              <Select value={selectedWebsiteId || undefined} onValueChange={handleWebsiteChange}>
                <SelectTrigger className="h-10 bg-transparent rounded-[8px] focus-visible:outline-none focus-visible:ring-0 border-[#0000001a] focus-visible:border-[#0000001a] focus:outline-none cursor-pointer outline-none active:outline-none px-3.5 py-2.5 text-[#00000080]">
                  <SelectValue placeholder="Select your website" />
                </SelectTrigger>
                <SelectContent className="cursor-pointer">
                  {websites.map((website, index) => (
                    <SelectItem
                      key={website.id}
                      value={website.id}
                      className={`cursor-pointer data-[state=checked]:text-[#00000080] data-[state=checked]:opacity-40 ${index < websites.length - 1 ? 'border-b rounded-none border-[#0000001a]' : ''}`}
                    >
                      {website.url}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center">
            <Card className="border-border/40 bg-white rounded-none rounded-l-xl backdrop-blur-sm w-[222px] h-[174px]">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm font-normal text-[#00000080]">Articles Generated</CardTitle>
                <Image src="/dashboardcardimg1.png" alt="" width={20} height={20} />
              </CardHeader>
              <CardContent>
                <div className="text-[#000000b3] text-4xl font-bold mt-12">
                  {showSkeletons ? <Skeleton className="h-10 w-16" /> : analytics.articlesGenerated}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-white rounded-none backdrop-blur-sm w-[222px] h-[174px]">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm font-normal text-[#00000080]">Articles Live</CardTitle>
                <Image src="/dashboardcardimg2.png" alt="" width={20} height={20} />
              </CardHeader>
              <CardContent>
                <div className="text-[#000000b3] text-4xl font-bold mt-12">
                  {showSkeletons ? <Skeleton className="h-10 w-16" /> : analytics.articlesLive}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-white rounded-none backdrop-blur-sm w-[222px] h-[174px]">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm font-normal text-[#00000080]">Est. Traffic Potential</CardTitle>
                <Image src="/dashboardcardimg3.png" alt="" width={20} height={20} />
              </CardHeader>
              <CardContent>
                <div className="text-[#000000b3] text-4xl font-bold mt-12">
                  {showSkeletons ? <Skeleton className="h-10 w-24" /> : analytics.estimatedTraffic.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-white rounded-none rounded-r-xl backdrop-blur-sm w-[222px] h-[174px]">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm font-normal text-[#00000080]">Keyword Tracked</CardTitle>
                <Image src="/dashboardcardimg4.png" alt="" width={20} height={20} />
              </CardHeader>
              <CardContent>
                <div className="text-[#000000b3] text-4xl font-bold mt-12">
                  {showSkeletons ? <Skeleton className="h-10 w-16" /> : analytics.keywordsTracked}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-transparent p-5 mt-5">
              <CardTitle>Create a Ranking Post</CardTitle>
              <CardDescription>Turn competitor keywords into SEO ready blog posts in one click.</CardDescription>
              <CardContent className="px-0">
                <Button 
                onClick={() => setOpenPostDialog(true)}
                className="text-base font-normal text-white bg-black px-[60px] py-1 w-[170px] h-[50px] border border-[#00000080] rounded-[10px] hover:bg-transparent hover:text-[#00000080] cursor-pointer">Create Post</Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-5 max-w-[700px]">
          <Card className="bg-transparent px-4 py-5 w-[350px]">
            <CardTitle className="text-lg font-normal text-[#000000b3] ml-4">Your Websites</CardTitle>
            <CardContent>
              {websites.length > 0 && (
                <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a] w-[300px]">
                  <div className="flex items-center gap-5">
                  <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                    <Image src="/globe.png" alt="" width={20} height={20} />
                  </div>
                  <div>
                    <p className="text-sm text-[#000000b3] font-normal">{websites.length} website{websites.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-[#00000080] font-normal">{websites[0]?.url}{websites.length > 1 ? ` and ${websites.length - 1} other${websites.length > 2 ? 's' : ''}` : ''}</p>
                  </div>
                  </div>
                  <div className="w-[34px] h-[34px] bg-[#00000000] rounded-xl flex items-center justify-center cursor-pointer">
                    <Image src="/menudots.png" alt="" width={3} height={17} />
                  </div>
                </div>
              )}
              <div 
              onClick={() => setOpenWebsiteDialog(true)}
              className={`flex items-center justify-between border px-4 pb-4 pt-5 ${websites.length > 0 ? 'rounded-b-xl' : 'rounded-xl'} border-[#0000001a] w-[300px] cursor-pointer`}>
                <div className="flex items-center gap-5 cursor-pointer">
                <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px] cursor-pointer">
                  <Plus width={20} height={20} className="text-[#65b361] cursor-pointer " />
                </div>
                <div>
                  <p className="text-sm text-[#000000b3] font-normal">Add Website</p>
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-transparent px-4 py-5 w-[350px]">
            <CardTitle className="text-lg font-normal text-[#000000b3] ml-4">SEO Competitors</CardTitle>
            <CardContent>
              {analytics.totalCompetitors > 0 && (
                <div onClick={() => onViewCompetitors?.(selectedWebsiteId || "")} className="cursor-pointer flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a] w-[300px]">
                  <div className="flex items-center gap-5">
                  <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                    <Image src="/globe.png" alt="" width={20} height={20} />
                  </div>
                  <div>
                    <p className="text-sm text-[#000000b3] font-normal">{analytics.totalCompetitors} Competitor{analytics.totalCompetitors > 1 ? 's' : ''}</p>
                    <p className="text-xs text-[#00000080] font-normal">Tracked across your websites</p>
                  </div>
                  </div>
                  <div className="w-[34px] h-[34px] bg-[#00000000] rounded-xl flex items-center justify-center cursor-pointer">
                    <Image src="/menudots.png" alt="" width={3} height={17} />
                  </div>
                </div>
              )}
              <div 
              onClick={handleAddCompetitor}
              className={`cursor-pointer flex items-center justify-between border px-4 pb-4 pt-5 ${analytics.totalCompetitors > 0 ? 'rounded-b-xl' : 'rounded-xl'} border-[#0000001a] w-[300px]`}>
                <div className="flex items-center gap-5">
                <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                  <Plus width={20} height={20} className="text-[#65b361]" />
                </div>
                <div>
                  <p className="text-sm text-[#000000b3] font-normal">Add Competitor</p>
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          <Card className="bg-transparent px-4 py-5">
            <CardTitle className="text-lg font-normal text-[#000000b3] ml-4">Actions Required</CardTitle>
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
                      <Image src="/actionimg2.png" alt="" width={24} height={24} />
                    </div>
                    <div>
                      <p className="text-sm text-[#000000b3] font-normal">You’re all set</p>
                      <p className="text-xs text-[#00000080] font-normal">No outstanding tasks right now.</p>
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
                      className={`flex items-center justify-between border px-4 pb-4 pt-5 border-[#0000001a] ${isFirst ? 'rounded-t-xl' : ''} ${isLast ? 'rounded-b-xl' : 'border-b-0'}`}
                    >
                      <div className="flex items-center gap-5">
                        <div className="bg-[rgb(247,247,247)] w-[30px] h-[30px] flex items-center justify-center rounded-[10px]">
                          <Image src={action.icon} alt="" width={24} height={24} />
                        </div>
                        <div>
                          <p className="text-sm text-[#000000b3] font-normal">{action.title}</p>
                          <p className="text-xs text-[#00000080] font-normal">{action.description}</p>
                        </div>
                      </div>
                      {action.actionLabel && (
                        <Button onClick={action.onClick} className="border bg-transparent hover:bg-transparent text-[#00000080] border-[#0000001a] cursor-pointer">
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

      <Dialog1 open={open} onOpenChange={setOpen} />
      <WebsiteDialog open={openWebsiteDialog} onOpenChange={setOpenWebsiteDialog} />
      <CreatePostDialogDashboard open={openPostDialog} onOpenChange={setOpenPostDialog} />
      {/* Add Competitor Dialog */}
            {showAddCompetitorDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg w-full max-w-[550px] p-8 relative">
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
                          <h2 className="text-2xl font-semibold text-gray-900">
                            Add New Competitor
                          </h2>
                          <p className="text-sm text-gray-600 mt-1">
                            Type in the URL of your competitor
                          </p>
                        </div>
      
                        {/* Input Field */}
                        <div>
                          <Input
                            type="text"
                            placeholder="www.example.com"
                            value={competitorInput}
                            onChange={(e) => setCompetitorInput(e.target.value)}
                            className="h-10 border-gray-200 bg-gray-50"
                          />
                        </div>
      
                        {/* Tags */}
                       <div className="bg-gray-200 border border-gray-300 rounded-2xl w-full h-[81px]">
                        <div className="flex gap-2 p-3 flex-wrap">
                          {["www.designjoy.com", "www.lander.studio", "www.webflow.com"].map(
                            (tag) => (
                              <button
                                key={tag}
                                onClick={() => toggleCompetitorTag(tag)}
                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                                  competitorTags.includes(tag)
                                    ? "bg-gray-900 border text-white border-gray-900"
                                    : "bg-gray-100 text-gray-600 border-gray-600 hover:border-gray-300"
                                }`}
                              >
                                {tag}
                              </button>
                            )
                          )}
                        </div>
                        </div>
      
                        {/* Done Button */}
                        <button
                          onClick={handleAddCompetitorSubmit}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Completed State */}
                      <div className="text-center space-y-6">
                        <h2 className="text-2xl font-semibold text-gray-900">
                          Competitor Added!
                        </h2>
      
                        {/* Success Checkmark */}
                        <div className="flex justify-center py-8">
                          <Image
                            src="/check.png"
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
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Loading articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No articles found</p>
          </div>
        ) : (
          articles.map((article) => (
            <div
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className={`relative flex gap-3 p-3 bg-transparent border border-[#000000] rounded-lg cursor-pointer transition-all ${selectedArticle?.id === article.id ? 'border-gray-200 bg-transparent' : 'border-gray-200'}`}
            >
              <img src={article.generatedImages?.[0] || '/article-image.jpg'} alt={article.title} className="w-20 h-20 rounded object-cover flex-shrink-0" />

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{article.title}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <Image src="/clock.png" height={13} width={13} alt="icon" />
                      <p className="text-xs text-gray-500">{article.readingTime || '—'}</p>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="bg-transparent text-green-700 border border-green-600 px-2 py-0.5 rounded-2xl">{article.status}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 mt-2">{article.preview}</p>

                <div className="flex gap-1 flex-wrap mt-2">
                  {article.tags?.slice(0, 5).map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100  text-gray-600 px-2 py-0.5 rounded-2xl border border-[#0000001a]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
