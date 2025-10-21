"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, TrendingUp, BarChart3, Filter } from "lucide-react"

interface Keyword {
  id: string
  keyword: string
  volume: number
  difficulty: "Low" | "Medium" | "High"
  cpc: number
  trend: number
  selected?: boolean
}

export function KeywordsTab() {
  const [keywords, setKeywords] = useState<Keyword[]>([
    { id: "1", keyword: "AI content generation", volume: 2400, difficulty: "Low", cpc: 2.5, trend: 12 },
    { id: "2", keyword: "SEO automation tools", volume: 1800, difficulty: "Low", cpc: 3.2, trend: 8 },
    { id: "3", keyword: "blog post generator", volume: 1200, difficulty: "Medium", cpc: 1.8, trend: 5 },
    { id: "4", keyword: "keyword research API", volume: 890, difficulty: "Low", cpc: 4.1, trend: 15 },
    { id: "5", keyword: "automated SEO writing", volume: 650, difficulty: "Low", cpc: 2.9, trend: 10 },
    { id: "6", keyword: "content optimization software", volume: 540, difficulty: "Medium", cpc: 3.5, trend: 3 },
    { id: "7", keyword: "AI writing assistant", volume: 3200, difficulty: "High", cpc: 2.1, trend: 20 },
    { id: "8", keyword: "SEO content writer", volume: 1100, difficulty: "Medium", cpc: 2.7, trend: 7 },
  ])

  const [searchQuery, setSearchQuery] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("volume-desc")
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set())

  const filteredAndSortedKeywords = useMemo(() => {
    const filtered = keywords.filter((kw) => {
      const matchesSearch = kw.keyword.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesDifficulty = difficultyFilter === "all" || kw.difficulty === difficultyFilter
      return matchesSearch && matchesDifficulty
    })

    // Sort keywords
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "volume-desc":
          return b.volume - a.volume
        case "volume-asc":
          return a.volume - b.volume
        case "difficulty-asc":
          const diffOrder = { Low: 0, Medium: 1, High: 2 }
          return diffOrder[a.difficulty] - diffOrder[b.difficulty]
        case "cpc-desc":
          return b.cpc - a.cpc
        case "trend-desc":
          return b.trend - a.trend
        default:
          return 0
      }
    })

    return filtered
  }, [keywords, searchQuery, difficultyFilter, sortBy])

  const toggleKeywordSelection = (id: string) => {
    const newSelected = new Set(selectedKeywords)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedKeywords(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedKeywords.size === filteredAndSortedKeywords.length) {
      setSelectedKeywords(new Set())
    } else {
      setSelectedKeywords(new Set(filteredAndSortedKeywords.map((kw) => kw.id)))
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Low":
        return "bg-green-100 text-green-700"
      case "Medium":
        return "bg-yellow-100 text-yellow-700"
      case "High":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const stats = {
    totalKeywords: filteredAndSortedKeywords.length,
    avgVolume: Math.round(
      filteredAndSortedKeywords.reduce((sum, kw) => sum + kw.volume, 0) / filteredAndSortedKeywords.length,
    ),
    avgCpc: (filteredAndSortedKeywords.reduce((sum, kw) => sum + kw.cpc, 0) / filteredAndSortedKeywords.length).toFixed(
      2,
    ),
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Keywords</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalKeywords}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Volume</p>
                <p className="text-2xl font-bold text-foreground">{stats.avgVolume.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. CPC</p>
                <p className="text-2xl font-bold text-foreground">${stats.avgCpc}</p>
              </div>
              <Filter className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Keyword Research</CardTitle>
          <CardDescription>Find and analyze low-competition, high-volume keywords</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters Row */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-input border-border/40"
              />
            </div>

            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full md:w-40 bg-input border-border/40">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-40 bg-input border-border/40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume-desc">Volume (High to Low)</SelectItem>
                <SelectItem value="volume-asc">Volume (Low to High)</SelectItem>
                <SelectItem value="difficulty-asc">Difficulty (Easy to Hard)</SelectItem>
                <SelectItem value="cpc-desc">CPC (High to Low)</SelectItem>
                <SelectItem value="trend-desc">Trending</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="border-border/40 gap-2 bg-transparent">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>

          {/* Keywords Table */}
          <div className="border border-border/40 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedKeywords.size === filteredAndSortedKeywords.length &&
                          filteredAndSortedKeywords.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Keyword</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Volume</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Difficulty</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">CPC</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedKeywords.map((keyword) => (
                    <tr key={keyword.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeywords.has(keyword.id)}
                          onChange={() => toggleKeywordSelection(keyword.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{keyword.keyword}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{keyword.volume.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getDifficultyColor(keyword.difficulty)}>{keyword.difficulty}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground font-medium">${keyword.cpc.toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <p className="text-foreground">{keyword.trend}%</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Keywords Actions */}
          {selectedKeywords.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm font-medium text-foreground">
                {selectedKeywords.size} keyword{selectedKeywords.size !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-border/40 bg-transparent">
                  Add to Campaign
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Generate Articles
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
