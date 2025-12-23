"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface IndexPost {
  id: string;
  title: string;
  status: "indexed" | "requested" | "pending" | "un-indexed";
  keyword: string;
  visibility: "high" | "medium" | "low";
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

export default function DashboardIndexPage() {
  const [selectedWebsite, setSelectedWebsite] = useState("www.delani.pro");
  const stats = {
    totalCompetitors: 3,
    avgOverlap: 12,
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
  
  const formatNumber = (num: number) => num.toString();
  const [websites, setWebsites] = useState<Website[]>([]);

  const handleWebsiteChange = async (websiteId: string) => {
      setSelectedWebsiteId(websiteId);
      
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (user) {
        await fetchAnalytics(user.id, websiteId);
      }
    };
  
  const [posts] = useState<IndexPost[]>([
    {
      id: "1",
      title: "Why Framer is Changing...",
      status: "indexed",
      keyword: "web design",
      visibility: "high",
    },
    {
      id: "2",
      title: "Web Design vs Web Dev...",
      status: "requested",
      keyword: "web-development",
      visibility: "medium",
    },
    {
      id: "3",
      title: "Best Framer Templates...",
      status: "requested",
      keyword: "framer",
      visibility: "high",
    },
    {
      id: "4",
      title: "How to Choose a Web...",
      status: "requested",
      keyword: "3d design",
      visibility: "low",
    },
  ]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "":
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
      case "":
        return "text-green-600";
      case "medium":
        return "text-gray-400";
      case "low":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-normal text-white">Index Posts</h2>
          <p className="text-sm text-gray-500 mt-2">Publish posts to be detected and indexed by search engines.</p>
        </div>
        <div className="w-48">
          <Select value={selectedWebsite} onValueChange={setSelectedWebsite}>
            <SelectTrigger className="h-10 bg-transparent border border-green-700 rounded-lg focus-visible:outline-none focus-visible:ring-0 px-3 py-2 text-green-600 font-medium text-sm">
              <SelectValue placeholder="Select website" />
            </SelectTrigger>
            <SelectContent className="bg-black border border-green-700 rounded-lg">
              <SelectItem value="www.delani.pro" className="cursor-pointer text-green-600">
                www.delani.pro
              </SelectItem>
              <SelectItem value="www.delium.com" className="cursor-pointer text-green-600">
                www.delium.com
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
       <div className="grid grid-cols-4 rounded-xl shadow-xl">
          {/* Card 1 */}
          <Card className="border-r border-l-0 border-t-0 border-b-0 rounded-r-none border-gray-800 bg-black shadow-xl">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-white  tracking-wide">
               Indexed Posts
                </p>
                <Image src="/index1.png" alt="icon" height={24} width={24} />
              </div>
              <p className="text-4xl font-bold text-[#53F870]">
                {stats.totalCompetitors}
              </p>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="border border-t-0 border-b-0  rounded-none border-[#53f8704b] bg-black shadow-xl">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-white tracking-wide">
                  Requested Index
                </p>
                <Image src="/index2.png" alt="icon" height={24} width={24} />
              </div>
              <p className="text-4xl font-bold text-[#53F870]">
                {formatNumber(stats.avgOverlap)}
              </p>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="border  border-t-0 border-b-0   rounded-none border-[#53f8704b] bg-black shadow-xl">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-white tracking-wide">
                  Pending Index
                </p>
                <Image src="/index3.png" alt="icon" height={24} width={24} />
              </div>
              <p className="text-4xl font-bold text-[#53F870]">9</p>
            </CardContent>
          </Card>

          {/* Card 4 */}
          <Card className="border  border-t-0 border-b-0 border-r-0 rounded-l-none border-[#53f8704b] bg-black shadow-xl">
            <CardContent className="flex flex-col justify-start gap-8">
              <div className="flex justify-between">
                <p className="text-xs font-medium text-white tracking-wide">
                  Un-Indexed Posts 
                </p>
                <Image src="/index4.png" alt="icon" height={34} width={34} />
              </div>
              <p className="text-4xl font-bold text-[#53F870]">4</p>
            </CardContent>
          </Card>
        </div>

      {/* Table Section */}
      <div className="bg-black border h-[420px]  border-gray-600 rounded-lg">
        <div className="p-4 border-b  border-gray-700">
          <h3 className="text-lg font-normal text-white">Index Your Posts</h3>
        </div>

        <div className="  overflow-x-auto">
          <table className="border border-gray-700  w-full">
            <thead className="">
              <tr className="border-b  border-gray-800">
                <th className="text-left py-4 px-6 text-xs font-normal text-gray-500">Post</th>
                <th className="text-left py-4 px-6 text-xs font-normal text-gray-500">Status</th>
                <th className="text-left py-4 px-6 text-xs font-normal text-gray-500">Keyword</th>
                <th className="text-left py-4 px-6 text-xs font-normal text-gray-500">Visibility</th>
                <th className="text-left py-4 px-6 text-xs font-normal text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => (
                <tr key={post.id} className={`${index !== posts.length - 1 ? "border-b border-gray-800" : ""}`}>
                  <td className="py-4 px-6">
                    <span className={`text-sm text-[#53F870]! font-normal ${getStatusColor(post.status)}`}>{post.title}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-xs font-normal capitalize ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-normal text-gray-500">{post.keyword}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-xs font-normal capitalize ${getVisibilityColor(post.visibility)}`}>
                      {post.visibility}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center  ">
                      <Button  className=" bg-transparent px-8 rounded-r-none hover:bg-gray-400 border border-gray-600 text-xs text-gray-500 font-normal">
                        {post.status === "indexed" ? "Request Index" : "Requested"}
                      </Button>
                      <Button className="bg-transparent hover:bg-gray-400 rounded-l-none border border-gray-600">
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
