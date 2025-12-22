"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

interface IndexPost {
  id: string;
  title: string;
  status: "indexed" | "requested" | "pending" | "un-indexed";
  keyword: string;
  visibility: "high" | "medium" | "low";
}

export default function DashboardIndexPage() {
  const [selectedWebsite, setSelectedWebsite] = useState("www.delani.pro");
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
      <div className="grid grid-cols-4 gap-4">
        {/* Indexed Posts */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-green-600 rounded"></div>
            <p className="text-xs text-gray-500 font-normal">Indexed Posts</p>
          </div>
          <div className="text-4xl font-bold text-green-600">3</div>
        </div>

        {/* Requested Index */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-yellow-600 rounded"></div>
            <p className="text-xs text-gray-500 font-normal">Requested Index</p>
          </div>
          <div className="text-4xl font-bold text-yellow-600">12</div>
        </div>

        {/* Pending Index */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-blue-600 rounded"></div>
            <p className="text-xs text-gray-500 font-normal">Pending Index</p>
          </div>
          <div className="text-4xl font-bold text-blue-600">9</div>
        </div>

        {/* Un-Indexed Posts */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-red-600 rounded"></div>
            <p className="text-xs text-gray-500 font-normal">Un-Indexed Posts</p>
          </div>
          <div className="text-4xl font-bold text-red-600">4</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-black border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-normal text-white">Index Your Posts</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
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
                    <span className={`text-sm font-normal ${getStatusColor(post.status)}`}>{post.title}</span>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-normal">
                        {post.status === "indexed" ? "Request Index" : "Requested"}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-600" />
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
