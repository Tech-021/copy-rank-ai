"use client";

import { useState, useMemo, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Plus } from "lucide-react";
import { CreatePostDialog } from "@/components/ui/CreatePostDialog";
import { CreatePostDialogDashboard } from "../dialog2";
import { ImportCSVDialog } from "@/components/ui/ImportCSVDialog";
import { SyncCompetitorsDialog } from "@/components/ui/SyncCompetitorsDialog";
import { AddKeywordsDialog } from "@/components/ui/AddKeywordsDialog";
import { DeleteKeywordDialog } from "@/components/ui/DeleteKeywordDialog";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  TrendingUp,
  BarChart3,
  Filter,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { useToast } from "../ui/toast";
import { getUser } from "@/lib/auth";
import { supabase } from "@/lib/client";
import { getUserArticleLimit } from "@/lib/articleLimits";
import Image from "next/image";

interface KeywordsTabProps {
  websiteId?: string;
  onArticlesGenerated?: (articles: any[]) => void;
}

interface Keyword {
  id?: string;
  keyword: string;
  search_volume: number;
  websiteId?: string;
  difficulty: number;
  cpc: number;
  competition: number;
  selected?: boolean;
  is_target_keyword?: boolean;
  post_status?: "Live" | "Draft" | "No Plan";
  traffic_potential?: string;
}

interface Website {
  id: string;
  url: string;
  topic: string;
  created_at?: string;
}

interface WebsiteData {
  website: {
    id: string;
    url: string;
    topic: string;
  };
  keywords: Keyword[];
}

interface Article {
  id: string;
  title: string;
  content: string;
  keyword: string;

  status: "Published" | "Scheduled" | "Draft";
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
}

// Removed mock data: now pulling real keywords via /api/keyword and websites via Supabase

export function KeywordsTab({
  websiteId: initialWebsiteId,
  onArticlesGenerated,
  websiteId,
}: KeywordsTabProps) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    initialWebsiteId || null
  );
  const [websites, setWebsites] = useState<Website[]>([]);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWebsites, setLoadingWebsites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("volume-desc");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<number>>(
    new Set()
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogCompleted, setDialogCompleted] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showAddKeywordsDialog, setShowAddKeywordsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keywordToDelete, setKeywordToDelete] = useState<{ index: number; keyword: string } | null>(null);
  const toast = useToast();

  // Handle dialog completion timing
  useEffect(() => {
    if (showCreateDialog && !dialogCompleted && generatingContent) {
      const timer = setTimeout(() => {
        setDialogCompleted(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showCreateDialog, dialogCompleted, generatingContent]);

  // Handle dialog closing
  useEffect(() => {
    if (dialogCompleted) {
      const timer = setTimeout(() => {
        setShowCreateDialog(false);
        setDialogCompleted(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [dialogCompleted]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: user, error } = await getUser();
        if (error) {
          console.error("Error fetching current user:", error);
          setCurrentUser(null);
          return;
        }
        setCurrentUser(user);
        console.log("👤 Current user:", user?.id);
      } catch (err) {
        console.error("Failed to get current user:", err);
        setCurrentUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const loadUserWebsites = async () => {
    try {
      setLoadingWebsites(true);
      // Don't error if user isn't loaded yet—just return and wait
      if (!currentUser || !currentUser.id) {
        return;
      }

      const { data, error: dbError } = await supabase
        .from("websites")
        .select("id, url, topic, keywords")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (dbError) {
        console.error("Error loading websites:", dbError);
        setError("Failed to load websites");
        return;
      }

      const userWebsites: Website[] = (data || []).map((w: any) => ({
        id: w.id,
        url: w.url,
        topic: w.topic || "General",
        // carry stored keywords payload for later merge
        keywords: w.keywords,
      }));

      setWebsites(userWebsites);
      setError(null);
      if (!selectedWebsiteId && userWebsites.length > 0) {
        setSelectedWebsiteId(userWebsites[0].id);
      }
    } catch (error) {
      console.error("Error loading websites:", error);
      setError("Failed to load websites");
    } finally {
      setLoadingWebsites(false);
    }
  };

  useEffect(() => {
    if (initialWebsiteId) {
      setSelectedWebsiteId(initialWebsiteId);
    } else if (websiteId) {
      setSelectedWebsiteId(websiteId);
    } else if (!loadingUser && currentUser?.id) {
      // Only load websites after user auth is confirmed
      loadUserWebsites();
    }
  }, [initialWebsiteId, websiteId, loadingUser, currentUser?.id]);

  useEffect(() => {
    console.log("🔍 KeywordsTab - selectedWebsiteId:", selectedWebsiteId);

    if (selectedWebsiteId) {
      fetchKeywords();
    } else if (!loadingWebsites) {
      setLoading(false);
    }
  }, [selectedWebsiteId]);

  const fetchKeywords = async () => {
    if (!selectedWebsiteId) return;

    try {
      setLoading(true);
      setError(null);
      console.log(`🔍 Fetching REAL keywords for website: ${selectedWebsiteId}`);

      // Always fetch fresh website data from Supabase to get latest keywords
      const { data: singleSite } = await supabase
        .from("websites")
        .select("id, url, topic, keywords")
        .eq("id", selectedWebsiteId)
        .single();
      
      let website: (Website & { keywords?: any }) | null = null;
      if (singleSite) {
        website = {
          id: singleSite.id,
          url: singleSite.url,
          topic: singleSite.topic || "General",
          keywords: (singleSite as any).keywords,
        };
      }

      if (!website) {
        throw new Error("Website not found");
      }

      // Call real keyword API with tuned filters to avoid over-restrictive defaults
      const response = await fetch(`/api/keyword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: website.topic || "General",
          websiteUrl: website.url || "",
          includeCompetitors: true,
          maxVolume: 10000, // allow medium/high volume keywords
          minVolume: 50, // allow smaller niches
          maxDifficulty: 100, // don't drop harder keywords in the UI
          limit: 100,
        }),
      });

      const apiData = await response.json();
      if (!response.ok || !apiData.success) {
        throw new Error(
          apiData.error || "Failed to fetch keywords from DataForSEO"
        );
      }

      const competitorKeywords: Keyword[] = Array.isArray(apiData.competitors)
        ? apiData.competitors.flatMap((comp: any) => comp.keywords || [])
        : [];

      const primaryKeywords = (apiData.keywords || []) as Keyword[];

      const targetKeywordsFromSite: Keyword[] = (() => {
        const kw = (website as any)?.keywords;
        const arr = kw?.keywords;
        if (Array.isArray(arr)) {
          return arr.filter((k: any) => k && k.keyword);
        }
        return [];
      })();

      // Merge primary + competitor + stored target keywords, dedupe by keyword text (case-insensitive)
      const mergedKeywordsMap = new Map<string, any>();

      [...primaryKeywords, ...competitorKeywords, ...targetKeywordsFromSite].forEach((kw: any) => {
        if (!kw?.keyword) return;
        const key = String(kw.keyword).toLowerCase();
        if (!mergedKeywordsMap.has(key)) {
          mergedKeywordsMap.set(key, kw);
        }
      });

      const realKeywords = Array.from(mergedKeywordsMap.values());

      setWebsiteData({
        website: {
          id: website.id,
          url: website.url,
          topic: website.topic,
        },
        keywords: realKeywords,
      });

      setKeywords(
        realKeywords.map((kw: any) => ({
          id: kw.id || undefined,
          keyword: kw.keyword,
          search_volume: kw.search_volume,
          difficulty: kw.difficulty,
          cpc: kw.cpc,
          competition: kw.competition,
          // Default UI-only fields
          post_status: kw.post_status || "No Plan",
          traffic_potential:
            kw.traffic_potential ||
            (kw.search_volume ? `${Math.round(kw.search_volume * 0.1)}+/mo` : "—"),
        }))
      );
      setSelectedKeywords(new Set());
      console.log(`✅ Total REAL keywords loaded: ${realKeywords.length}`);
    } catch (err) {
      console.error("Error fetching keywords:", err);
      setError(err instanceof Error ? err.message : "Failed to load keywords");
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedKeywords = useMemo(() => {
    const filtered = keywords.filter((kw) => {
      const matchesSearch = kw.keyword
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      let difficultyCategory: "Low" | "Medium" | "High";
      if (kw.difficulty <= 40) difficultyCategory = "Low";
      else if (kw.difficulty <= 70) difficultyCategory = "Medium";
      else difficultyCategory = "High";

      const matchesDifficulty =
        difficultyFilter === "all" || difficultyCategory === difficultyFilter;
      return matchesSearch && matchesDifficulty;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "volume-desc":
          return b.search_volume - a.search_volume;
        case "volume-asc":
          return a.search_volume - b.search_volume;
        case "difficulty-asc":
          return a.difficulty - b.difficulty;
        case "difficulty-desc":
          return b.difficulty - a.difficulty;
        case "cpc-desc":
          return b.cpc - a.cpc;
        case "cpc-asc":
          return a.cpc - b.cpc;
        case "competition-asc":
          return a.competition - b.competition;
        case "competition-desc":
          return b.competition - a.competition;
        default:
          return 0;
      }
    });

    return filtered;
  }, [keywords, searchQuery, difficultyFilter, sortBy]);

  const generateContentFromKeywords = async () => {
    // Open dialog immediately without validation toasts
    setGeneratingContent(true);
    setShowCreateDialog(true);
    setDialogCompleted(false);

    if (!selectedKeywords || selectedKeywords.size === 0) {
      return;
    }

    if (!currentUser) {
      return;
    }

    if (!filteredAndSortedKeywords || filteredAndSortedKeywords.length === 0) {
      return;
    }

    try {
      const selectedKeywordTexts = Array.from(selectedKeywords)
        .map((index) => filteredAndSortedKeywords[index]?.keyword)
        .filter(Boolean);

      if (selectedKeywordTexts.length === 0) {
        return;
      }

      // TODO: Replace with real API when ready
      // const userLimit = await getUserArticleLimit(currentUser.id);
      // const response = await fetch("/api/test-generate-article", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     keywords: selectedKeywordTexts,
      //     userId: currentUser.id,
      //     websiteId: selectedWebsiteId,
      //   }),
      // });

      // Mock content generation for now
      const generatedArticles: Article[] = selectedKeywordTexts.map(
        (keyword, i) => ({
          id: `article-${i}`,
          title: `Complete Guide to ${keyword}`,
          content: `This is a comprehensive guide about ${keyword}...`,
          keyword,
          status: "Draft" as const,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          preview: `Learn everything you need to know about ${keyword}...`,
          wordCount: 2500,
          metaTitle: `${keyword} - Complete Guide`,
          metaDescription: `Comprehensive guide to ${keyword}. Learn best practices and tips.`,
          readingTime: "12 min",
          contentScore: 85,
          keywordDensity: 2.5,
        })
      );

      if (onArticlesGenerated && generatedArticles.length > 0) {
        onArticlesGenerated(generatedArticles);
      }

      setSelectedKeywords(new Set());
    } catch (error) {
      console.error("Error generating content:", error);
    } finally {
      setGeneratingContent(false);
    }
  };

  const toggleKeywordSelection = (index: number) => {
    if (!selectedKeywords) return;
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedKeywords(newSelected);
  };

  const toggleSelectAll = () => {
    if (!selectedKeywords || !filteredAndSortedKeywords) return;
    if (selectedKeywords.size === filteredAndSortedKeywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(
        new Set(filteredAndSortedKeywords.map((_, index) => index))
      );
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 40) return "bg-green-100 text-green-700 border-green-200";
    else if (difficulty <= 70)
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    else return "bg-red-100 text-red-700 border-red-200";
  };

  const getDifficultyText = (difficulty: number) => {
    if (difficulty <= 40) return "Low";
    else if (difficulty <= 70) return "Medium";
    else return "High";
  };

  const getCompetitionColor = (competition: number) => {
    if (competition <= 0.3)
      return "bg-green-100 text-green-700 border-green-200";
    else if (competition <= 0.6)
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    else return "bg-red-100 text-red-700 border-red-200";
  };

  const getCompetitionText = (competition: number) => {
    if (competition <= 0.3) return "Low";
    else if (competition <= 0.6) return "Medium";
    else return "High";
  };

  const getPostStatusColor = (status?: string) => {
    switch (status) {
      case "Live":
        return "bg-green-100 text-green-700 border-green-200";
      case "Draft":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "No Plan":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Calculate stats
  const stats = {
    totalKeywords: keywords.length,
    highPotential: keywords.filter((kw) => kw.difficulty <= 40).length,
    withContent: keywords.filter(
      (kw) => kw.post_status === "Live" || kw.post_status === "Draft"
    ).length,
    withoutContent: keywords.filter((kw) => kw.post_status === "No Plan")
      .length,
  };

  const exportKeywords = () => {
    const csvContent = [
      [
        "Keyword",
        "Search Volume",
        "Difficulty",
        "CPC",
        "Competition",
        "Status",
      ],
      ...filteredAndSortedKeywords.map((kw) => [
        kw.keyword,
        kw.search_volume,
        kw.difficulty,
        `$${kw.cpc.toFixed(2)}`,
        kw.competition.toFixed(2),
        kw.post_status || "N/A",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keywords-${websiteData?.website.topic || "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split("\n");
      const importedKeywords: string[] = [];

      // Skip header, parse each line
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const keyword = lines[i].split(",")[0]?.trim();
          if (keyword) importedKeywords.push(keyword);
        }
      }

      if (importedKeywords.length > 0) {
        console.log("Importing keywords:", importedKeywords);
        // Persist to Supabase
        const success = await importKeywordsFromCSV(importedKeywords);
        
        if (success) {
          console.log(`✅ Successfully imported ${importedKeywords.length} keyword(s)`);
          // toast?.success(`Successfully imported ${importedKeywords.length} keywords`);
        }
      }
      
      setShowImportDialog(false);
    };
    reader.readAsText(file);
  };

  const handleDeleteKeyword = (index: number) => {
    const keyword = filteredAndSortedKeywords[index];
    if (keyword) {
      setKeywordToDelete({ index, keyword: keyword.keyword });
      setShowDeleteDialog(true);
    }
  };

  const confirmDeleteKeyword = () => {
    if (keywordToDelete) {
      const newKeywords = keywords.filter(
        (kw) => kw.keyword !== keywordToDelete.keyword
      );
      setKeywords(newKeywords);
      setShowDeleteDialog(false);
      setKeywordToDelete(null);
      // toast?.success(`Deleted "${keywordToDelete.keyword}"`);
    }
  };

  // Helper: Persist keywords to Supabase website's keywords array
  const persistKeywordsToWebsite = async (newKeywords: Keyword[]) => {
    try {
      if (!selectedWebsiteId) {
        console.error("No website selected");
        return false;
      }

      // Fetch current website keywords payload
      const { data: siteData, error: siteErr } = await supabase
        .from("websites")
        .select("id, keywords")
        .eq("id", selectedWebsiteId)
        .single();

      if (siteErr) {
        console.error("Failed to fetch website:", siteErr);
        return false;
      }

      const existingPayload = (siteData as any)?.keywords || {};
      const existingList: any[] = Array.isArray(existingPayload?.keywords)
        ? existingPayload.keywords
        : [];

      // Merge & dedupe by keyword text (case-insensitive)
      const map = new Map<string, any>();
      
      // Add existing keywords
      existingList.forEach((k) => {
        const key = String(k.keyword || "").toLowerCase();
        if (key) map.set(key, k);
      });

      // Add/update new keywords
      newKeywords.forEach((k) => {
        const key = String(k.keyword || "").toLowerCase();
        if (key) {
          const existing = map.get(key) || {};
          map.set(key, {
            ...existing,
            ...k,
            is_target_keyword: true,
            post_status: k.post_status || "No Plan",
          });
        }
      });

      const mergedList = Array.from(map.values());
      const newPayload = { 
        ...existingPayload, 
        keywords: mergedList,
        analysis_metadata: {
          ...existingPayload.analysis_metadata,
          total_keywords: mergedList.length,
          analyzed_at: new Date().toISOString(),
        }
      };

      // Update in Supabase
      const { error: updateErr } = await supabase
        .from("websites")
        .update({ keywords: newPayload })
        .eq("id", selectedWebsiteId);

      if (updateErr) {
        console.error("Failed to update website keywords:", updateErr);
        return false;
      }

      console.log(`✅ Saved ${newKeywords.length} keyword(s) to website`);
      return true;
    } catch (e) {
      console.error("Error persisting keywords:", e);
      return false;
    }
  };

  // Add selected keywords from table to website
  const addSelectedKeywordsToWebsite = async () => {
    try {
      if (!selectedWebsiteId) {
        console.log("No website selected");
        return;
      }
      if (!selectedKeywords || selectedKeywords.size === 0) {
        console.log("No keywords selected");
        return;
      }

      // Show importing dialog
      setShowAddKeywordsDialog(true);

      // Get selected keyword objects from the filtered/sorted view
      const selectedKeywordObjs = Array.from(selectedKeywords)
        .map((idx) => filteredAndSortedKeywords[idx])
        .filter(Boolean);

      // Persist to Supabase
      const success = await persistKeywordsToWebsite(selectedKeywordObjs);

      if (success) {
        // Refresh keywords to show newly added ones
        await fetchKeywords();
        // Clear selection
        setSelectedKeywords(new Set());
      }
    } catch (e) {
      console.error("Error adding keywords:", e);
    }
  };

  // Import keywords from CSV
  const importKeywordsFromCSV = async (importedStrings: string[]) => {
    try {
      if (!selectedWebsiteId) {
        console.error("No website selected");
        return false;
      }

      // Convert strings to keyword objects with defaults
      const keywordObjs: Keyword[] = importedStrings.map((keyword) => ({
        keyword: keyword.trim(),
        search_volume: 0,
        difficulty: 0,
        cpc: 0,
        competition: 0,
        post_status: "No Plan" as const,
        is_target_keyword: true,
      }));

      // Persist to Supabase
      const success = await persistKeywordsToWebsite(keywordObjs);

      if (success) {
        // Refresh keywords
        await fetchKeywords();
        console.log(`✅ Imported ${keywordObjs.length} keyword(s)`);
      }

      return success;
    } catch (e) {
      console.error("Error importing keywords:", e);
      return false;
    }
  };

  if (loadingWebsites) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin">
          <Image src="/loader.png" alt="Loading" width={92} height={92} />
        </div>
      </div>
    );
  }

  if (error && !selectedWebsiteId && websites.length === 0 && !loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadUserWebsites} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Image src="/loader.png" alt="Loading" width={92} height={92} />
          </div>
        </div>
      </div>
    );
  }

  if (!websiteData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No website data found</p>
          <p className="text-sm text-gray-500">
            Please select a website from the list above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-700 font-medium">Keywords</h2>
          <p className="text-sm text-gray-600 mt-1">
            Track the keywords driving your traffic
          </p>
        </div>
        <div className="flex ">
          <Button
            variant="outline"
            className="gap-2 text-gray-500 border-gray-200 rounded-r-none hover:bg-gray-50"
            onClick={() => setShowAddKeywordsDialog(true)}
          >
            Add Keywords
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-gray-500 border-gray-200 rounded-none hover:bg-gray-50"
            onClick={() => setShowImportDialog(true)}
          >
            Import CSV
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-gray-500 border-gray-200 rounded-l-none hover:bg-gray-50"
            onClick={() => setShowSyncDialog(true)}
          >
            <ExternalLink className="w-4 h-4" />
            {websiteData.website.url?.replace(/^https?:\/\//, "")}
          </Button>
          <div className="flex ml-5">
            <Select
              value={selectedWebsiteId ?? ""}
              onValueChange={(val) => setSelectedWebsiteId(val)}
              disabled={websites.length === 0}
           >
              <SelectTrigger className="w-56 h-9 border-gray-200">
                <SelectValue placeholder="Select website" />
              </SelectTrigger>
              <SelectContent>
                {websites.length > 0 ? (
                  websites.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.url?.replace(/^https?:\/\//, "")}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No websites found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards - Pixel Perfect */}
      <div className="grid grid-cols-4 ">
        <Card className="border rounded-r-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
                Total Keywords
              </p>
              <Image src="/stats1.svg" alt="icon" height={15} width={19.5} />
            </div>
            <p className="text-4xl flex items-end font-bold  text-gray-900">
              {stats.totalKeywords}
            </p>
          </CardContent>
        </Card>

        <Card className="border rounded-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
                High Potential Keywords
              </p>
              <Image src="/stats2.svg" alt="icon" height={15} width={19.5} />
            </div>
            <p className="text-4xl font-bold text-gray-900">{stats.highPotential}</p>
          </CardContent>
        </Card>

        <Card className="border rounded-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
                With Content
              </p>
              <Image src="/stats3.svg" alt="icon" height={15} width={19.5} />
            </div>
            <p className="text-4xl font-bold text-gray-900">{stats.withContent}</p>
          </CardContent>
        </Card>

        <Card className="border rounded-l-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
                Without Content
              </p>
              <Image src="/stats4.svg" alt="icon" height={15} width={19.5} />{" "}
            </div>
            <p className="text-4xl font-bold text-gray-900">{stats.withoutContent}</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center justify-between w-full">
        {/* LEFT */}
        <div className="flex items-center gap-6 text-sm text-gray-500">
          {/* Filters Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 hover:text-gray-700">
                Filters
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => setDifficultyFilter("all")}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDifficultyFilter("Low")}>Low Difficulty</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDifficultyFilter("Medium")}>Medium Difficulty</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDifficultyFilter("High")}>High Difficulty</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort By Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 hover:text-gray-700">
                Sort By
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => setSortBy("volume-desc")}>Search Volume (High → Low)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("volume-asc")}>Search Volume (Low → High)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("difficulty-asc")}>Difficulty (Low → High)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("difficulty-desc")}>Difficulty (High → Low)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("cpc-desc")}>CPC (High → Low)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("cpc-asc")}>CPC (Low → High)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("competition-asc")}>Competition (Low → High)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("competition-desc")}>Competition (High → Low)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search */}
          <div className="relative w-full max-w-[210px]">
            <Input
              type="text"
              placeholder="Search Keywords"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search keywords"
              className="h-9 pl-9 pr-3 bg-gray-50 border-gray-200 text-sm placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* CENTER */}
        <div className=" ">
          {/* <div className="relative">
      <input
        type="text"
        placeholder="Search Keywords"
        className="w-full h-9 rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm placeholder-gray-400"
      />
    </div> */}
        </div>

        {/* RIGHT */}
        <button 
          onClick={() => setShowCreateDialog(true)}
          className="h-9 px-8 rounded-md bg-gray-400 hover:bg-black text-white text-sm transition-colors"
        >
          Create Post
        </button>
      </div>

      {/* Filters and Table */}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full border-collapse">
          {/* ================= HEADER ================= */}
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="px-4 py-4 text-left w-10">
                <input
                  type="checkbox"
                  checked={
                    filteredAndSortedKeywords.length > 0 &&
                    selectedKeywords.size === filteredAndSortedKeywords.length
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all keywords"
                  className="w-4 h-4 rounded border-gray-300 focus:ring-0"
                />
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Keyword
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Search Volume
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Difficulty
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Competition
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Post Status
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Traffic Potential
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                Action
              </th>
            </tr>
          </thead>

          {/* ================= BODY ================= */}
          <tbody>
            {filteredAndSortedKeywords.length > 0 ? (
              filteredAndSortedKeywords.map((kw, index) => {
                const difficultyText = getDifficultyText(kw.difficulty);
                const difficultyColor = getDifficultyColor(kw.difficulty);
                const competitionText = getCompetitionText(kw.competition);
                const competitionColor = getCompetitionColor(kw.competition);
                const trafficText = kw.traffic_potential || "—";
                return (
                  <tr
                    key={`${kw.keyword}-${index}`}
                    className={`${index !== filteredAndSortedKeywords.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}
                  >
                    <td className="px-4 py-3 w-10">
                      <input
                        className="w-4 h-4 rounded border-gray-300"
                        type="checkbox"
                        checked={selectedKeywords.has(index)}
                        onChange={() => toggleKeywordSelection(index)}
                        aria-label={`Select keyword ${kw.keyword}`}
                      />
                    </td>
                    <td className="px-4 text-gray-700 py-3 text-sm">{kw.keyword}</td>
                    <td className="px-4 text-gray-500 py-3 text-sm">{kw.search_volume?.toLocaleString() || "—"}</td>
                    <td className="px-4 text-gray-500 py-3 text-sm"><span className={`px-2 py-0.5 text-xs `}>{difficultyText}</span></td>
                    <td className="px-4 text-gray-500 py-3 text-sm"><span className={`px-2 py-0.5 text-xs  `}>{competitionText}</span></td>
                    <td className="pl-15 py-3"><span className={`px-3 py-1 text-xs rounded-md ${getPostStatusColor(kw.post_status)}`}>{kw.post_status || "No Plan"}</span></td>
                    <td className="px-4 text-gray-500 py-3 text-sm">{trafficText}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button variant={"outline"} className="border rounded-r-none bg-transparent border-gray-200 rounded-l-md px-8 h-8 text-xs">Edit</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant={"outline"} className="border border-l-0 rounded-l-none bg-transparent border-gray-200 rounded-r-md w-8 h-8 p-0 flex items-center justify-center hover:bg-gray-50"><ChevronDown className="w-4 h-4 text-gray-600" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem onClick={() => handleDeleteKeyword(index)} className="text-red-600 cursor-pointer">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">No keywords found for this website</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Selection Bar */}
      {selectedKeywords && selectedKeywords.size > 0 && (
        <div className="mt-4 flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-gray-900">
            {selectedKeywords.size} keyword
            {selectedKeywords.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-4 border-gray-200 bg-white hover:bg-gray-50 text-sm font-normal"
              onClick={addSelectedKeywordsToWebsite}
            >
              Add Keywords
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              onClick={() => setShowCreateDialog(true)}
              disabled={generatingContent}
            >
              Create Post
            </Button>
          </div>
        </div>
      )}

      {/* Create Post Dialog (enqueue-backed) */}
      <CreatePostDialogDashboard
        open={showCreateDialog}
        onOpenChange={(val) => {
          setShowCreateDialog(val);
          if (!val) setDialogCompleted(false);
        }}
        websiteId={selectedWebsiteId ?? undefined}
        onCreated={() => {
          setDialogCompleted(true);
          fetchKeywords();
        }}
      />

      {/* Import CSV Dialog */}
      <ImportCSVDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImportCSV}
      />

      {/* Sync Competitors Dialog */}
      <SyncCompetitorsDialog
        isOpen={showSyncDialog}
        onClose={() => setShowSyncDialog(false)}
      />

      {/* Add Keywords Dialog */}
      <AddKeywordsDialog
        isOpen={showAddKeywordsDialog}
        onClose={() => setShowAddKeywordsDialog(false)}
        onAdd={async (keywords) => {
          await importKeywordsFromCSV(keywords)
        }}
      />

      {/* Delete Keyword Dialog */}
      <DeleteKeywordDialog
        isOpen={showDeleteDialog}
        keyword={keywordToDelete?.keyword || ""}
        onClose={() => {
          setShowDeleteDialog(false);
          setKeywordToDelete(null);
        }}
        onConfirm={confirmDeleteKeyword}
      />
    </div>
  );
}
