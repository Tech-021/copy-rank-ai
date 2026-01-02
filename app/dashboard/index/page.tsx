"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { HelpIcon } from "@/components/ui/help-icon";
import { supabase } from "@/lib/client";
import { getUser } from "@/lib/auth";
import { LoaderChevron } from "@/components/ui/LoaderChevron";
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

interface IndexPost {
  id: string;
  title: string;
  status: "indexed" | "requested" | "pending" | "un-indexed";
  keyword: string;
  visibility: "high" | "medium" | "low";
  dbStatus?: string;
}

interface AnalyticsData {
  articlesGenerated: number;
  articlesLive: number;
  estimatedTraffic: number;
  keywordsTracked: number;
  draftArticles: number;
  totalCompetitors: number;
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

export default function DashboardIndexPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    null
  );
  const [websites, setWebsites] = useState<Website[]>([]);
  const [posts, setPosts] = useState<IndexPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPostId, setUpdatingPostId] = useState<string | null>(null);
  const [indexStats, setIndexStats] = useState({
    indexed: 0,
    requested: 0,
    pending: 0,
    unIndexed: 0,
  });

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: user, error } = await getUser();
        if (error || !user) {
          console.error("Error fetching user:", error);
          return;
        }
        setCurrentUser(user);
      } catch (err) {
        console.error("Failed to get current user:", err);
      }
    };

    fetchCurrentUser();
  }, []);

  // Fetch websites for the user
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadUserWebsites = async () => {
      try {
        const { data, error } = await supabase
          .from("websites")
          .select("id, url, topic")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading websites:", error);
          return;
        }

        const userWebsites: Website[] = (data || []).map((w: any) => ({
          id: w.id,
          url: w.url,
          topic: w.topic || "General",
          keywords: {},
        }));

        setWebsites(userWebsites);

        // Set first website as selected
        if (userWebsites.length > 0 && !selectedWebsiteId) {
          const stored = readSelectedWebsiteId();
          const nextId =
            stored && userWebsites.some((w) => w.id === stored)
              ? stored
              : userWebsites[0].id;
          setSelectedWebsiteId(nextId);
          writeSelectedWebsiteId(nextId);
        }
      } catch (error) {
        console.error("Error loading websites:", error);
      }
    };

    loadUserWebsites();
  }, [currentUser?.id, selectedWebsiteId]);

  // Fetch articles for the selected website
  useEffect(() => {
    if (!selectedWebsiteId || !currentUser?.id) return;

    const fetchArticles = async () => {
      try {
        setLoading(true);

        const { data: articles, error } = await supabase
          .from("articles")
          .select("id, title, status, keyword, estimated_traffic")
          .eq("website_id", selectedWebsiteId)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("Error fetching articles:", error);
          return;
        }

        // Transform articles to index posts
        const indexPosts: IndexPost[] = (articles || []).map((article: any) => {
          // Determine status
          let status: "indexed" | "requested" | "pending" | "un-indexed" =
            "un-indexed";
          if (article.status === "published" || article.status === "UPLOADED") {
            status = "indexed";
          } else if (article.status === "draft") {
            status = "requested";
          }

          // Determine visibility based on estimated traffic
          let visibility: "high" | "medium" | "low" = "low";
          if (article.estimated_traffic > 500) {
            visibility = "high";
          } else if (article.estimated_traffic > 100) {
            visibility = "medium";
          }

          return {
            id: article.id,
            title: article.title || "Untitled",
            status,
            keyword: article.keyword || "—",
            visibility,
          };
        });

        setPosts(indexPosts);

        // Calculate stats
        const stats = {
          indexed: indexPosts.filter((p) => p.status === "indexed").length,
          requested: indexPosts.filter((p) => p.status === "requested").length,
          pending: indexPosts.filter((p) => p.status === "pending").length,
          unIndexed: indexPosts.filter((p) => p.status === "un-indexed").length,
        };

        setIndexStats(stats);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [selectedWebsiteId, currentUser?.id]);

  const handleWebsiteChange = (websiteId: string) => {
    setSelectedWebsiteId(websiteId);
    writeSelectedWebsiteId(websiteId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "indexed":
        return "text-green-600";
      case "requested":
        return "text-gray-400";
      case "pending":
        return "text-blue-600";
      case "un-indexed":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case "high":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const updateArticleStatus = async (postId: string, newStatus: string) => {
    try {
      setUpdatingPostId(postId);

      // Map UI status to database status
      let dbStatus = "draft";
      if (newStatus === "indexed") {
        dbStatus = "published";
      } else if (newStatus === "requested") {
        dbStatus = "draft";
      }

      const { error } = await supabase
        .from("articles")
        .update({ status: dbStatus })
        .eq("id", postId)
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("Error updating article status:", error);
        return;
      }

      // Update local state
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, status: newStatus as IndexPost["status"] }
            : post
        )
      );

      // Recalculate stats
      const updatedPosts = posts.map((post) =>
        post.id === postId
          ? { ...post, status: newStatus as IndexPost["status"] }
          : post
      );

      const stats = {
        indexed: updatedPosts.filter((p) => p.status === "indexed").length,
        requested: updatedPosts.filter((p) => p.status === "requested").length,
        pending: updatedPosts.filter((p) => p.status === "pending").length,
        unIndexed: updatedPosts.filter((p) => p.status === "un-indexed").length,
      };

      setIndexStats(stats);
    } catch (error) {
      console.error("Error updating article:", error);
    } finally {
      setUpdatingPostId(null);
    }
  };

  const selectedWebsite = websites.find((w) => w.id === selectedWebsiteId);

  const truncateWords = (text: string, count: number = 4) => {
    if (!text) return "";
    const words = text.split(/\s+/).filter(Boolean);
    return words.length <= count ? text : words.slice(0, count).join(" ") + "...";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-normal text-white">
            Index Posts
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            Publish posts to be detected and indexed by search engines.
          </p>
        </div>
        <div className="w-full sm:w-48 sm:mr-8">
          <Select
            value={selectedWebsiteId || ""}
            onValueChange={handleWebsiteChange}
          >
            <SelectTrigger className="h-10 bg-[rgba(83,248,112,0.1)]! border-none rounded-lg focus-visible:outline-none focus-visible:ring-0 px-3 py-2 text-[#53F870] font-medium text-xs sm:text-sm">
              <SelectValue placeholder="Select website" />
            </SelectTrigger>
            <SelectContent className="bg-[#142517]! border-none rounded-lg">
              {websites.map((website) => (
                <SelectItem
                  key={website.id}
                  value={website.id}
                  className="cursor-pointer text-green-600"
                >
                  {website.url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-0 rounded-xl shadow-xl">
        {/* Card 1 - Indexed Posts */}
        <Card className="border-r sm:border-r lg:border-r border-l-0 border-t-0 border-b-0 sm:rounded-r-none lg:rounded-r-none rounded-tl-xl rounded-bl-xl border-gray-800 bg-[#101110] shadow-xl">
          <CardContent className="flex flex-col justify-start gap-6 sm:gap-8 p-3 sm:p-6">
            <div className="flex justify-between items-start">
              <p className="text-xs sm:text-xs font-medium text-white tracking-wide flex items-center">
                Indexed Posts
                <span title="Posts that are published and should be discoverable by search engines." className="ml-2 text-gray-400">
                  <HelpIcon className="w-4 h-4" />
                </span>
              </p>
              <Image
                src="/index1.png"
                alt="icon"
                height={20}
                width={20}
                className="sm:h-6 sm:w-6"
              />
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-[#53F870]">
              {indexStats.indexed}
            </p>
          </CardContent>
        </Card>

        {/* Card 2 - Requested Index */}
        <Card className="border border-t-0 border-b-0 rounded-none border-[#53f8704b] bg-[#101110] shadow-xl">
          <CardContent className="flex flex-col justify-start gap-6 sm:gap-8 p-3 sm:p-6">
            <div className="flex justify-between items-start">
              <p className="text-xs sm:text-xs font-medium text-white tracking-wide flex items-center">
                Requested Index
                <span title="Posts you've requested to be indexed (e.g., drafts marked for indexing)." className="ml-2 text-gray-400">
                  <HelpIcon className="w-4 h-4" />
                </span>
              </p>
              <Image
                src="/index2.png"
                alt="icon"
                height={20}
                width={20}
                className="sm:h-6 sm:w-6"
              />
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-[#53F870]">
              {indexStats.requested}
            </p>
          </CardContent>
        </Card>

        {/* Card 3 - Pending Index */}
        <Card className="border border-t-0 border-b-0 rounded-none border-[#53f8704b] bg-[#101110] shadow-xl">
          <CardContent className="flex flex-col justify-start gap-6 sm:gap-8 p-3 sm:p-6">
            <div className="flex justify-between items-start">
              <p className="text-xs sm:text-xs font-medium text-white tracking-wide flex items-center">
                Pending Index
                <span title="Posts that are queued for indexing and awaiting processing by our indexing service." className="ml-2 text-gray-400">
                  <HelpIcon className="w-4 h-4" />
                </span>
              </p>
              <Image
                src="/index3.png"
                alt="icon"
                height={20}
                width={20}
                className="sm:h-6 sm:w-6"
              />
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-[#53F870]">
              {indexStats.pending}
            </p>
          </CardContent>
        </Card>

        {/* Card 4 - Un-Indexed Posts */}
        <Card className="border border-t-0 rounded-none! border-b-0 border-r-0 rounded-tr-xl rounded-br-xl lg:rounded-tr-none lg:!rounded-r-xl lg:border-r-0 border-[#53f8704b] bg-[#101110] shadow-xl">
          <CardContent className="flex flex-col justify-start gap-6 sm:gap-8 p-3 sm:p-6">
            <div className="flex justify-between items-start">
              <p className="text-xs sm:text-xs font-medium text-white tracking-wide flex items-center">
                Un-Indexed Posts
                <span title="Posts that haven't been indexed yet — they may need publishing or manual submission to search engines." className="ml-2 text-gray-400">
                  <HelpIcon className="w-4 h-4" />
                </span>
              </p>
              <Image
                src="/index4.png"
                alt="icon"
                height={24}
                width={24}
                className="sm:h-8 sm:w-8"
              />
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-[#53F870]">
              {indexStats.unIndexed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <div className="bg-black border border-gray-600 rounded-lg overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-700">
          <h3 className="text-base sm:text-lg font-normal text-white">
            Index Your Posts
          </h3>
        </div>

        <div className="w-full overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoaderChevron />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <p>No posts found for this website</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 sm:py-4 px-2 sm:px-6 text-xs font-normal text-gray-500 min-w-[200px] sm:min-w-auto">
                    Post
                  </th>
                  <th className="text-left py-3 sm:py-4 px-2 sm:px-6 text-xs font-normal text-gray-500 hidden sm:table-cell whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left py-3 sm:py-4 px-2 sm:px-6 text-xs font-normal text-gray-500 hidden sm:table-cell whitespace-nowrap">
                    Keyword
                  </th>
                  <th className="text-left py-3 sm:py-4 px-2 sm:px-6 text-xs font-normal text-gray-500 hidden lg:table-cell whitespace-nowrap">
                    Visibility
                  </th>
                  <th className="text-left py-3 sm:py-4 px-2 sm:px-6 text-xs font-normal text-gray-500 whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, index) => (
                  <tr
                    key={post.id}
                    className={`${
                      index !== posts.length - 1
                        ? "border-b border-gray-800"
                        : ""
                    }`}
                  >
                    <td className="py-3 sm:py-4 px-2 sm:px-6 min-w-[200px] sm:min-w-auto">
                      <span className="truncate max-w-[220px] sm:max-w-[520px] whitespace-nowrap inline-block text-xs sm:text-sm text-[#53F870] font-normal">
                        {truncateWords(post.title, 4)}
                      </span>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-6 hidden sm:table-cell whitespace-nowrap">
                      <span
                        className={`text-xs font-normal capitalize ${getStatusColor(
                          post.status
                        )}`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-6 hidden sm:table-cell max-w-xs">
                      <a 
                        href={`/dashboard/keywords?search=${encodeURIComponent(post.keyword)}`}
                        className="text-xs font-normal text-gray-400 hover:text-[#7CFF9F] truncate block cursor-pointer transition-colors"
                        title={post.keyword}
                      >
                        {truncateWords(post.keyword, 4)}
                      </a>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-6 hidden lg:table-cell whitespace-nowrap">
                      <span
                        className={`text-xs font-normal capitalize ${getVisibilityColor(
                          post.visibility
                        )}`}
                      >
                        {post.visibility}
                      </span>
                    </td>
                    <td className="py-3 sm:py-4 px-2 sm:px-6 whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="flex items-center ">
                            <Button
                              disabled={updatingPostId === post.id}
                              className="bg-transparent px-2 sm:px-8 rounded-r-none hover:text-[#53f870] hover:!bg-[#53f8701a] border border-gray-600 text-xs font-normal text-gray-500 h-auto py-1 sm:py-2 min-w-fit"
                            >
                              {post.status === "indexed"
                                ? "Request Index"
                                : "Requested"}
                            </Button>
                            <Button
                              disabled={updatingPostId === post.id}
                              className="group bg-transparent hover:!bg-[#53f8701a] rounded-l-none border border-gray-600 px-2 sm:px-3 h-auto py-1 sm:py-2"
                            >
                              <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 group-hover:text-[#53f870] transition-colors duration-200" />
                            </Button>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-black border border-gray-700"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              updateArticleStatus(post.id, "requested")
                            }
                            className="text-xs text-gray-400 hover:text-white cursor-pointer"
                          >
                            Request Index
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateArticleStatus(post.id, "indexed")
                            }
                            className="text-xs text-gray-400 hover:text-white cursor-pointer"
                          >
                            Mark as Indexed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              updateArticleStatus(post.id, "un-indexed")
                            }
                            className="text-xs text-gray-400 hover:text-white cursor-pointer"
                          >
                            Un-Index
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
