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
import { ChevronLeft, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


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

  useEffect(() => {
    loadUserWebsites();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        <h2 className="text-3xl font-normal">Performance overview</h2>
        <p className="text-[#00000080] text-sm mt-2">Turn competitor keywords into SEO-ready long blog posts in one click.</p>
        </div>
        <div className="">
          <Select defaultValue="a">
              <SelectTrigger className="h-10 bg-transparent rounded-[8px] focus-visible:outline-none focus-visible:ring-0 border-[#0000001a] focus-visible:border-[#0000001a] focus:outline-none cursor-pointer outline-none active:outline-none px-3.5 py-2.5 text-[#00000080]">
                <SelectValue placeholder="Enter your website" /> 
              </SelectTrigger>
              <SelectContent className="cursor-pointer">
                <SelectItem value="a" className="cursor-pointer data-[state=checked]:text-[#00000080] data-[state=checked]:opacity-40 border-b rounded-none border-[#0000001a]">www.delani.pro</SelectItem>
                <SelectItem value="b" className="cursor-pointer data-[state=checked]:text-[#00000080] data-[state=checked]:opacity-40">www.delium.pro</SelectItem>
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
          <p className="text-[#000000b3] text-4xl font-bold mt-12">3</p>
        </CardContent>
      </Card>
      <Card className="border-border/40 bg-white rounded-none backdrop-blur-sm w-[222px] h-[174px]">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-[#00000080]">Articles Live </CardTitle>
          <Image src="/dashboardcardimg2.png" alt="" width={20} height={20} />
        </CardHeader>
        <CardContent>
          <p className="text-[#000000b3] text-4xl font-bold mt-12">11</p>
        </CardContent>
      </Card>
      <Card className="border-border/40 bg-white rounded-none backdrop-blur-sm w-[222px] h-[174px]">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-[#00000080]">Est. Traffic Potential </CardTitle>
          <Image src="/dashboardcardimg3.png" alt="" width={20} height={20} />
        </CardHeader>
        <CardContent>
          <p className="text-[#000000b3] text-4xl font-bold mt-12">23,000</p>
        </CardContent>
      </Card>
      <Card className="border-border/40 bg-white rounded-none rounded-r-xl backdrop-blur-sm w-[222px] h-[174px]">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm font-normal text-[#00000080]">Keyword Tracked </CardTitle>
          <Image src="/dashboardcardimg4.png" alt="" width={20} height={20} />
        </CardHeader>
        <CardContent>
          <p className="text-[#000000b3] text-4xl font-bold mt-12">7</p>
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
              <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a] w-[400px]">
                <div className="flex items-center gap-5">
                <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                  <Image src="/globe.png" alt="" width={20} height={20} />
                </div>
                <div>
                  <p className="text-sm text-[#000000b3] font-normal">1 website</p>
                  <p className="text-xs text-[#00000080] font-normal">www.delani.com</p>
                </div>
                </div>
                <div className="w-[34px] h-[34px] bg-[#00000000] rounded-xl flex items-center justify-center">
                  <Image src="/menudots.png" alt="" width={3} height={17} />
                </div>
              </div>
              <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-b-xl border-[#0000001a] w-[400px]">
                <div className="flex items-center gap-5">
                <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                  <Plus width={20} height={20} className="text-[#65b361]" />
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
              <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a] w-[400px]">
                <div className="flex items-center gap-5">
                <div className="bg-[rgb(247,247,247)] w-[34px] h-[34px] flex items-center justify-center rounded-[10px]">
                  <Image src="/globe.png" alt="" width={20} height={20} />
                </div>
                <div>
                  <p className="text-sm text-[#000000b3] font-normal">3 Competitors</p>
                  <p className="text-xs text-[#00000080] font-normal">www.lander.studio and 2 others</p>
                </div>
                </div>
                <div className="w-[34px] h-[34px] bg-[#00000000] rounded-xl flex items-center justify-center">
                  <Image src="/menudots.png" alt="" width={3} height={17} />
                </div>
              </div>
              <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-b-xl border-[#0000001a] w-[400px]">
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
              <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-t-xl border-[#0000001a]">
                <div className="flex items-center gap-5">
                <div className="bg-[rgb(247,247,247)] w-[30px] h-[30px] flex items-center justify-center rounded-[10px]">
                  <Image src="/actionimg1.png" alt="" width={18} height={26} className="rounded-[3px]" />
                </div>
                <div>
                  <p className="text-sm text-[#000000b3] font-normal">2 posts drafts waiting for review</p>
                  <p className="text-xs text-[#00000080] font-normal">Finish them to start ranking.</p>
                </div>
                </div>
                <div className=" bg-[#00000000] rounded-xl flex items-center justify-center">
                  <Button className="border ">View</Button>
                </div>
              </div>
              <div className="flex items-center justify-between border px-4 pb-4 pt-5 rounded-b-xl border-[#0000001a]">
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
      
      

      /* 🔵 Skeletons — show while loading */
      // {showSkeletons && (
      //   <div className="space-y-4">
      //     {[1, 2, 3].map((i) => (
      //       <Card key={i} className="border-border/40 bg-card/50 backdrop-blur-sm">
      //         <CardContent className="pt-6">
      //           <div className="flex items-start justify-between">
      //             <div className="flex-1 space-y-3">
      //               <Skeleton className="h-4 w-40 bg-gray-300" />
      //               <Skeleton className="h-4 w-32 bg-gray-300" />
      /* 🔵 Skeletons — show while loading */
      // {showSkeletons && (
      //   <div className="space-y-4">
      //     {[1, 2, 3].map((i) => (
      //       <Card key={i} className="border-border/40 bg-card/50 backdrop-blur-sm">
      //         <CardContent className="pt-6">
      //           <div className="flex items-start justify-between">
      //             <div className="flex-1 space-y-3">
      //               <Skeleton className="h-4 w-40 bg-gray-300" />
      //               <Skeleton className="h-4 w-32 bg-gray-300" />

      //               <div className="flex gap-4 mt-3">
      //                 <Skeleton className="h-4 w-20 bg-gray-300" />
      //                 <Skeleton className="h-4 w-24 bg-gray-300" />
      //               </div>
      //               <div className="flex gap-4 mt-3">
      //                 <Skeleton className="h-4 w-20 bg-gray-300" />
      //                 <Skeleton className="h-4 w-24 bg-gray-300" />
      //               </div>

      //               <Skeleton className="h-3 w-24 bg-gray-300" />
      //             </div>
      //               <Skeleton className="h-3 w-24 bg-gray-300" />
      //             </div>

      //             <div className="flex items-center gap-2">
      //               <Skeleton className="h-8 w-24 rounded bg-gray-300" />
      //               <Skeleton className="h-8 w-24 rounded bg-gray-300" />
      //               <Skeleton className="h-8 w-10 rounded bg-gray-300" />
      //             </div>
      //           </div>
      //         </CardContent>
      //       </Card>
      //     ))}
      //   </div>
      // )}
      //             <div className="flex items-center gap-2">
      //               <Skeleton className="h-8 w-24 rounded bg-gray-300" />
      //               <Skeleton className="h-8 w-24 rounded bg-gray-300" />
      //               <Skeleton className="h-8 w-10 rounded bg-gray-300" />
      //             </div>
      //           </div>
      //         </CardContent>
      //       </Card>
      //     ))}
      //   </div>
      // )}


      /* Real websites */
      // {websites.length > 0 && (
      //   <div className="space-y-4">
      //     <h3 className="text-lg font-semibold text-foreground">
      //       Your Websites
      //     </h3>
      /* Real websites */
      // {websites.length > 0 && (
      //   <div className="space-y-4">
      //     <h3 className="text-lg font-semibold text-foreground">
      //       Your Websites
      //     </h3>

      //     {websites.map((site) => (
      //       <Card
      //         key={site.id}
      //         className="border-border/40 bg-card/50 backdrop-blur-sm"
      //       >
      //         <CardContent className="pt-6">
      //           <div className="flex items-start justify-between">
      //             <div className="flex-1">
      //               <p className="font-medium text-foreground">{site.url}</p>
      //               <p className="text-sm text-muted-foreground mt-1">
      //                 {site.isAnalyzing ? (
      //                   <span className="flex items-center gap-2">
      //                     <div className="animate-spin">
      //                       <Image
      //                         src="/loader.png"
      //                         alt=""
      //                         width={92}
      //                         height={92}
      //                       />
      //                     </div>
      //                     Detecting topic...
      //                   </span>
      //                 ) : (
      //                   <>Topic: {site.topic}</>
      //                 )}
      //               </p>
      //     {websites.map((site) => (
      //       <Card
      //         key={site.id}
      //         className="border-border/40 bg-card/50 backdrop-blur-sm"
      //       >
      //         <CardContent className="pt-6">
      //           <div className="flex items-start justify-between">
      //             <div className="flex-1">
      //               <p className="font-medium text-foreground">{site.url}</p>
      //               <p className="text-sm text-muted-foreground mt-1">
      //                 {site.isAnalyzing ? (
      //                   <span className="flex items-center gap-2">
      //                     <div className="animate-spin">
      //                       <Image
      //                         src="/loader.png"
      //                         alt=""
      //                         width={92}
      //                         height={92}
      //                       />
      //                     </div>
      //                     Detecting topic...
      //                   </span>
      //                 ) : (
      //                   <>Topic: {site.topic}</>
      //                 )}
      //               </p>

      //               {!site.isAnalyzing && site.keywords && (
      //                 <div className="flex gap-4 mt-3">
      //                   <p className="text-sm text-muted-foreground flex items-center gap-1">
      //                     <span className="font-medium">
      //                       {getKeywordsCount(site.keywords)}
      //                     </span>
      //                     <span>Keywords</span>
      //                   </p>
      //               {!site.isAnalyzing && site.keywords && (
      //                 <div className="flex gap-4 mt-3">
      //                   <p className="text-sm text-muted-foreground flex items-center gap-1">
      //                     <span className="font-medium">
      //                       {getKeywordsCount(site.keywords)}
      //                     </span>
      //                     <span>Keywords</span>
      //                   </p>

      //                   {getCompetitorsCount(site.keywords) > 0 && (
      //                     <p className="text-sm text-muted-foreground flex items-center gap-1">
      //                       <Users className="w-3 h-3" />
      //                       <span className="font-medium">
      //                         {getCompetitorsCount(site.keywords)}
      //                       </span>
      //                       <span>Competitors</span>
      //                     </p>
      //                   )}
      //                 </div>
      //               )}
      //                   {getCompetitorsCount(site.keywords) > 0 && (
      //                     <p className="text-sm text-muted-foreground flex items-center gap-1">
      //                       <Users className="w-3 h-3" />
      //                       <span className="font-medium">
      //                         {getCompetitorsCount(site.keywords)}
      //                       </span>
      //                       <span>Competitors</span>
      //                     </p>
      //                   )}
      //                 </div>
      //               )}

      //               {site.created_at && (
      //                 <p className="text-xs text-muted-foreground mt-2">
      //                   Added: {new Date(site.created_at).toLocaleDateString()}
      //                 </p>
      //               )}
      //             </div>
      //               {site.created_at && (
      //                 <p className="text-xs text-muted-foreground mt-2">
      //                   Added: {new Date(site.created_at).toLocaleDateString()}
      //                 </p>
      //               )}
      //             </div>

      //             <div className="flex items-center gap-2">
      //               {!site.isAnalyzing && site.keywords && (
      //                 <>
      //                   <Button
      //                     onClick={() => onViewKeywords(site.id)}
      //                     variant="outline"
      //                     size="sm"
      //                     className="cursor-pointer gap-2"
      //                   >
      //                     <ExternalLink className="w-4 h-4" />
      //                     View Keywords
      //                   </Button>
      //             <div className="flex items-center gap-2">
      //               {!site.isAnalyzing && site.keywords && (
      //                 <>
      //                   <Button
      //                     onClick={() => onViewKeywords(site.id)}
      //                     variant="outline"
      //                     size="sm"
      //                     className="cursor-pointer gap-2"
      //                   >
      //                     <ExternalLink className="w-4 h-4" />
      //                     View Keywords
      //                   </Button>

      //                   {getCompetitorsCount(site.keywords) > 0 && (
      //                     <Button
      //                       onClick={() => onViewCompetitors(site.id)}
      //                       variant="outline"
      //                       size="sm"
      //                       className="cursor-pointer gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
      //                     >
      //                       <Users className="w-4 h-4" />
      //                       View Competitors
      //                     </Button>
      //                   )}
      //                 </>
      //               )}
      //               <Button
      //                 onClick={() => handleRemoveWebsite(site.id)}
      //                 variant="ghost"
      //                 size="sm"
      //                 className="cursor-pointer text-muted-foreground hover:text-destructive"
      //               >
      //                 <Trash2 className="w-4 h-4" />
      //               </Button>
      //             </div>
      //           </div>
      //         </CardContent>
      //       </Card>
      //     ))}
      //   </div>
      // )}
      //                   {getCompetitorsCount(site.keywords) > 0 && (
      //                     <Button
      //                       onClick={() => onViewCompetitors(site.id)}
      //                       variant="outline"
      //                       size="sm"
      //                       className="cursor-pointer gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
      //                     >
      //                       <Users className="w-4 h-4" />
      //                       View Competitors
      //                     </Button>
      //                   )}
      //                 </>
      //               )}
      //               <Button
      //                 onClick={() => handleRemoveWebsite(site.id)}
      //                 variant="ghost"
      //                 size="sm"
      //                 className="cursor-pointer text-muted-foreground hover:text-destructive"
      //               >
      //                 <Trash2 className="w-4 h-4" />
      //               </Button>
      //             </div>
      //           </div>
      //         </CardContent>
      //       </Card>
      //     ))}
      //   </div>
      // )}
  );
}
