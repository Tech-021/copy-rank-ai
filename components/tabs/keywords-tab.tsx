"use client";

import { useState, useMemo, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Plus } from "lucide-react";
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

// Mock data for development
const MOCK_KEYWORDS: Keyword[] = [
  {
    id: "1",
    keyword: "web development",
    search_volume: 27100,
    difficulty: 62,
    cpc: 15.5,
    competition: 0.65,
    post_status: "Live",
    traffic_potential: "4.2k/mo",
  },
  {
    id: "2",
    keyword: "web design",
    search_volume: 12300,
    difficulty: 58,
    cpc: 12.8,
    competition: 0.72,
    post_status: "Draft",
    traffic_potential: "3.8k/mo",
  },
  {
    id: "3",
    keyword: "frame templates",
    search_volume: 8400,
    difficulty: 32,
    cpc: 8.2,
    competition: 0.45,
    post_status: "No Plan",
    traffic_potential: "1.9k/mo",
  },
  {
    id: "4",
    keyword: "responsive design",
    search_volume: 19200,
    difficulty: 68,
    cpc: 18.3,
    competition: 0.78,
    post_status: "Live",
    traffic_potential: "5.1k/mo",
  },
  {
    id: "5",
    keyword: "UI components",
    search_volume: 5600,
    difficulty: 45,
    cpc: 11.2,
    competition: 0.52,
    post_status: "Draft",
    traffic_potential: "2.3k/mo",
  },
  {
    id: "6",
    keyword: "CSS frameworks",
    search_volume: 14200,
    difficulty: 72,
    cpc: 14.9,
    competition: 0.81,
    post_status: "No Plan",
    traffic_potential: "3.5k/mo",
  },
  {
    id: "7",
    keyword: "web hosting",
    search_volume: 33400,
    difficulty: 78,
    cpc: 22.1,
    competition: 0.89,
    post_status: "Live",
    traffic_potential: "6.2k/mo",
  },
];

const MOCK_WEBSITE_DATA: WebsiteData = {
  website: {
    id: "demo-site",
    url: "www.dellars.pro",
    topic: "Web Development",
  },
  keywords: MOCK_KEYWORDS,
};

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
  const [generatingContent, setGeneratingContent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("volume-desc");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<number>>(
    new Set()
  );
  const toast = useToast();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: user, error } = await getUser();
        if (error) {
          console.error("Error fetching current user:", error);
          return;
        }
        setCurrentUser(user);
        console.log("👤 Current user:", user?.id);
      } catch (err) {
        console.error("Failed to get current user:", err);
      }
    };

    fetchCurrentUser();
  }, []);

  const loadUserWebsites = async () => {
    try {
      setLoadingWebsites(true);
      // TODO: Replace with real API when ready
      // const { data: { user } } = await supabase.auth.getUser();
      // if (!user) { setError("Please log in to view keywords"); return; }
      // const { data, error } = await supabase.from("websites")...

      // Using mock data for now
      const mockWebsites: Website[] = [
        {
          id: "demo-site",
          url: "www.dellars.pro",
          topic: "Web Development",
        },
      ];

      setWebsites(mockWebsites);
      if (!selectedWebsiteId) {
        setSelectedWebsiteId(mockWebsites[0].id);
      }
    } catch (error) {
      console.error("Error loading websites:", error);
      setError("Failed to load websites");
    } finally {
      setLoadingWebsites(false);
    }
  };

  useEffect(() => {
    if (!initialWebsiteId) {
      loadUserWebsites();
    } else {
      setSelectedWebsiteId(initialWebsiteId);
    }
  }, [initialWebsiteId]);

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
      console.log(`🔍 Fetching keywords for website: ${selectedWebsiteId}`);

      // TODO: Replace with real API when ready
      // const response = await fetch(`/api/keyword/${selectedWebsiteId}`);
      // const data = await response.json();

      // Using mock data for now
      const data = MOCK_WEBSITE_DATA;

      setWebsiteData(data);
      setKeywords(data.keywords || []);
      setSelectedKeywords(new Set());
      console.log(`✅ Total keywords loaded: ${data.keywords.length}`);
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
    if (!selectedKeywords || selectedKeywords.size === 0) {
      toast.showToast({
        title: "No keywords selected",
        description: "Please select at least one keyword to generate content.",
        type: "error",
      });
      return;
    }

    if (!currentUser) {
      toast.showToast({
        title: "Not logged in",
        description: "Please log in to generate content.",
        type: "error",
      });
      return;
    }

    if (!filteredAndSortedKeywords || filteredAndSortedKeywords.length === 0) {
      toast.showToast({
        title: "No keywords available",
        description: "No keywords available to generate content.",
        type: "error",
      });
      return;
    }

    try {
      setGeneratingContent(true);

      const selectedKeywordTexts = Array.from(selectedKeywords)
        .map((index) => filteredAndSortedKeywords[index]?.keyword)
        .filter(Boolean);

      if (selectedKeywordTexts.length === 0) {
        toast.showToast({
          title: "Invalid selection",
          description: "No valid keywords selected.",
          type: "error",
        });
        setGeneratingContent(false);
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

      toast.showToast({
        title: `Generated ${generatedArticles.length} articles`,
        description: `Successfully created content for ${selectedKeywordTexts.length} keywords! Check the Articles tab.`,
        type: "success",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error generating content:", error);
      toast.showToast({
        title: "Generation failed",
        description: "Please try again.",
        type: "error",
      });
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

  if (loadingWebsites) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin">
          <Image src="/loader.png" alt="Loading" width={92} height={92} />
        </div>
      </div>
    );
  }

  if (error && !selectedWebsiteId && websites.length === 0) {
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
          <p className="text-gray-600">Loading keywords...</p>
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
            onClick={exportKeywords}
          >
            Add Keywords
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-gray-500 border-gray-200 rounded-none hover:bg-gray-50"
            onClick={exportKeywords}
          >
            Import CSV
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-gray-500 border-gray-200 rounded-l-none hover:bg-gray-50"
          >
            Sync from Competitors
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex ml-5">
            <Select>
              <SelectTrigger className="w-38 h-9 border-gray-200">
                <SelectValue placeholder={websiteId || "www.delani.pro"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={websiteId || "www.delani.pro"}>
                  {websiteId || "www.delani.pro"}
                </SelectItem>
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
            <Image
            src="/stats1.svg"
            alt="icon"
            height={15}
            width={19.5}            
            />
            </div>
            <p className="text-4xl flex items-end font-bold  text-gray-900">
              7
            </p>
          </CardContent>
        </Card>

        <Card className="border rounded-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
              High Potential Keywords
            </p>
             <Image
            src="/stats2.svg"
            alt="icon"
            height={15}
            width={19.5}            
            />
            
            </div>
            <p className="text-4xl font-bold text-gray-900">
            3
            </p>
          </CardContent>
        </Card>

        <Card className="border rounded-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
              With Content
            </p>
             <Image
            src="/stats3.svg"
            alt="icon"
            height={15}
            width={19.5}            
            />

            </div>
            <p className="text-4xl font-bold text-gray-900">
            4
            </p>
          </CardContent>
        </Card>

        <Card className="border rounded-l-none border-gray-200 bg-white shadow-sm">
          <CardContent className="flex flex-col justify-start gap-8">
            <div className="flex justify-between">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide ">
              Without Content
            </p>
            <Image
            src="/stats4.svg"
            alt="icon"
            height={15}
            width={19.5}            
            />            </div>
            <p className="text-4xl font-bold text-gray-900">
            3
            </p>
          </CardContent>
        </Card>
      </div>
        <div className="flex justify-end">
          <Button className="px-6 cursor-pointer bg-gray-500">
            create post 
          </Button>
        </div>

      {/* Filters and Table */}
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardContent className="pt-6">
          {/* Filter Controls */}
          <div className="flex flex-col gap-4 mb-5">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <label className="text-xs font-medium text-gray-700 block mb-2">
                  Search Keywords
                </label>
                <Search className="absolute left-3 top-10 transform w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-200 h-9 text-sm"
                />
              </div>

              <div className="w-40">
                <label className="text-xs font-medium text-gray-700 block mb-2">
                  Difficulty
                </label>
                <Select
                  value={difficultyFilter}
                  onValueChange={setDifficultyFilter}
                >
                  <SelectTrigger className="w-full bg-white border-gray-200 h-9 text-sm">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-48">
                <label className="text-xs font-medium text-gray-700 block mb-2">
                  Sort by
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full bg-white border-gray-200 h-9 text-sm">
                    <SelectValue placeholder="Volume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume-desc">
                      Volume (High to Low)
                    </SelectItem>
                    <SelectItem value="volume-asc">
                      Volume (Low to High)
                    </SelectItem>
                    <SelectItem value="difficulty-asc">
                      Difficulty (Easy)
                    </SelectItem>
                    <SelectItem value="difficulty-desc">
                      Difficulty (Hard)
                    </SelectItem>
                    <SelectItem value="cpc-desc">CPC (High to Low)</SelectItem>
                    <SelectItem value="cpc-asc">CPC (Low to High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                className="gap-2 bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200 h-9"
              >
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedKeywords &&
                        selectedKeywords.size ===
                          filteredAndSortedKeywords.length &&
                        filteredAndSortedKeywords.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Keyword
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Search Volume
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Difficulty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Competition
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Post Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Traffic Potential
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedKeywords.map((keyword, index) => (
                  <tr
                    key={keyword.id || index}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selectedKeywords ? selectedKeywords.has(index) : false
                        }
                        onChange={() => toggleKeywordSelection(index)}
                        className="rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {keyword.keyword}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {keyword.search_volume.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`${getDifficultyColor(
                          keyword.difficulty
                        )} text-xs font-medium border`}
                      >
                        {getDifficultyText(keyword.difficulty)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`${getCompetitionColor(
                          keyword.competition
                        )} text-xs font-medium border`}
                      >
                        {getCompetitionText(keyword.competition)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`${getPostStatusColor(
                          keyword.post_status
                        )} text-xs font-medium border`}
                      >
                        {keyword.post_status || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">
                        {keyword.traffic_potential || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-gray-200 hover:bg-gray-100"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedKeywords.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No keywords found matching your filters.
            </div>
          )}

          {/* Selection Bar */}
          {selectedKeywords && selectedKeywords.size > 0 && (
            <div className="mt-5 flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-gray-900">
                {selectedKeywords.size} keyword
                {selectedKeywords.size !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-200 bg-white hover:bg-gray-50 text-sm"
                >
                  Add Keywords
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                  onClick={generateContentFromKeywords}
                  disabled={generatingContent}
                >
                  {generatingContent ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Create Post"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
