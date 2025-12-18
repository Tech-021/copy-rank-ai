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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "../ui/skeleton";
import Image from "next/image";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronLeft, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/selectvisible";
import { useRouter } from "next/navigation";
import { Dialog1 } from "@/components/websitedialog"

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
}: AnalyzeTabProps) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const toast = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
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
  const [editForm, setEditForm] = useState({
    title: "",
    keyword: "",
    slug: "",
    metaTitle: "",
    metaDescription: "",
    preview: "",
    content: "",
  });

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

  const mockArticles: Article[] = [
    {
      id: "1",
      title: "Why Framer is Changing How We Think About Web Development",
      preview:
        "Explore how Framer is reshaping web development, with real examples, web design insights, and practical web development tips for modern creators.",
      keyword: [
        "web design",
        "framer",
        "web development",
        "technology tutorial",
        "web development guide",
      ],
      status: "DRAFT",
      date: "2025-01-27",
      wordCount: 2500,
      content: "<p>Framer is revolutionizing web development...</p>",
      metaTitle: "Framer Web Development Guide",
      metaDescription: "Learn how Framer is changing web development",
      tags: ["web design", "framer", "web development", "technology tutorial"],
      generatedImages: ["/aimg1.png"],
    },
    {
      id: "2",
      title: "Why Framer Changed How I Think About Web Design",
      preview:
        "Explore how Framer is reshaping web development, with real examples, web design insights, and practical web development tips for modern creators.",
      keyword: [
        "web design",
        "framer",
        "web development",
        "technology tutorial",
        "web development guide",
      ],
      status: "DRAFT",
      date: "2025-02-02",
      wordCount: 1800,
      content: "<p>Web design has evolved...</p>",
      metaTitle: "Web Design with Framer",
      metaDescription: "Discover new web design techniques",
      tags: ["web design", "framer", "web development", "technology tutorial"],
      generatedImages: ["/aimg2.png"],
    },
    {
      id: "3",
      title: "How I Learned Web Design - Why Framer Changed Everything",
      preview:
        "Explore how Framer is reshaping web development, with real examples, web design insights, and practical web development tips for modern creators.",
      keyword: [
        "web design",
        "framer",
        "web development",
        "technology tutorial",
        "web development guide",
      ],
      status: "UPLOADED",
      date: "2025-03-04",
      wordCount: 2100,
      content: "<p>Learning web design...</p>",
      metaTitle: "Learning Web Design",
      metaDescription: "Master web design skills",
      tags: ["web design", "framer", "web development", "technology tutorial"],
      generatedImages: ["aimg3.png"],
    },
    {
      id: "4",
      title: "Why Framer is Changing How We Think About Web Development",
      preview:
        "Explore how Framer is reshaping web development, with real examples, web design insights, and practical web development tips for modern creators.",
      keyword: ["web design", "framer", "web development"],
      status: "UPLOADED",
      date: "2025-01-27",
      wordCount: 2500,
      content: "<p>Framer innovations...</p>",
      metaTitle: "Framer Guide",
      metaDescription: "Complete Framer tutorial",
      tags: ["web design", "framer", "web development", "technology tutorial"],
      generatedImages: ["/aimg1.png"],
    },
  ];

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

  const handleWebsiteChange = async (websiteId: string) => {
    setSelectedWebsiteId(websiteId);
    
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (user) {
      await fetchAnalytics(user.id, websiteId);
    }
  };

  useEffect(() => {
    loadUserWebsites();
  }, []);

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
    <div className="space-y-6">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        <h2 className="text-3xl font-normal">Performance overview</h2>
        <p className="text-[#00000080] text-sm mt-2">Turn competitor keywords into SEO-ready long blog posts in one click.</p>
        </div>
        <div className="">
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
          <CardTitle className="text-sm font-normal text-[#00000080]">Articles Generated </CardTitle>
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
          <CardTitle className="text-sm font-normal text-[#00000080]">Articles Live </CardTitle>
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
          <CardTitle className="text-sm font-normal text-[#00000080]">Est. Traffic Potential </CardTitle>
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
          <CardTitle className="text-sm font-normal text-[#00000080]">Keyword Tracked </CardTitle>
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
              <Button className="text-base font-normal text-white bg-black px-[60px] py-1 w-[170px] h-[50px] border border-[#00000080] rounded-[10px] hover:bg-transparent hover:text-[#00000080] cursor-pointer ">Create Post</Button>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-5">
          <Card className="bg-transparent px-4 py-5 ">
            <CardTitle className="text-lg font-normal text-[#000000b3] ml-4">Your Websites</CardTitle>
            <CardContent>
              {websites.length > 0 && (
                <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a] w-[400px]">
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
              onClick={() => setOpen(true)}
              className={`flex items-center justify-between border px-4 pb-4 pt-5 ${websites.length > 0 ? 'rounded-b-xl' : 'rounded-xl'} border-[#0000001a] w-[400px] cursor-pointer`}>
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
          <Card className="bg-transparent px-4 py-5 ">
            <CardTitle className="text-lg font-normal text-[#000000b3] ml-4">SEO Competitors</CardTitle>
            <CardContent>
              {analytics.totalCompetitors > 0 && (
                <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a] w-[400px]">
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
              <div className={`flex items-center justify-between border px-4 pb-4 pt-5 ${analytics.totalCompetitors > 0 ? 'rounded-b-xl' : 'rounded-xl'} border-[#0000001a] w-[400px]`}>
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
        <Card className="bg-transparent px-4 py-5 ">
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
                    className={`flex items-center justify-between border px-4 pb-4 pt-5 border-[#0000001a] ${
                      isFirst ? "rounded-t-xl" : ""
                    } ${isLast ? "rounded-b-xl" : "border-b-0"}`}
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
                      <Button
                        onClick={action.onClick}
                        className="border bg-transparent hover:bg-transparent text-[#00000080] border-[#0000001a] cursor-pointer"
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
  );
}
