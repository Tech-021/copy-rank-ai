// components/tabs/competitors-tab.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X } from "lucide-react";
import { LoaderChevron } from "@/components/ui/LoaderChevron";
import { RefreshCcw } from "lucide-react";
import { Check } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import Image from "next/image";
import { CreatePostDialog } from "@/components/ui/CreatePostDialog";
import { CreatePostDialogDashboard } from "../dialog2";

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
  generatedAt?: string;
  // Old format fields (for backward compatibility)
  avg_position?: number;
  common_keywords?: number;
  organic_traffic?: {
    total_keywords: number;
    top_3_positions: number;
    top_10_positions: number;
    estimated_traffic_value: number;
    last_seen?: string;
  };
  competitive_overlap?: number;
  serp_overlap_quality?: "High" | "Medium" | "Low";
}

interface AnalyticsData {
  articlesGenerated: number;
  articlesLive: number;
  estimatedTraffic: number;
  keywordsTracked: number;
  draftArticles: number;
  totalCompetitors: number;
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

type CompetitorsCache = {
  website: WebsiteData["website"];
  competitors: Competitor[];
  metadata?: WebsiteData["metadata"];
  competitorsUpdatedAt: string | null;
};

const selectedWebsiteStorageKey = "selected-website-id";

const websitesStorageKey = (userId: string) => `websites-cache:${userId}`;

const readSelectedWebsiteId = () => {
  try {
    return localStorage.getItem(selectedWebsiteStorageKey);
  } catch {
    return null;
  }
};

const writeSelectedWebsiteId = (websiteId: string) => {
  try {
    localStorage.setItem(selectedWebsiteStorageKey, websiteId);
  } catch {
    // ignore storage failures
  }
};

type WebsitesCache = {
  websites: Website[];
  cachedAt: string;
};

const readWebsitesCache = (userId: string): WebsitesCache | null => {
  try {
    const raw = localStorage.getItem(websitesStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WebsitesCache;
    if (!parsed?.websites || !Array.isArray(parsed.websites)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeWebsitesCache = (userId: string, websites: Website[]) => {
  try {
    localStorage.setItem(
      websitesStorageKey(userId),
      JSON.stringify({ websites, cachedAt: new Date().toISOString() } as WebsitesCache)
    );
  } catch {
    // ignore storage failures
  }
};

const competitorsCacheKey = (websiteId: string) =>
  `competitors-cache:${websiteId}`;

const readCompetitorsCache = (websiteId: string): CompetitorsCache | null => {
  try {
    const raw = localStorage.getItem(competitorsCacheKey(websiteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompetitorsCache;
    if (!parsed?.website || !Array.isArray(parsed.competitors)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCompetitorsCache = (websiteId: string, value: CompetitorsCache) => {
  try {
    sessionStorage.setItem(
      competitorsCacheKey(websiteId),
      JSON.stringify(value)
    );
    localStorage.setItem(competitorsCacheKey(websiteId), JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

export function CompetitorsTab({
  websiteId: initialWebsiteId,
}: CompetitorsTabProps) {
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
  const [selectedKeywords, setSelectedKeywords] = useState<Set<number>>(
    new Set()
  );

  // Prevent stale async requests from overwriting UI after website switch
  const selectedWebsiteIdRef = useRef<string | null>(selectedWebsiteId);
  const websitesRef = useRef<Website[]>(websites);
  const fetchCompetitorsSeqRef = useRef(0);
  const loadWebsitesSeqRef = useRef(0);

  useEffect(() => {
    selectedWebsiteIdRef.current = selectedWebsiteId;
  }, [selectedWebsiteId]);

  useEffect(() => {
    websitesRef.current = websites;
  }, [websites]);

  // Load user websites (session-first so dropdown renders instantly after first load)
  const loadUserWebsites = useCallback(async () => {
    const seq = ++loadWebsitesSeqRef.current;
    const isCurrent = () => loadWebsitesSeqRef.current === seq;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isCurrent()) setError("Please log in to view competitors");
        return;
      }

      // Session-first: hydrate dropdown immediately.
      const cached = readWebsitesCache(user.id);
      if (cached && websitesRef.current.length === 0) {
        if (isCurrent()) setWebsites(cached.websites);

        if (!selectedWebsiteIdRef.current && cached.websites.length > 0) {
          const stored = readSelectedWebsiteId();
          const nextId =
            stored && cached.websites.some((w) => w.id === stored)
              ? stored
              : cached.websites[0].id;
          if (isCurrent()) setSelectedWebsiteId(nextId);
          writeSelectedWebsiteId(nextId);
        }
      }

      // Only show websites loader if nothing cached to render.
      if ((!cached || websitesRef.current.length === 0) && isCurrent()) {
        setLoadingWebsites(true);
      }

      const { data, error } = await supabase
        .from("websites")
        .select("id, url, topic, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading websites:", error);
        if (isCurrent()) setError("Failed to load websites");
        return;
      }

      const list: Website[] = (data || []).map((w: any) => ({
        id: w.id,
        url: w.url,
        topic: w.topic || "General",
        created_at: w.created_at,
      }));

      writeWebsitesCache(user.id, list);

      if (!isCurrent()) return;

      setWebsites(list);

      if (list.length === 0) {
        setError("No websites found. Add a website in the Analyze tab first.");
        return;
      }

      setError(null);

      // Auto-select only if nothing selected yet (don't override a selection)
      if (!selectedWebsiteIdRef.current) {
        const stored = readSelectedWebsiteId();
        const nextId = stored && list.some((w) => w.id === stored) ? stored : list[0].id;
        setSelectedWebsiteId(nextId);
        writeSelectedWebsiteId(nextId);
      }
    } catch (error) {
      console.error("Error loading websites:", error);
      if (isCurrent()) setError("Failed to load websites");
    } finally {
      if (isCurrent()) setLoadingWebsites(false);
    }
  }, []);

  // Load websites on mount if no websiteId provided
  useEffect(() => {
    if (initialWebsiteId) {
      setSelectedWebsiteId(initialWebsiteId);
      writeSelectedWebsiteId(initialWebsiteId);
    }

    // Always load the websites list for the dropdown (and to keep cache fresh)
    loadUserWebsites();
  }, [initialWebsiteId, loadUserWebsites]);

  const fetchCompetitors = useCallback(async (id?: string) => {
    const siteId = id || selectedWebsiteId;
    if (!siteId) return;

    const requestSiteId = siteId;
    const requestSeq = ++fetchCompetitorsSeqRef.current;
    const isCurrent = () =>
      fetchCompetitorsSeqRef.current === requestSeq &&
      selectedWebsiteIdRef.current === requestSiteId;

    try {
      if (isCurrent()) setError(null);
      console.log(`🔍 Fetching competitors for website: ${siteId}`);

      // 1) Render instantly from session cache (no spinner)
      const cached = readCompetitorsCache(requestSiteId);
      if (cached) {
        if (isCurrent()) {
          setWebsiteData({
            website: cached.website,
            competitors: cached.competitors,
            metadata: cached.metadata,
          });
          setCompetitors(cached.competitors);
          setLoading(false);
        }
      } else {
        // No cache => keep existing behavior (spinner while first loading)
        if (isCurrent()) {
          // Avoid showing stale competitors from previous website while loading
          setWebsiteData(null);
          setCompetitors([]);
          setSiteKeywords([]);
          setSelectedKeywords(new Set());
          setLoading(true);
        }
      }

      const response = await fetch(`/api/keyword/${siteId}`);
      // 1.5) Cheap DB version check (no loader, no API fetch if unchanged)
      if (cached) {
        const cachedUpdatedAt: string | null = cached?.competitorsUpdatedAt ?? null;
        if (cachedUpdatedAt) {
          const { data: versionRow, error: versionErr } = await supabase
            .from("websites")
            .select("competitors_updated_at")
            .eq("id", requestSiteId)
            .single();

          if (!versionErr) {
            const dbUpdatedAt: string | null = (versionRow as any)?.competitors_updated_at ?? null;
            if (dbUpdatedAt && dbUpdatedAt === cachedUpdatedAt) {
              return;
            }

            // DB changed and we had cache => show spinner for the refresh
            if (isCurrent()) setLoading(true);
          }
        }
      }

      const response = await fetch(`/api/keyword/${requestSiteId}`);
      

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch competitors");
      }

      // 2) If DB competitors didn't change, keep cached UI and exit
      const dbUpdatedAt: string | null =
        data?.versions?.competitors_updated_at ?? null;
      const cachedUpdatedAt: string | null =
        cached?.competitorsUpdatedAt ?? null;
      if (
        cached &&
        dbUpdatedAt &&
        cachedUpdatedAt &&
        dbUpdatedAt === cachedUpdatedAt
      ) {
        return;
      }

      // DB changed (or no cache/version) => show spinner for the update
      if (cached) {
        if (isCurrent()) setLoading(true);
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

      if (isCurrent()) {
        setWebsiteData({
          website: data.website,
          competitors: competitorsData,
          metadata: data.metadata,
        });
        setCompetitors(competitorsData);
      }

      // 3) Update session cache so next visit is instant
      writeCompetitorsCache(requestSiteId, {
        website: data.website,
        competitors: competitorsData,
        metadata: data.metadata,
        competitorsUpdatedAt: dbUpdatedAt,
      });

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
        difficulty:
          k.difficulty || k.difficulty_level || k.difficultyLevel || "N/A",
        sites: k.sites || k.sites_count || k.competition || "N/A",
      }));

      if (isCurrent()) setSiteKeywords(normalized);

      console.log(`✅ Total competitors loaded: ${competitorsData.length}`);
    } catch (err) {
      console.error("Error fetching competitors:", err);
      if (isCurrent()) {
        setError(err instanceof Error ? err.message : "Failed to load competitors");
      }
    } finally {
      if (fetchCompetitorsSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [selectedWebsiteId]);

  // Fetch competitors when selectedWebsiteId changes
  useEffect(() => {
    if (selectedWebsiteId) {
      fetchCompetitors();
    } else if (!loadingWebsites) {
      setLoading(false);
    }
  }, [selectedWebsiteId, loadingWebsites, fetchCompetitors]);

  // Keep caches fresh automatically when the DB changes
  useEffect(() => {
    let channel: any;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`websites-changes:${user.id}:competitors`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "websites",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // 1) Update dropdown list + session cache
            loadUserWebsites();

            // 2) If current site changed, refresh competitors (loader only if DB version changed)
            const changedId = (payload as any)?.new?.id ?? (payload as any)?.old?.id;
            if (changedId && selectedWebsiteIdRef.current === changedId) {
              fetchCompetitors(changedId);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore cleanup failures
        }
      }
    };
  }, [loadUserWebsites, fetchCompetitors]);

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

  const getCompetitorsCount = (keywordsData: any): number => {
    if (!keywordsData) return 0;
    if (keywordsData.competitors && Array.isArray(keywordsData.competitors)) {
      return keywordsData.competitors.length;
    }
    return 0;
  };

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    articlesGenerated: 0,
    articlesLive: 0,
    estimatedTraffic: 0,
    keywordsTracked: 0,
    draftArticles: 0,
    totalCompetitors: 0,
  });

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
    writeSelectedWebsiteId(websiteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await fetchAnalytics(user.id, websiteId);
    }
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
    if (!selectedKeywords || selectedKeywords.size === 0) {
      return;
    }
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

  const toggleKeywordSelection = (index: number) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedKeywords(newSelected);
  };

  const toggleSelectAllKeywords = () => {
    if (siteKeywords && siteKeywords.length > 0) {
      if (selectedKeywords.size === siteKeywords.length) {
        setSelectedKeywords(new Set());
      } else {
        setSelectedKeywords(new Set(siteKeywords.map((_, index) => index)));
      }
    }
  };

  const handleAddCompetitorSubmit = () => {
    (async () => {
      try {
        const toAdd: string[] = [];
        if (competitorInput.trim()) {
          toAdd.push(
            ...competitorInput
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          );
        }
        if (competitorTags.length > 0) {
          toAdd.push(...competitorTags.map((t) => t.trim()).filter(Boolean));
        }

        if (toAdd.length === 0) {
          // nothing to add - show completed UI briefly
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
          initialWebsiteId ||
          (websites && websites.length > 0 ? websites[0].id : undefined);
        if (!siteId) {
          // fallback: try to load websites to allow selection
          await loadUserWebsites();
          return;
        }

        const success = await persistCompetitorsToWebsite(siteId, toAdd);
        if (success) {
          setAddCompetitorCompleted(true);
          // refresh competitors for site
          await fetchCompetitors(siteId);
          setTimeout(() => {
            setShowAddCompetitorDialog(false);
            setAddCompetitorCompleted(false);
            setCompetitorInput("");
            setCompetitorTags([]);
          }, 1200);
        } else {
          // show simple failure flow (close dialog)
          setAddCompetitorCompleted(false);
          setShowAddCompetitorDialog(false);
        }
      } catch (err) {
        console.error("Error adding competitor:", err);
        setShowAddCompetitorDialog(false);
      }
    })();
  };

  // Persist competitor domains into the website.keywords.competitors array
  const persistCompetitorsToWebsite = async (
    siteId: string,
    domains: string[]
  ) => {
    try {
      // fetch current website keywords payload
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
      // add existing
      existingList.forEach((c) => {
        const key = String(c.domain || "").toLowerCase();
        if (key) map.set(key, c);
      });

      // add new domains
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

      return true;
    } catch (e) {
      console.error("Error persisting competitors:", e);
      return false;
    }
  };

  const toggleCompetitorTag = (tag: string) => {
    setCompetitorTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toast = useToast();

  const removeCompetitorFromWebsite = async (
    siteId: string | undefined,
    domain: string
  ) => {
    try {
      if (!siteId) {
        toast.showToast({
          title: "No website selected",
          description: "Please select a website first.",
          type: "error",
        });
        return;
      }

      const confirmed = window.confirm(
        `Remove competitor ${domain}? This will delete it from the website record.`
      );
      if (!confirmed) return;

      const { data: siteData, error: siteErr } = await supabase
        .from("websites")
        .select("id, keywords")
        .eq("id", siteId)
        .single();

      if (siteErr) throw siteErr;

      const existingPayload = (siteData as any)?.keywords || {};
      const existingList: any[] = Array.isArray(existingPayload?.competitors)
        ? existingPayload.competitors
        : [];

      const filtered = existingList.filter(
        (c) => String(c.domain || "").toLowerCase() !== domain.toLowerCase()
      );

      const newPayload = {
        ...existingPayload,
        competitors: filtered,
        analysis_metadata: {
          ...existingPayload.analysis_metadata,
          totalCompetitors: filtered.length,
          analyzed_at: new Date().toISOString(),
        },
      };

      const { error: updateErr } = await supabase
        .from("websites")
        .update({ keywords: newPayload })
        .eq("id", siteId);

      if (updateErr) throw updateErr;

      toast.showToast({
        title: "Removed",
        description: `${domain} removed from competitors.`,
        type: "success",
      });
      await fetchCompetitors(siteId);
    } catch (err) {
      console.error("Error removing competitor:", err);
      toast.showToast({
        title: "Delete Failed",
        description:
          err instanceof Error ? err.message : "Failed to remove competitor",
        type: "error",
      });
    }
  };

  const removeKeywordFromWebsite = async (
    siteId: string | undefined,
    keyword: string
  ) => {
    try {
      if (!siteId) {
        toast.showToast({
          title: "No website selected",
          description: "Please select a website first.",
          type: "error",
        });
        return;
      }

      const confirmed = window.confirm(
        `Remove keyword "${keyword}"? This will delete it from the website record.`
      );
      if (!confirmed) return;

      const { data: siteData, error: siteErr } = await supabase
        .from("websites")
        .select("id, keywords")
        .eq("id", siteId)
        .single();

      if (siteErr) throw siteErr;

      const existingPayload = (siteData as any)?.keywords || {};

      const triedKeys = [
        "site_keywords",
        "keywords",
        "opportunities",
        "top_keywords",
      ];
      let mutated = false;

      const newPayload = { ...existingPayload };

      for (const key of triedKeys) {
        const arr = existingPayload?.[key];
        if (!Array.isArray(arr)) continue;

        const filtered = arr.filter((item: any) => {
          if (typeof item === "string")
            return String(item).toLowerCase() !== keyword.toLowerCase();
          if (item && typeof item === "object") {
            const cand = item.keyword || item.key || item.name || String(item);
            return String(cand).toLowerCase() !== keyword.toLowerCase();
          }
          return true;
        });

        if (filtered.length !== arr.length) {
          newPayload[key] = filtered;
          mutated = true;
        }
      }

      if (!mutated) {
        toast.showToast({
          title: "Not found",
          description: `Keyword \"${keyword}\" not present in stored payload.`,
          type: "error",
        });
        return;
      }
      const { error: updateErr } = await supabase
        .from("websites")
        .update({ keywords: newPayload })
        .eq("id", siteId);

      if (updateErr) throw updateErr;

      toast.showToast({
        title: "Removed",
        description: `Keyword \"${keyword}\" removed.`,
        type: "success",
      });
      await fetchCompetitors(siteId);
    } catch (err) {
      console.error("Error removing keyword:", err);
      toast.showToast({
        title: "Delete Failed",
        description:
          err instanceof Error ? err.message : "Failed to remove keyword",
        type: "error",
      });
    }
  };

  if (loadingWebsites && websites.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoaderChevron />
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
        <LoaderChevron />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => fetchCompetitors()} variant="outline">
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
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Main Competitors Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
          {/* Left side */}
          <div>
            <h2 className="text-lg sm:text-2xl text-white font-medium">
              Competitors
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Track and compare your competitors
            </p>
          </div>

          {/* Right side */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
            {/* Add Competitors and Sync - Stack on mobile */}
            <div className="flex flex-row sm:flex-row sm:gap-0 flex-1 sm:flex-none">
              <Button
                onClick={handleAddCompetitor}
                variant="outline"
                className="gap-2 text-[#53F870] border border-gray-800!  rounded-r-none sm:rounded-r-none cursor-pointer bg-[rgba(83,248,112,0.1)]! hover:text-gray-500 hover:bg-[rgba(83,248,112,0.2)] text-xs sm:text-sm"
              >
                Add Competitors
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>

              <Button
                variant="outline"
                className="gap-2 text-[#53F870] border hover:text-gray-500 border-gray-800! lg:rounded-l-none sm:rounded-l-none cursor-pointer bg-[rgba(83,248,112,0.1)]! rounded-none rounded-r-lg hover:bg-[rgba(83,248,112,0.2)] text-xs sm:text-sm"
                onClick={async () => {
                  const fallbackId =
                    initialWebsiteId ||
                    selectedWebsiteId ||
                    (websites && websites.length > 0
                      ? websites[0].id
                      : undefined);
                  if (!fallbackId) {
                    await loadUserWebsites();
                    return;
                  }
                  await fetchCompetitors(fallbackId);
                }}
              >
                Sync Keywords
                <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>

            {/* Website Select */}
            <div className="flex-1 sm:flex-none sm:ml-2">
              <Select
                value={selectedWebsiteId || undefined}
                onValueChange={handleWebsiteChange}
              >
                <SelectTrigger className="h-9 sm:h-10 bg-[rgba(83,248,112,0.1)]! rounded-[5px] focus-visible:outline-none focus-visible:ring-0 border-[#0000001a] focus-visible:border-[#0000001a] focus:outline-none cursor-pointer outline-none active:outline-none px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-[#53F870] text-xs sm:text-sm">
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
        </div>

        {/* Stats Cards - 4 Column Grid */}
        <div className=" grid grid-cols-2  sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-xl shadow-xl overflow-hidden">
          {/* Card 1 */}
          <Card className="border-b sm:border-b sm:border-r lg:border-r lg:border-b-0 border-l-0 border-t-0 rounded-none border-[#53f8704b] bg-[#101110]">
            <CardContent className="flex flex-col justify-start gap-4 sm:gap-8">
              <div className="flex justify-between">
                <p className="text-xs sm:text-xs font-medium text-white tracking-wide">
                  Total Competitors
                </p>
                <Image src="/compdark1.png" alt="icon" height={24} width={24} />
              </div>
              <p className="text-2xl sm:text-4xl font-bold text-[#53F870]">
                {stats.totalCompetitors}
              </p>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="border-b sm:border-b lg:border-b-0 border-l-0 border-t-0 border-r-0 sm:border-r-0 lg:border-r rounded-none border-[#53f8704b] bg-[#101110]">
            <CardContent className="flex flex-col justify-start gap-4 sm:gap-8">
              <div className="flex justify-between">
                <p className="text-xs sm:text-xs font-medium text-white tracking-wide">
                  Shared Keywords
                </p>
                <Image src="/compdark2.png" alt="icon" height={24} width={24} />
              </div>
              <p className="text-2xl sm:text-4xl font-bold text-[#53F870]">
                {formatNumber(stats.avgOverlap)}
              </p>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="border-b-0 sm:border-b sm:border-r lg:border-r lg:border-b-0 border-l-0 border-t-0 rounded-none border-r-[#53f8704b] bg-[#101110]">
            <CardContent className="flex flex-col justify-start gap-4 sm:gap-8">
              <div className="flex justify-between">
                <p className="text-xs sm:text-xs font-medium text-white tracking-wide">
                  Keyword Gaps
                </p>
                <Image src="/compdark3.png" alt="icon" height={24} width={24} />
              </div>
              <p className="text-2xl sm:text-4xl font-bold text-[#53F870]">9</p>
            </CardContent>
          </Card>

          {/* Card 4 */}
          <Card className="border-b-0 sm:border-b lg:border-b-0 border-l-0 border-t-0 border-r-0 lg:border-r-0 rounded-none border-[#53f8704b] bg-[#101110]">
            <CardContent className="flex flex-col justify-start gap-4 sm:gap-8">
              <div className="flex justify-between">
                <p className="text-xs sm:text-xs font-medium text-white tracking-wide">
                  High Value Gaps
                </p>
                <Image src="/compdark4.png" alt="icon" height={30} width={30} />
              </div>
              <p className="text-2xl sm:text-4xl font-bold text-[#53F870]">4</p>
            </CardContent>
          </Card>
        </div>
        {/* Best Keyword Opportunities Table */}
        <div className="bg-black rounded-xl border border-gray-700 overflow-x-auto">
          <h4 className="text-xs sm:text-sm text-white p-3 sm:p-4">
            Best Keyword Opportunities
          </h4>
          <table className="w-full border-collapse min-w-full">
            {/* ================= HEADER ================= */}
            <thead>
              <tr className="border-b border-gray-800 bg-black">
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left w-10">
                  <input
                    type="checkbox"
                    checked={
                      siteKeywords &&
                      siteKeywords.length > 0 &&
                      selectedKeywords.size === siteKeywords.length
                    }
                    onChange={toggleSelectAllKeywords}
                    aria-label="Select all keywords"
                    className="w-4 h-4 rounded border border-gray-600 bg-transparent cursor-pointer accent-[#53F870]"
                  />
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  Keyword
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">
                  Search Volume
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">
                  Difficulty
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">
                  Competing Sites
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            {/* ================= BODY ================= */}
            <tbody>
              {siteKeywords && siteKeywords.length > 0 ? (
                siteKeywords.map((row, index) => (
                  <tr
                    key={row.keyword + index}
                    className={`${
                      index !== siteKeywords.length - 1
                        ? "border-b border-gray-700"
                        : ""
                    } hover:bg-transparent`}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedKeywords.has(index)}
                        onChange={() => toggleKeywordSelection(index)}
                        aria-label={`Select keyword ${row.keyword}`}
                        className="w-4 h-4 rounded border border-gray-600 bg-transparent cursor-pointer accent-[#53F870]"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#53F870]">
                      {row.keyword}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                      {row.volume ? row.volume.toLocaleString() : "-"}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                      <span className="px-2 py-0.5 text-xs">
                        {row.difficulty}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs text-gray-500 hidden lg:table-cell">
                      <span className="px-2 py-0.5 text-xs">{row.sites}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex justify-start ">
                        <Button className="border rounded-r-none bg-transparent hover:text-[#53f870] hover:!bg-[#53f8701a] text-gray-300 cursor-pointer border-gray-700 rounded-l-md px-3 sm:px-6 h-7 sm:h-8 text-xs">
                          View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="group border border-l-0 hover:!bg-[#53f8701a] rounded-l-none bg-transparent border-gray-600 rounded-r-md w-7 sm:w-8 h-7 sm:h-8 p-0 flex items-center justify-center">
                              <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-[#53f870]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem
                              className="text-red-600 hover:bg-transparent! hover:text-red-600! cursor-pointer"
                              onClick={async () => {
                                const siteId =
                                  selectedWebsiteId ||
                                  initialWebsiteId ||
                                  (websites && websites.length > 0
                                    ? websites[0].id
                                    : undefined);
                                await removeKeywordFromWebsite(
                                  siteId,
                                  row.keyword
                                );
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    No keyword opportunities found for this website
                  </td>
                </tr>
              )}
              {selectedKeywords && selectedKeywords.size === 0 && (
                <tr>
                  <td colSpan={6} className="">
                    <div className="mt-4 sm:mt-6 flex justify-end mr-2 sm:mr-4">
                      <Button
                        onClick={handleCreatePost}
                        className="bg-transparent text-gray-400 border border-gray-800 px-4 sm:px-6 mb-4 sm:mb-5 h-8 sm:h-9 text-xs sm:text-sm hover:text-[#53f870] hover:!bg-[#53f8701a]"
                      >
                        Create post
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selection Bar - Shows when keywords are selected */}
        {selectedKeywords && selectedKeywords.size > 0 && (
          <div className="mt-4 flex items-center justify-between p-4 bg-black rounded-lg border border-gray-700">
            <p className="text-sm font-medium text-[#53F870]">
              {selectedKeywords.size} keyword
              {selectedKeywords.size !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-9 border-2 border-[#53F870] px-8 rounded-md bg-black hover:bg-gray-900 cursor-pointer text-[#53F870] text-xs sm:text-sm transition-colors"
                onClick={() => setSelectedKeywords(new Set())}
              >
                Clear
              </Button>
              <Button
                size="sm"
                className="h-9 px-4 bg-[#53f8701a] hover:bg-[#53f8701a] text-[#53f870] cursor-pointer text-xs sm:text-sm font-medium"
                onClick={handleCreatePost}
              >
                Create Post
              </Button>
            </div>
          </div>
        )}

        {/* Competitor Overview Table */}
        <div className="bg-black rounded-xl border border-gray-800 overflow-x-auto">
          <h4 className="text-xs sm:text-sm text-white p-3 sm:p-4">
            Competitor Overview
          </h4>
          <table className="w-full border-collapse min-w-full">
            {/* ================= HEADER ================= */}
            <thead>
              <tr className="border-b border-gray-700 bg-black">
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  Competitor
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">
                  Primary Topic
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  Shared
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">
                  Unique Keywords
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden lg:table-cell">
                  High Value
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500 whitespace-nowrap hidden sm:table-cell">
                  Last Seen
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-4 text-left text-xs font-medium text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            {/* ================= BODY ================= */}
            <tbody>
              {filteredAndSortedCompetitors.map((comp, idx) => {
                const d = getCompetitorDisplayData(comp);
                const lastSeen =
                  comp &&
                  (comp.generatedAt || comp.organic_traffic?.last_seen || "-");
                const shared = d.keywordsCount || comp.common_keywords || 0;
                const unique = Math.max(
                  0,
                  (comp.organic_traffic?.total_keywords || 0) - shared
                );
                const highValue = 0;

                return (
                  <tr
                    key={d.domain + idx}
                    className={`${
                      idx !== filteredAndSortedCompetitors.length - 1
                        ? "border-b border-gray-700"
                        : ""
                    } hover:bg-transparent`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500 font-medium">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://ui-avatars.com/api/?name=${d.domain}&background=random&color=fff&bold=true&size=32`}
                          alt={d.domain}
                          className="w-5 h-5 rounded-full"
                        />
                        {d.domain}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {d.topic}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {shared}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {unique}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {highValue}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {lastSeen || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-start">
                        <Button className="border hover:text-[#53f870] hover:!bg-[#53f8701a] text-gray-300 rounded-r-none bg-transparent hover:bg-transparent text-gray-300cursor-pointer border-gray-700 rounded-l-md px-6 h-8 text-xs">
                          Visit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="group border border-l-0 rounded-l-none bg-transparent border-gray-700 rounded-r-md w-8 h-8 p-0 flex items-center justify-center hover:!bg-[#53f8701a]">
                              <ChevronDown className="w-4 h-4 text-gray-600 group-hover:text-[#53f870] transition-colors duration-200" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem
                              className="text-black hover:bg-transparent! hover:text-black cursor-pointer"
                              onClick={() =>
                                window.open(`https://${d.domain}`, "_blank")
                              }
                            >
                              Visit Website
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 hover:bg-transparent! hover:text-red-600! cursor-pointer"
                              onClick={async () => {
                                const siteId =
                                  selectedWebsiteId ||
                                  initialWebsiteId ||
                                  (websites && websites.length > 0
                                    ? websites[0].id
                                    : undefined);
                                await removeCompetitorFromWebsite(
                                  siteId,
                                  d.domain
                                );
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
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

      {/* Create Post Dialog (enqueue-backed) */}
      <CreatePostDialogDashboard
        open={showCreatePostDialog}
        onOpenChange={(val) => {
          setShowCreatePostDialog(val);
          if (!val) setCreatePostCompleted(false);
        }}
        websiteId={selectedWebsiteId ?? undefined}
        onCreated={() => {
          setCreatePostCompleted(true);
          fetchCompetitors();
        }}
      />

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
    px-3 py-1 text-xs rounded-[5px] border transition-colors
    ${
      competitorTags.includes(tag)
        ? "border border-[#53F870] text-white"
        : "bg-linear-to-b from-[rgba(46,152,57,0.38)] to-[#04230D] text-[#53F870] border-[#53F870] hover:border-gray-300"
    }
  `}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Done Button */}
                  <button
                    onClick={handleAddCompetitorSubmit}
                    className="w-full bg-[#5AFF78] hover:bg-green-700 text-black font-medium py-3 rounded-lg transition-colors"
                  >
                    Add
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
    </div>
  );
}
