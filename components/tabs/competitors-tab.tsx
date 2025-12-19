// components/tabs/competitors-tab.tsx
"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { RefreshCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ExternalLink,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  Loader2,
  ChevronDown,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/client";
import Image from "next/image";
import { CreatePostDialog } from "@/components/ui/CreatePostDialog";

interface CompetitorsTabProps {
  websiteId: string | null;
}

interface Website {
  id: string;
  url: string;
  topic: string;
  created_at?: string;
}

interface Competitor {
  domain: string;
  topic?: string;
  success?: boolean;
  keywords?: any[];
  keywords_count?: number;
  error?: string | null;
  // Old format fields (for backward compatibility)
  avg_position?: number;
  common_keywords?: number;
  organic_traffic?: {
    total_keywords: number;
    top_3_positions: number;
    top_10_positions: number;
    estimated_traffic_value: number;
  };
  competitive_overlap?: number;
  serp_overlap_quality?: "High" | "Medium" | "Low";
}

interface WebsiteData {
  website: {
    id: string;
    url: string;
    topic: string;
  };
  competitors: Competitor[];
  metadata?: {
    totalCompetitors: number;
    analysisMetadata?: any;
  };
}

export function CompetitorsTab({ websiteId: initialWebsiteId }: CompetitorsTabProps) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    initialWebsiteId
  );
  const [websites, setWebsites] = useState<Website[]>([]);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [siteKeywords, setSiteKeywords] = useState<
    { keyword: string; volume?: number; difficulty?: string; sites?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingWebsites, setLoadingWebsites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("overlap-desc");
  const [showCreatePostDialog, setShowCreatePostDialog] = useState(false);
  const [createPostCompleted, setCreatePostCompleted] = useState(false);
  const [showAddCompetitorDialog, setShowAddCompetitorDialog] = useState(false);
  const [addCompetitorCompleted, setAddCompetitorCompleted] = useState(false);
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorTags, setCompetitorTags] = useState<string[]>([]);

  // Load user websites if no websiteId is provided
  const loadUserWebsites = async () => {
    try {
      setLoadingWebsites(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in to view competitors");
        return;
      }

      const { data, error } = await supabase
        .from("websites")
        .select("id, url, topic, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading websites:", error);
        setError("Failed to load websites");
        return;
      }

      if (data && data.length > 0) {
        setWebsites(data);
        // Auto-select first website if no websiteId was provided
        if (!selectedWebsiteId) {
          setSelectedWebsiteId(data[0].id);
        }
      } else {
        setError("No websites found. Add a website in the Analyze tab first.");
      }
    } catch (error) {
      console.error("Error loading websites:", error);
      setError("Failed to load websites");
    } finally {
      setLoadingWebsites(false);
    }
  };

  // Load websites on mount if no websiteId provided
  useEffect(() => {
    if (!initialWebsiteId) {
      loadUserWebsites();
    } else {
      setSelectedWebsiteId(initialWebsiteId);
    }
  }, [initialWebsiteId]);

  // Fetch competitors when selectedWebsiteId changes
  useEffect(() => {
    if (selectedWebsiteId) {
      fetchCompetitors();
    } else if (!loadingWebsites) {
      setLoading(false);
    }
  }, [selectedWebsiteId]);

  const fetchCompetitors = async (id?: string) => {
    const siteId = id || selectedWebsiteId;
    if (!siteId) return;

    try {
      setLoading(true);
      setError(null);
      console.log(`🔍 Fetching competitors for website: ${siteId}`);

      const response = await fetch(`/api/keyword/${siteId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch competitors");
      }

      // Extract competitors from the API response
      let competitorsData: Competitor[] = [];

      // Check for competitors in fullData (new format from onboarding)
      if (
        data.fullData &&
        data.fullData.competitors &&
        Array.isArray(data.fullData.competitors)
      ) {
        competitorsData = data.fullData.competitors;
        console.log(
          `✅ Loaded ${competitorsData.length} competitors from fullData`
        );
      } else if (data.metadata?.hasCompetitors) {
        console.log("⚠️ Metadata indicates competitors but fullData not found");
        competitorsData = [];
      }

      setWebsiteData({
        website: data.website,
        competitors: competitorsData,
        metadata: data.metadata,
      });
      setCompetitors(competitorsData);

      // Extract site keywords/opportunities if present in fullData
      let extractedKeywords: any[] = [];
      if (data.fullData) {
        if (Array.isArray(data.fullData.site_keywords)) {
          extractedKeywords = data.fullData.site_keywords;
        } else if (Array.isArray(data.fullData.keywords)) {
          extractedKeywords = data.fullData.keywords;
        } else if (Array.isArray(data.fullData.opportunities)) {
          extractedKeywords = data.fullData.opportunities;
        } else if (Array.isArray(data.fullData.top_keywords)) {
          extractedKeywords = data.fullData.top_keywords;
        }
      }

      const normalized = extractedKeywords.map((k: any) => ({
        keyword: k.keyword || k.key || k.name || String(k),
        volume: k.volume || k.search_volume || k.searchVolume || undefined,
        difficulty: k.difficulty || k.difficulty_level || k.difficultyLevel || "N/A",
        sites: k.sites || k.sites_count || k.competition || "N/A",
      }));

      setSiteKeywords(normalized);

      console.log(`✅ Total competitors loaded: ${competitorsData.length}`);
    } catch (err) {
      console.error("Error fetching competitors:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load competitors"
      );
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if competitor is in new format (from onboarding)
  const isNewFormat = (competitor: Competitor | undefined): boolean => {
    if (!competitor) return false; // Handle undefined/null
    return (
      competitor.keywords_count !== undefined ||
      (competitor.keywords !== undefined && competitor.topic !== undefined)
    );
  };

  // Helper function to get display values for new format
  const getCompetitorDisplayData = (competitor: Competitor) => {
    if (isNewFormat(competitor)) {
      // New format: show topic, keywords count, and keywords list
      return {
        domain: competitor.domain,
        topic: competitor.topic || "Unknown",
        keywordsCount:
          competitor.keywords_count || competitor.keywords?.length || 0,
        keywords: competitor.keywords || [],
        success: competitor.success !== false,
        error: competitor.error,
      };
    } else {
      // Old format: use existing fields
      return {
        domain: competitor.domain,
        topic: "N/A",
        keywordsCount:
          competitor.organic_traffic?.total_keywords ||
          competitor.common_keywords ||
          0,
        keywords: [],
        success: true,
        error: null,
        avgPosition: competitor.avg_position,
        commonKeywords: competitor.common_keywords,
        organicTraffic: competitor.organic_traffic,
        competitiveOverlap: competitor.competitive_overlap,
        serpOverlapQuality: competitor.serp_overlap_quality,
      };
    }
  };

  const filteredAndSortedCompetitors = competitors
    .filter((competitor) => {
      const displayData = getCompetitorDisplayData(competitor);
      const matchesSearch = displayData.domain
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      if (isNewFormat(competitor)) {
        // For new format, filter by topic or domain
        const matchesTopic = displayData.topic
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        return matchesSearch || matchesTopic;
      } else {
        // For old format, use existing quality filter
        return (
          matchesSearch &&
          (qualityFilter === "all" ||
            competitor.serp_overlap_quality === qualityFilter)
        );
      }
    })
    .sort((a, b) => {
      const aData = getCompetitorDisplayData(a);
      const bData = getCompetitorDisplayData(b);

      if (isNewFormat(a) && isNewFormat(b)) {
        // Sort new format by keywords count
        switch (sortBy) {
          case "overlap-desc":
            return bData.keywordsCount - aData.keywordsCount;
          case "overlap-asc":
            return aData.keywordsCount - bData.keywordsCount;
          default:
            return 0;
        }
      } else {
        // Use existing sort logic for old format
        switch (sortBy) {
          case "overlap-desc":
            return (b.common_keywords || 0) - (a.common_keywords || 0);
          case "overlap-asc":
            return (a.common_keywords || 0) - (b.common_keywords || 0);
          case "position-asc":
            return (a.avg_position || 0) - (b.avg_position || 0);
          case "position-desc":
            return (b.avg_position || 0) - (a.avg_position || 0);
          case "traffic-desc":
            return (
              (b.organic_traffic?.estimated_traffic_value || 0) -
              (a.organic_traffic?.estimated_traffic_value || 0)
            );
          case "traffic-asc":
            return (
              (a.organic_traffic?.estimated_traffic_value || 0) -
              (b.organic_traffic?.estimated_traffic_value || 0)
            );
          default:
            return 0;
        }
      }
    });

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "High":
        return "bg-green-100 text-green-700 border-green-200";
      case "Medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Low":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getPositionColor = (position: number) => {
    if (position <= 10) return "text-green-600";
    if (position <= 30) return "text-yellow-600";
    return "text-red-600";
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatCurrency = (num: number) => {
    if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return "$" + (num / 1000).toFixed(1) + "K";
    return "$" + num.toString();
  };

  const stats = {
    totalCompetitors: competitors.length,
    avgOverlap:
      competitors.length > 0 && isNewFormat(competitors[0])
        ? Math.round(
            competitors.reduce(
              (sum, c) => sum + (c.keywords_count || c.keywords?.length || 0),
              0
            ) / Math.max(competitors.length, 1)
          )
        : Math.round(
            competitors.reduce((sum, c) => sum + (c.common_keywords || 0), 0) /
              Math.max(competitors.length, 1)
          ),
    avgPosition:
      competitors.length > 0 && isNewFormat(competitors[0])
        ? "N/A"
        : (
            competitors.reduce((sum, c) => sum + (c.avg_position || 0), 0) /
            Math.max(competitors.length, 1)
          ).toFixed(1),
    highQualityCount: competitors.filter(
      (c) => !isNewFormat(c) && c.serp_overlap_quality === "High"
    ).length,
  };

  const handleCreatePost = () => {
    setShowCreatePostDialog(true);
    setCreatePostCompleted(false);
    // Simulate post creation
    setTimeout(() => {
      setCreatePostCompleted(true);
    }, 2000);
  };

  const handleAddCompetitor = () => {
    setShowAddCompetitorDialog(true);
    setAddCompetitorCompleted(false);
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

  const toggleCompetitorTag = (tag: string) => {
    setCompetitorTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (loadingWebsites) {
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

  if (error && !selectedWebsiteId && websites.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-destructive mb-4">{error}</p>
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
          <div className="animate-spin">
            <Image src="/loader.png" alt="" width={92} height={92} />
          </div>
          <p className="text-muted-foreground">Loading competitors...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchCompetitors} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // If no websiteData or no competitors, continue rendering the main
  // competitors UI but with empty lists. This lets the tab open and show
  // a simple empty state within the normal layout instead of blocking
  // navigation with an early return.

  return (
    <div className="space-y-6 p-6">
      {/* Main Competitors Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div>
            <h2 className="text-2xl text-gray-700 font-medium">Competitors</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track and compare your competitors
            </p>
          </div>

          {/* Right side */}
          <div className="flex ">
            {/* Add Competitors */}
            <Button
              onClick={handleAddCompetitor}
              variant="outline"
              className="gap-2 text-gray-500 border-gray-200 rounded-r-none hover:bg-gray-50"
            >
              Add Competitors
              <Plus />
            </Button>

            {/* Sync */}
            <Button
              variant="outline"
              className="gap-2 text-gray-500 border-gray-200 rounded-l-none hover:bg-gray-50"
            >
              Sync Keywords
              <RefreshCcw />
            </Button>

            {/* Website */}
            <div className="flex ml-5">
              <Select
                value={selectedWebsiteId ?? undefined}
                onValueChange={(val) => setSelectedWebsiteId(val)}
              >
                <SelectTrigger className="w-48 h-9 border-gray-200">
                  <SelectValue
                    placeholder={
                      websiteData?.website?.url || websites[0]?.url || "Select website"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {websites && websites.length > 0 ? (
                    websites.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.url}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-websites" disabled>
                      No websites
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats Cards - 4 Column Grid */}
        <div className="grid grid-cols-4">
          {/* Card 1 */}
          <Card className="border rounded-r-none border-gray-200 bg-white shadow-sm">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Total Competitors
                </p>
                <Image src="/stats1.svg" alt="icon" height={15} width={19.5} />
              </div>
              <p className="text-4xl font-bold text-gray-900">
                {stats.totalCompetitors}
              </p>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="border rounded-none border-gray-200 bg-white shadow-sm">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Shared Keywords
                </p>
                <Image src="/stats2.svg" alt="icon" height={15} width={19.5} />
              </div>
              <p className="text-4xl font-bold text-gray-900">
                {formatNumber(stats.avgOverlap)}
              </p>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="border rounded-none border-gray-200 bg-white shadow-sm">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Keyword Gaps
                </p>
                <Image src="/stats3.svg" alt="icon" height={15} width={19.5} />
              </div>
              <p className="text-4xl font-bold text-gray-900">9</p>
            </CardContent>
          </Card>

          {/* Card 4 */}
          <Card className="border rounded-l-none border-gray-200 bg-white shadow-sm">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  High Value Gaps
                </p>
                <Image src="/stats4.svg" alt="icon" height={15} width={19.5} />
              </div>
              <p className="text-4xl font-bold text-gray-900">4</p>
            </CardContent>
          </Card>
        </div>

        {/* Best Keyword Opportunities Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse">
            {/* ================= HEADER ================= */}
            <thead>
              <tr className="border-b border-gray-200 bg-white">
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
                  Competing Sites
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            {/* ================= BODY ================= */}
            <tbody>
              {siteKeywords && siteKeywords.length > 0 ? (
                siteKeywords.map((row, index) => (
                  <tr key={row.keyword + index} className={`${index !== siteKeywords.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.keyword}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{row.volume ? row.volume.toLocaleString() : "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500"><span className="px-2 py-0.5 text-xs">{row.difficulty}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500"><span className="px-2 py-0.5 text-xs">{row.sites}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button variant="outline" className="border rounded-r-none bg-transparent border-gray-200 rounded-l-md px-6 h-8 text-xs">View</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="border border-l-0 rounded-l-none bg-transparent border-gray-200 rounded-r-md w-8 h-8 p-0 flex items-center justify-center hover:bg-gray-50"><ChevronDown className="w-4 h-4 text-gray-600" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32"><DropdownMenuItem className="text-red-600 cursor-pointer">Delete</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">No keyword opportunities found for this website</td>
                </tr>
              )}
              <tr>
                <td colSpan={5} className="bg-white">
                  <div className="mt-6 flex justify-end mr-4">
                    <Button className="bg-[#171717] px-6 hover:bg-gray-500">Create post</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Competitor Overview Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full border-collapse">
            {/* ================= HEADER ================= */}
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Competitor
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Primary Topic
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Shared Keywords
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Unique Keywords
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  High Value Keywords
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Last Seen
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

    {/* ================= BODY ================= */}
    <tbody>
      {filteredAndSortedCompetitors.map((comp, idx) => {
        const d = getCompetitorDisplayData(comp);
        const lastSeen = comp && (comp.generatedAt || comp.organic_traffic?.last_seen || "-");
        const shared = d.keywordsCount || comp.common_keywords || 0;
        const unique = Math.max(0, (comp.organic_traffic?.total_keywords || 0) - shared);
        const highValue = 0;

        return (
          <tr key={d.domain + idx} className={`${idx !== filteredAndSortedCompetitors.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50`}>
            <td className="px-4 py-3 text-sm text-gray-700 font-medium">
              <div className="flex items-center gap-3">
                <img src={`https://ui-avatars.com/api/?name=${d.domain}&background=random&color=fff&bold=true&size=32`} alt={d.domain} className="w-5 h-5 rounded-full" />
                {d.domain}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-700">{d.topic}</td>
            <td className="px-4 py-3 text-sm text-gray-500">{shared}</td>
            <td className="px-4 py-3 text-sm text-gray-500">{unique}</td>
            <td className="px-4 py-3 text-sm text-gray-500">{highValue}</td>
            <td className="px-4 py-3 text-sm text-gray-500">{lastSeen || "-"}</td>
            <td className="px-4 py-3">
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border bg-transparent border-gray-200 h-8 px-3 text-xs flex items-center gap-1">Visit<ChevronDown className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => window.open(`https://${d.domain}`, "_blank")}>
                      Visit Website
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
      </div>

      {/* Create Post Dialog */}
      <CreatePostDialog
        isOpen={showCreatePostDialog}
        isLoading={createPostCompleted}
        onClose={() => {
          setShowCreatePostDialog(false);
          setCreatePostCompleted(false);
        }}
        onConfirm={() => setShowCreatePostDialog(false)}
      />

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
              <ChevronDown className="w-5 h-5 rotate-180" />
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
    </div>
  );
}
