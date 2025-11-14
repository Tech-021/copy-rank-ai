// components/tabs/competitors-tab.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ExternalLink, TrendingUp, Users, Target, BarChart3, Loader2 } from "lucide-react"

interface CompetitorsTabProps {
  websiteId: string | null;
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

export function CompetitorsTab({ websiteId }: CompetitorsTabProps) {
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [qualityFilter, setQualityFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("overlap-desc")

  // Fetch competitors when websiteId changes
  useEffect(() => {
    if (websiteId) {
      fetchCompetitors()
    } else {
      setLoading(false)
      setError("No website selected")
    }
  }, [websiteId])

  const fetchCompetitors = async () => {
    if (!websiteId) return;
    
    try {
      setLoading(true)
      setError(null)
      console.log(`🔍 Fetching competitors for website: ${websiteId}`)
      
      const response = await fetch(`/api/keyword/${websiteId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch competitors")
      }

      // Extract competitors from the API response
      let competitorsData: Competitor[] = []
      
      // Check for competitors in fullData (new format from onboarding)
      if (data.fullData && data.fullData.competitors && Array.isArray(data.fullData.competitors)) {
        competitorsData = data.fullData.competitors
        console.log(`✅ Loaded ${competitorsData.length} competitors from fullData`)
      } else if (data.metadata?.hasCompetitors) {
        console.log('⚠️ Metadata indicates competitors but fullData not found')
        competitorsData = []
      }
      
      setWebsiteData({
        website: data.website,
        competitors: competitorsData,
        metadata: data.metadata
      })
      setCompetitors(competitorsData)
      
      console.log(`✅ Total competitors loaded: ${competitorsData.length}`)
      
    } catch (err) {
      console.error('Error fetching competitors:', err)
      setError(err instanceof Error ? err.message : "Failed to load competitors")
    } finally {
      setLoading(false)
    }
  }

  // Helper function to check if competitor is in new format (from onboarding)
  const isNewFormat = (competitor: Competitor | undefined): boolean => {
    if (!competitor) return false; // Handle undefined/null
    return competitor.keywords_count !== undefined || 
           (competitor.keywords !== undefined && competitor.topic !== undefined)
  }

  // Helper function to get display values for new format
  const getCompetitorDisplayData = (competitor: Competitor) => {
    if (isNewFormat(competitor)) {
      // New format: show topic, keywords count, and keywords list
      return {
        domain: competitor.domain,
        topic: competitor.topic || 'Unknown',
        keywordsCount: competitor.keywords_count || competitor.keywords?.length || 0,
        keywords: competitor.keywords || [],
        success: competitor.success !== false,
        error: competitor.error
      }
    } else {
      // Old format: use existing fields
      return {
        domain: competitor.domain,
        topic: 'N/A',
        keywordsCount: competitor.organic_traffic?.total_keywords || competitor.common_keywords || 0,
        keywords: [],
        success: true,
        error: null,
        avgPosition: competitor.avg_position,
        commonKeywords: competitor.common_keywords,
        organicTraffic: competitor.organic_traffic,
        competitiveOverlap: competitor.competitive_overlap,
        serpOverlapQuality: competitor.serp_overlap_quality
      }
    }
  }

  const filteredAndSortedCompetitors = competitors
    .filter(competitor => {
      const displayData = getCompetitorDisplayData(competitor)
      const matchesSearch = displayData.domain.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (isNewFormat(competitor)) {
        // For new format, filter by topic or domain
        const matchesTopic = displayData.topic.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesSearch || matchesTopic
      } else {
        // For old format, use existing quality filter
        return matchesSearch && 
               (qualityFilter === "all" || competitor.serp_overlap_quality === qualityFilter)
      }
    })
    .sort((a, b) => {
      const aData = getCompetitorDisplayData(a)
      const bData = getCompetitorDisplayData(b)
      
      if (isNewFormat(a) && isNewFormat(b)) {
        // Sort new format by keywords count
        switch (sortBy) {
          case "overlap-desc":
            return bData.keywordsCount - aData.keywordsCount
          case "overlap-asc":
            return aData.keywordsCount - bData.keywordsCount
          default:
            return 0
        }
      } else {
        // Use existing sort logic for old format
        switch (sortBy) {
          case "overlap-desc":
            return (b.common_keywords || 0) - (a.common_keywords || 0)
          case "overlap-asc":
            return (a.common_keywords || 0) - (b.common_keywords || 0)
          case "position-asc":
            return (a.avg_position || 0) - (b.avg_position || 0)
          case "position-desc":
            return (b.avg_position || 0) - (a.avg_position || 0)
          case "traffic-desc":
            return (b.organic_traffic?.estimated_traffic_value || 0) - (a.organic_traffic?.estimated_traffic_value || 0)
          case "traffic-asc":
            return (a.organic_traffic?.estimated_traffic_value || 0) - (b.organic_traffic?.estimated_traffic_value || 0)
          default:
            return 0
        }
      }
    })

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "High": return "bg-green-100 text-green-700 border-green-200"
      case "Medium": return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "Low": return "bg-red-100 text-red-700 border-red-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getPositionColor = (position: number) => {
    if (position <= 10) return "text-green-600"
    if (position <= 30) return "text-yellow-600"
    return "text-red-600"
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatCurrency = (num: number) => {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'K'
    return '$' + num.toString()
  }

  const stats = {
    totalCompetitors: competitors.length,
    avgOverlap: competitors.length > 0 && isNewFormat(competitors[0])
      ? Math.round(competitors.reduce((sum, c) => sum + (c.keywords_count || c.keywords?.length || 0), 0) / Math.max(competitors.length, 1))
      : Math.round(competitors.reduce((sum, c) => sum + (c.common_keywords || 0), 0) / Math.max(competitors.length, 1)),
    avgPosition: competitors.length > 0 && isNewFormat(competitors[0])
      ? "N/A"
      : (competitors.reduce((sum, c) => sum + (c.avg_position || 0), 0) / Math.max(competitors.length, 1)).toFixed(1),
    highQualityCount: competitors.filter(c => !isNewFormat(c) && c.serp_overlap_quality === "High").length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading competitors...</p>
        </div>
      </div>
    )
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
    )
  }

  if (!websiteData || competitors.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-2">No competitor data found</p>
          <p className="text-sm text-muted-foreground">
            This website doesn't have competitor analysis data yet.
          </p>
          <Button 
            onClick={fetchCompetitors} 
            variant="outline" 
            className="mt-4"
          >
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Website Info Header */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">SEO Competitors</h1>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Website:</span> {websiteData.website.url}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Topic:</span> {websiteData.website.topic}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Total Competitors:</span> {competitors.length}
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
                <p className="text-sm text-muted-foreground">Total Competitors</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalCompetitors}</p>
              </div>
              <Users className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Keyword Overlap</p>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats.avgOverlap)}</p>
              </div>
              <Target className="w-8 h-8 text-accent/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Position</p>
                <p className="text-2xl font-bold text-foreground">{stats.avgPosition}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-yellow-500/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Quality</p>
                <p className="text-2xl font-bold text-foreground">{stats.highQualityCount}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Competitor Analysis</CardTitle>
          <CardDescription>
            Analyze websites competing for similar keywords in search results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters Row */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search competitors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-input border-border/40"
              />
            </div>

            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-full md:w-40 bg-input border-border/40">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Qualities</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48 bg-input border-border/40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overlap-desc">Overlap (High to Low)</SelectItem>
                <SelectItem value="overlap-asc">Overlap (Low to High)</SelectItem>
                <SelectItem value="position-asc">Position (Best to Worst)</SelectItem>
                <SelectItem value="position-desc">Position (Worst to Best)</SelectItem>
                <SelectItem value="traffic-desc">Traffic (High to Low)</SelectItem>
                <SelectItem value="traffic-asc">Traffic (Low to High)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Competitors Grid */}
          <div className="grid gap-4">
            {filteredAndSortedCompetitors.map((competitor, index) => {
              const displayData = getCompetitorDisplayData(competitor)
              const isNew = isNewFormat(competitor)
              
              return (
                <Card key={competitor.domain} className="border-border/40 bg-card/50 backdrop-blur-sm">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-foreground text-lg">{displayData.domain}</h3>
                          {isNew ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              {displayData.topic}
                            </Badge>
                          ) : (
                            <Badge className={getQualityColor(competitor.serp_overlap_quality || "Low")}>
                              {competitor.serp_overlap_quality} Quality
                            </Badge>
                          )}
                          {displayData.success === false && (
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              Failed
                            </Badge>
                          )}
                        </div>
                        
                        {isNew ? (
                          // New format display
                          <div className="space-y-3">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Topic</p>
                                <p className="text-lg font-bold text-foreground">{displayData.topic}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Keywords Found</p>
                                <p className="text-lg font-bold text-foreground">{displayData.keywordsCount}</p>
                              </div>
                            </div>
                            
                            {displayData.keywords && displayData.keywords.length > 0 && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Keywords:</p>
                                <div className="flex flex-wrap gap-2">
                                  {displayData.keywords.slice(0, 10).map((kw: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {typeof kw === 'string' ? kw : kw.keyword}
                                    </Badge>
                                  ))}
                                  {displayData.keywords.length > 10 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{displayData.keywords.length - 10} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {displayData.error && (
                              <p className="text-sm text-red-600">Error: {displayData.error}</p>
                            )}
                          </div>
                        ) : (
                          // Old format display (existing code)
                          <>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Keyword Overlap</p>
                                <p className="text-lg font-bold text-foreground">
                                  {formatNumber(competitor.common_keywords || 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {competitor.competitive_overlap}% overlap
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-muted-foreground">Avg. Position</p>
                                <p className={`text-lg font-bold ${getPositionColor(competitor.avg_position || 0)}`}>
                                  #{competitor.avg_position?.toFixed(1) || 'N/A'}
                                </p>
                                <p className="text-xs text-muted-foreground">SERP position</p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-muted-foreground">Estimated Traffic</p>
                                <p className="text-lg font-bold text-foreground">
                                  {formatCurrency(competitor.organic_traffic?.estimated_traffic_value || 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Traffic value</p>
                              </div>
                              
                              <div>
                                <p className="text-sm text-muted-foreground">Top Positions</p>
                                <p className="text-lg font-bold text-foreground">
                                  {formatNumber(competitor.organic_traffic?.top_3_positions || 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Top 3 rankings</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">
                                Total Keywords: {formatNumber(competitor.organic_traffic?.total_keywords || 0)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Top 10: {formatNumber(competitor.organic_traffic?.top_10_positions || 0)}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-2 ml-4"
                        onClick={() => {
                          const url = displayData.domain.startsWith('http') 
                            ? displayData.domain 
                            : `https://${displayData.domain}`
                          window.open(url, '_blank')
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredAndSortedCompetitors.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No competitors found matching your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}