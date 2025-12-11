"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Trash2, ExternalLink, Users } from "lucide-react";
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
import { ChevronLeft } from "lucide-react";

interface AnalyzeTabProps {
  onViewKeywords: (websiteId: string) => void;
  onViewCompetitors: (websiteId: string) => void;
}

interface Website {
  id: string;
  url: string;
  topic: string;
  keywords: any;
  isAnalyzing?: boolean;
  user_id?: string;
  created_at?: string;
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
  const [tab, setTab] = useState("tab1");

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
      }
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

  useEffect(() => {
    loadUserWebsites();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Add Website</CardTitle>
          <CardDescription>
            Add your website with competitors and keywords to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            Add Your Website
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="min-w-[1200px] px-0 py-0 max-h-[600px] overflow-y-scroll overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>
    <div className="dialog flex gap-[60px] w-full">
      {/* Left section */}
      <div className="relative w-[500px] h-[780px] bg-[linear-gradient(to_top,rgb(31,135,61)_0%,rgb(44,162,74)_100%)] overflow-hidden p-10 flex flex-col gap-10 rounded-l-lg">
        <div>
          <Image src="/dialog_logo.png" alt="" width={50} height={50} />
        </div>
        <div className="flex flex-col gap-4 relative items-center justify-center mt-14">
          <h1 className="text-white font-normal text-[38px]">
            A few clicks away <br />
            from generating your <br />
            SEO optimized blogs
          </h1>
          <p className="text-white font-normal text-sm max-w-lg">
            Instantly analyze your niche, target high-volume keywords, and{" "}
            <br />
            publish content that converts.
          </p>
          <Image
            src="/dialog_bg.png"
            alt=""
            width={650}
            height={420}
            className="absolute -right-40 -bottom-64"
          />
        </div>
        <Image
          src="/line1.png"
          alt=""
          width={968}
          height={558}
          className="absolute top-100 left-0"
        />
        <Image
          src="/line2.png"
          alt=""
          width={682}
          height={398}
          className="absolute top-82 left-0"
        />
        <Image
          src="/line3.png"
          alt=""
          width={1148}
          height={662}
          className="absolute top-16 left-0"
        />
      </div>
      {/* Right section */}
      <div className="py-10 pr-10 flex flex-col gap-[140px] w-[700px]">
        <div className="w-[600px] text-right">
          <p className="text-[15px] font-normal text-[#00000080]">
            Having troubles?{" "}
            <span className="text-[#5baf57] font-normal cursor-pointer">
              Get Help
            </span>
          </p>
        </div>
        {tab === "tab1" && (
          <div className="flex flex-col gap-60">
            <div className="flex flex-col gap-[30px]">
              <div>
                <h1 className="text-[#000000B3] text-lg font-normal">
                  Website URL
                </h1>
                <p className="text-[15px] text-[#00000080] font-normal">
                  Start with your domain
                </p>
              </div>
              <div className="space-y-5">
                {/* Website Name */}
                <div>
                  <Input
                    type="text"
                    placeholder="Enter your website URL"
                    value={websiteName}
                    onChange={(e) => setWebsiteName(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => setTab("tab2")}
                  className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer"
                >
                  Next
                </button>
              </div>
              <div>
                <p className="text-sm text-[#0000004D] font-normal">1 of 3</p>
              </div>
            </div>
            <div>
                <button
                // onClick={() => setTab('tab2')}
                className="flex text-[#000000b3] text-[15px] items-center cursor-pointer"
                ><ChevronLeft />Back</button>
            </div>
          </div>
        )}
        {tab === "tab2" && (
          <div className="flex flex-col gap-30">
            <div className="flex flex-col gap-[30px]">
              <div>
                <h1 className="text-[#000000B3] text-lg font-normal">
                  Top 3 Competitiors
                </h1>
                <p className="text-[15px] text-[#00000080] font-normal">
                  Who are you Beating
                </p>
              </div>
              <div className="space-y-5">
                {/* Competitors Name */}
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Competitor 1"
                    value={competitor1}
                    onChange={(e) => setCompetitor1(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 2"
                    value={competitor2}
                    onChange={(e) => setCompetitor2(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 3"
                    value={competitor3}
                    onChange={(e) => setCompetitor3(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => setTab("tab3")}
                  className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer"
                >
                  Next
                </button>
              </div>
              <div>
                <p className="text-sm text-[#0000004D] font-normal">2 of 3</p>
              </div>
            </div>
            <div>
                <button
                onClick={() => setTab('tab1')}
                className="flex text-[#000000b3] text-[15px] items-center cursor-pointer"
                ><ChevronLeft />Back</button>
            </div>
          </div>
        )}
        {tab === "tab3" && (
          <div className="flex flex-col gap-30">
            <div className="flex flex-col gap-[30px]">
              <div>
                <h1 className="text-[#000000B3] text-lg font-normal">
                  Keywords
                </h1>
                <p className="text-[15px] text-[#00000080] font-normal">
                  What do you want rank for?
                </p>
              </div>
              <div className="space-y-5">
                {/* Website Name */}
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Keyword 1"
                    value={keyword1}
                    onChange={(e) => setKeyword1(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 2"
                    value={keyword2}
                    onChange={(e) => setKeyword2(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 3"
                    value={keyword3}
                    onChange={(e) => setKeyword3(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => setTab("tab3")}
                  className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer"
                >
                  Submit
                </button>
              </div>
              <div>
                <p className="text-sm text-[#0000004D] font-normal">3 of 3</p>
              </div>
            </div>
            <div>
                <button
                onClick={() => setTab('tab2')}
                className="flex text-[#000000b3] text-[15px] items-center cursor-pointer"
                ><ChevronLeft />Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </DialogContent>
    </Dialog>

      {/* 🔵 Skeletons — show while loading */}
      {showSkeletons && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-40 bg-gray-300" />
                    <Skeleton className="h-4 w-32 bg-gray-300" />

                    <div className="flex gap-4 mt-3">
                      <Skeleton className="h-4 w-20 bg-gray-300" />
                      <Skeleton className="h-4 w-24 bg-gray-300" />
                    </div>

                    <Skeleton className="h-3 w-24 bg-gray-300" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-24 rounded bg-gray-300" />
                    <Skeleton className="h-8 w-24 rounded bg-gray-300" />
                    <Skeleton className="h-8 w-10 rounded bg-gray-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      {/* Real websites */}
      {websites.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Your Websites
          </h3>

          {websites.map((site) => (
            <Card
              key={site.id}
              className="border-border/40 bg-card/50 backdrop-blur-sm"
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{site.url}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {site.isAnalyzing ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin">
                            <Image
                              src="/loader.png"
                              alt=""
                              width={92}
                              height={92}
                            />
                          </div>
                          Detecting topic...
                        </span>
                      ) : (
                        <>Topic: {site.topic}</>
                      )}
                    </p>

                    {!site.isAnalyzing && site.keywords && (
                      <div className="flex gap-4 mt-3">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <span className="font-medium">
                            {getKeywordsCount(site.keywords)}
                          </span>
                          <span>Keywords</span>
                        </p>

                        {getCompetitorsCount(site.keywords) > 0 && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span className="font-medium">
                              {getCompetitorsCount(site.keywords)}
                            </span>
                            <span>Competitors</span>
                          </p>
                        )}
                      </div>
                    )}

                    {site.created_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Added: {new Date(site.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!site.isAnalyzing && site.keywords && (
                      <>
                        <Button
                          onClick={() => onViewKeywords(site.id)}
                          variant="outline"
                          size="sm"
                          className="cursor-pointer gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Keywords
                        </Button>

                        {getCompetitorsCount(site.keywords) > 0 && (
                          <Button
                            onClick={() => onViewCompetitors(site.id)}
                            variant="outline"
                            size="sm"
                            className="cursor-pointer gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                          >
                            <Users className="w-4 h-4" />
                            View Competitors
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      onClick={() => handleRemoveWebsite(site.id)}
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
