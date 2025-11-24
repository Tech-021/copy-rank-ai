"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, TrendingUp, BarChart3, Filter, Loader2, ExternalLink } from "lucide-react"
import { useToast } from "../ui/toast"
import { getUser } from "@/lib/auth"
import { supabase } from "@/lib/client"
import { getUserArticleLimit } from '@/lib/articleLimits'

interface KeywordsTabProps {
  websiteId?: string | null;
  onArticlesGenerated?: (articles: any[]) => void;
}

interface Keyword {
  id?: string
  keyword: string
  search_volume: number
  difficulty: number
  cpc: number
  competition: number
  selected?: boolean
  is_target_keyword?: boolean
}

interface Website {
  id: string;
  url: string;
  topic: string;
  created_at?: string;
}

interface WebsiteData {
  website: {
    id: string
    url: string
    topic: string
  }
  keywords: Keyword[]
}

interface Article {
  id: string
  title: string
  content: string
  keyword: string
  status: "Published" | "Scheduled" | "Draft"
  date: string
  preview: string
  wordCount: number
  metaTitle?: string
  metaDescription?: string
  slug?: string
  focusKeyword?: string
  readingTime?: string
  contentScore?: number
  keywordDensity?: number
  tags?: string[]
  category?: string
  generatedAt?: string
  estimatedTraffic?: number
}

export function KeywordsTab({ websiteId: initialWebsiteId, onArticlesGenerated }: KeywordsTabProps) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(initialWebsiteId || null)
  const [websites, setWebsites] = useState<Website[]>([])
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingWebsites, setLoadingWebsites] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingContent, setGeneratingContent] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("volume-desc")
  const [selectedKeywords, setSelectedKeywords] = useState<Set<number>>(new Set()) // FIX: Use useState properly
  const toast = useToast()

  // Get current user on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: user, error } = await getUser()
        if (error) {
          console.error("Error fetching current user:", error)
          return
        }
        setCurrentUser(user)
        console.log("👤 Current user:", user?.id)
      } catch (err) {
        console.error("Failed to get current user:", err)
      }
    }

    fetchCurrentUser()
  }, [])

  // Load user websites if no websiteId is provided
  const loadUserWebsites = async () => {
    try {
      setLoadingWebsites(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError("Please log in to view keywords")
        return
      }

      const { data, error } = await supabase
        .from("websites")
        .select("id, url, topic, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading websites:", error)
        setError("Failed to load websites")
        return
      }

      if (data && data.length > 0) {
        setWebsites(data)
        // Auto-select first website if no websiteId was provided
        if (!selectedWebsiteId) {
          setSelectedWebsiteId(data[0].id)
        }
      } else {
        setError("No websites found. Add a website in the Analyze tab first.")
      }
    } catch (error) {
      console.error("Error loading websites:", error)
      setError("Failed to load websites")
    } finally {
      setLoadingWebsites(false)
    }
  }

  // Load websites on mount if no websiteId provided
  useEffect(() => {
    if (!initialWebsiteId) {
      loadUserWebsites()
    } else {
      setSelectedWebsiteId(initialWebsiteId)
    }
  }, [initialWebsiteId])

  // Fetch keywords when selectedWebsiteId changes
  useEffect(() => {
    console.log("🔍 KeywordsTab - selectedWebsiteId:", selectedWebsiteId);

    if (selectedWebsiteId) {
      fetchKeywords()
    } else if (!loadingWebsites) {
      setLoading(false)
    }
  }, [selectedWebsiteId])

  const fetchKeywords = async () => {
    if (!selectedWebsiteId) return;

    try {
      setLoading(true)
      setError(null)
      console.log(`🔍 Fetching keywords for website: ${selectedWebsiteId}`)

      const response = await fetch(`/api/keyword/${selectedWebsiteId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Website not found")
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch keywords")
      }

      setWebsiteData(data)

      // Handle both old and new data formats
      let keywordsArray = [];

      if (Array.isArray(data.keywords)) {
        // Old format: direct array of keywords
        keywordsArray = data.keywords;
        console.log(`✅ Loaded ${keywordsArray.length} keywords (old format)`);
      } else if (data.keywords && Array.isArray(data.keywords.keywords)) {
        // New format: object with keywords array inside
        keywordsArray = data.keywords.keywords;
        console.log(`✅ Loaded ${keywordsArray.length} keywords (new format)`);
      } else {
        console.warn('❌ Unexpected keywords format:', data.keywords);
        keywordsArray = [];
      }

      setKeywords(keywordsArray)
      // Reset selected keywords when new keywords are loaded
      setSelectedKeywords(new Set())
      console.log(`✅ Total keywords loaded: ${keywordsArray.length}`)

    } catch (err) {
      console.error('Error fetching keywords:', err)
      setError(err instanceof Error ? err.message : "Failed to load keywords")
    } finally {
      setLoading(false)
    }
  }

  // Move filteredAndSortedKeywords BEFORE generateContentFromKeywords
  const filteredAndSortedKeywords = useMemo(() => {
    const filtered = keywords.filter((kw) => {
      const matchesSearch = kw.keyword.toLowerCase().includes(searchQuery.toLowerCase())

      let difficultyCategory: "Low" | "Medium" | "High"
      if (kw.difficulty <= 40) difficultyCategory = "Low"
      else if (kw.difficulty <= 70) difficultyCategory = "Medium"
      else difficultyCategory = "High"

      const matchesDifficulty = difficultyFilter === "all" || difficultyCategory === difficultyFilter
      return matchesSearch && matchesDifficulty
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "volume-desc":
          return b.search_volume - a.search_volume
        case "volume-asc":
          return a.search_volume - b.search_volume
        case "difficulty-asc":
          return a.difficulty - b.difficulty
        case "difficulty-desc":
          return b.difficulty - a.difficulty
        case "cpc-desc":
          return b.cpc - a.cpc
        case "cpc-asc":
          return a.cpc - b.cpc
        case "competition-asc":
          return a.competition - b.competition
        case "competition-desc":
          return b.competition - a.competition
        default:
          return 0
      }
    })

    return filtered
  }, [keywords, searchQuery, difficultyFilter, sortBy])

  const generateContentFromKeywords = async () => {
    if (!selectedKeywords || selectedKeywords.size === 0) {
      alert("Please select at least one keyword to generate content.")
      return;
    }

    if (!currentUser) {
      alert("Please log in to generate content.")
      return;
    }

    if (!filteredAndSortedKeywords || filteredAndSortedKeywords.length === 0) {
      alert("No keywords available to generate content.")
      return;
    }

    try {
      setGeneratingContent(true);

      const selectedKeywordTexts = Array.from(selectedKeywords).map(
        index => filteredAndSortedKeywords[index]?.keyword
      ).filter(Boolean);

      if (selectedKeywordTexts.length === 0) {
        alert("No valid keywords selected.")
        setGeneratingContent(false);
        return;
      }

      // Get user's package limit
      const userLimit = await getUserArticleLimit(currentUser.id);
      const totalArticles = userLimit;

      console.log(`🚀 Generating ${totalArticles} articles (package limit) with keywords:`, selectedKeywordTexts);
      console.log("👤 Current user ID:", currentUser.id);

      const generatedArticles: Article[] = [];

      for (let i = 0; i < totalArticles; i++) {
        console.log(`📄 Generating article ${i + 1}/${totalArticles}...`);
        
        const response = await fetch('/api/test-generate-article', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keywords: selectedKeywordTexts,
            userId: currentUser.id,
            websiteId: selectedWebsiteId,
            articleNumber: i + 1,
            totalArticles: totalArticles,
          }),
        });

        if (!response.ok) {
          console.error(`Failed to generate article ${i + 1}`);
          continue;
        }

        const data = await response.json();
        
        if (data.success && data.article) {
          const newArticle: Article = {
            id: data.article.id,
            title: data.article.title,
            content: data.article.content,
            keyword: selectedKeywordTexts.join(', '),
            status: "Draft",
            date: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            preview: data.article.metaDescription || data.article.content.substring(0, 150) + '...',
            wordCount: data.article.wordCount,
            metaTitle: data.article.metaTitle,
            metaDescription: data.article.metaDescription,
            readingTime: data.article.readingTime,
            contentScore: data.article.contentScore,
            keywordDensity: data.article.keywordDensity,
            tags: data.article.tags,
            category: data.article.category,
            estimatedTraffic: data.article.estimatedTraffic
          };

          generatedArticles.push(newArticle);
          console.log(`✅ Generated article ${i + 1}/${totalArticles}`);
        }

        if (i < totalArticles - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (onArticlesGenerated && generatedArticles.length > 0) {
        onArticlesGenerated(generatedArticles);
      }

      console.log(`✅ Generated ${generatedArticles.length} articles with keywords:`, selectedKeywordTexts);

      setSelectedKeywords(new Set());

      toast.showToast({
        title: `Successfully generated ${generatedArticles.length} articles with ${selectedKeywordTexts.length} keywords! Check the Articles tab.`,
        type: "success",
        duration: 5000
      });

    } catch (error) {
      console.error('Error generating content:', error);
      toast.showToast({
        title: "Failed to generate content",
        description: "Please try again.",
        type: "error"
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  const toggleKeywordSelection = (index: number) => {
    if (!selectedKeywords) return;
    const newSelected = new Set(selectedKeywords)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedKeywords(newSelected)
  }

  const toggleSelectAll = () => {
    if (!selectedKeywords || !filteredAndSortedKeywords) return;
    if (selectedKeywords.size === filteredAndSortedKeywords.length) {
      setSelectedKeywords(new Set())
    } else {
      setSelectedKeywords(new Set(filteredAndSortedKeywords.map((_, index) => index)))
    }
  }

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 40) return "bg-green-100 text-green-700 border-green-200"
    else if (difficulty <= 70) return "bg-yellow-100 text-yellow-700 border-yellow-200"
    else return "bg-red-100 text-red-700 border-red-200"
  }

  const getDifficultyText = (difficulty: number) => {
    if (difficulty <= 40) return "Low"
    else if (difficulty <= 70) return "Medium"
    else return "High"
  }

  const getCompetitionColor = (competition: number) => {
    if (competition <= 0.3) return "bg-green-100 text-green-700 border-green-200"
    else if (competition <= 0.6) return "bg-yellow-100 text-yellow-700 border-yellow-200"
    else return "bg-red-100 text-red-700 border-red-200"
  }

  const getCompetitionText = (competition: number) => {
    if (competition <= 0.3) return "Low"
    else if (competition <= 0.6) return "Medium"
    else return "High"
  }

  const stats = {
    totalKeywords: filteredAndSortedKeywords.length,
    avgVolume: Math.round(
      filteredAndSortedKeywords.reduce((sum, kw) => sum + kw.search_volume, 0) / Math.max(filteredAndSortedKeywords.length, 1)
    ),
    avgCpc: (filteredAndSortedKeywords.reduce((sum, kw) => sum + kw.cpc, 0) / Math.max(filteredAndSortedKeywords.length, 1)).toFixed(2),
    avgDifficulty: Math.round(
      filteredAndSortedKeywords.reduce((sum, kw) => sum + kw.difficulty, 0) / Math.max(filteredAndSortedKeywords.length, 1)
    )
  }

  const exportKeywords = () => {
    const csvContent = [
      ["Keyword", "Search Volume", "Difficulty", "CPC", "Competition"],
      ...filteredAndSortedKeywords.map(kw => [
        kw.keyword,
        kw.search_volume,
        kw.difficulty,
        `$${kw.cpc.toFixed(2)}`,
        kw.competition.toFixed(2)
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `keywords-${websiteData?.website.topic || "export"}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loadingWebsites) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading websites...</p>
        </div>
      </div>
    )
  }

  if (error && !selectedWebsiteId && websites.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadUserWebsites} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading keywords...</p>
        </div>
      </div>
    )
  }

  if (error && selectedWebsiteId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchKeywords} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!websiteData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No website data found</p>
          <p className="text-sm text-muted-foreground">
            Please select a website from the list above.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Website Selector Pills */}
      {websites.length > 0 && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Select Website</CardTitle>
            <CardDescription>Choose a website to view its keywords</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {websites.map((website) => (
                <Button
                  key={website.id}
                  variant={selectedWebsiteId === website.id ? "default" : "outline"}
                  onClick={() => setSelectedWebsiteId(website.id)}
                  className={`cursor-pointer ${
                    selectedWebsiteId === website.id
                      ? "bg-primary text-primary-foreground"
                      : "border-border/40 hover:bg-accent"
                  }`}
                >
                  {website.url}
                  {selectedWebsiteId === website.id && (
                    <Badge className="ml-2 bg-primary-foreground/20 text-primary-foreground">
                      Active
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Website Info Header */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">SEO Keywords</h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Website:</span> {websiteData.website.url}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Topic:</span> {websiteData.website.topic}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Total Keywords:</span> {keywords.length}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="cursor-pointer border-border/40 gap-2"
              onClick={() => window.open(websiteData.website.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              Visit Website
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
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

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Difficulty</p>
                <p className="text-2xl font-bold text-foreground">{stats.avgDifficulty}/100</p>
              </div>
              <BarChart3 className="w-8 h-8 text-yellow-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Keyword Analysis</CardTitle>
          <CardDescription>Analyze and filter keywords for {websiteData.website.topic}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <SelectTrigger className="w-full md:w-48 bg-input border-border/40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volume-desc">Volume (High to Low)</SelectItem>
                <SelectItem value="volume-asc">Volume (Low to High)</SelectItem>
                <SelectItem value="difficulty-asc">Difficulty (Easy to Hard)</SelectItem>
                <SelectItem value="difficulty-desc">Difficulty (Hard to Easy)</SelectItem>
                <SelectItem value="cpc-desc">CPC (High to Low)</SelectItem>
                <SelectItem value="cpc-asc">CPC (Low to High)</SelectItem>
                <SelectItem value="competition-asc">Competition (Low to High)</SelectItem>
                <SelectItem value="competition-desc">Competition (High to Low)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="cursor-pointer border-border/40 gap-2 bg-transparent"
              onClick={exportKeywords}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>

          <div className="border border-border/40 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedKeywords && 
                          selectedKeywords.size === filteredAndSortedKeywords.length &&
                          filteredAndSortedKeywords.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Keyword</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Search Volume</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Difficulty</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">CPC</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Competition</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedKeywords.map((keyword, index) => (
                    <tr key={index} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeywords ? selectedKeywords.has(index) : false}
                          onChange={() => toggleKeywordSelection(index)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{keyword.keyword}</p>
                          {keyword.is_target_keyword && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                              Targeted
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground font-medium">{keyword.search_volume.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getDifficultyColor(keyword.difficulty)}>
                          {getDifficultyText(keyword.difficulty)} ({keyword.difficulty})
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground font-medium">${keyword.cpc.toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getCompetitionColor(keyword.competition)}>
                          {getCompetitionText(keyword.competition)} ({(keyword.competition * 100).toFixed(0)}%)
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredAndSortedKeywords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No keywords found matching your filters.
            </div>
          )}

          {selectedKeywords && selectedKeywords.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm font-medium text-foreground">
                {selectedKeywords.size} keyword{selectedKeywords.size !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="cursor-pointer border-border/40 bg-transparent">
                  Add to Campaign
                </Button>
                <Button
                  size="sm"
                  className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={generateContentFromKeywords}
                  disabled={generatingContent}
                >
                  {generatingContent ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Content Ideas"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}