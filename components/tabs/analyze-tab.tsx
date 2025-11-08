"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2, ExternalLink, Users } from "lucide-react"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"

interface AnalyzeTabProps {
  onViewKeywords: (websiteId: string) => void
  onViewCompetitors: (websiteId: string) => void
}

interface Website {
  id: string
  url: string
  topic: string
  keywords: any
  isAnalyzing?: boolean
  user_id?: string
  created_at?: string
}

interface ScraperResponse {
  ok: boolean
  niche?: {
    niche: string
    confidence: number
  }
  error?: {
    code: string
    message: string
  }
}

interface KeywordsResponse {
  success: boolean
  topic: string
  keywords: any[]
  competitors: any[]
  totalKeywords: number
  totalCompetitors: number
  error?: string
}

// Helper function to get keywords count
const getKeywordsCount = (keywordsData: any): number => {
  if (!keywordsData) return 0

  // If it's an object with keywords array
  if (keywordsData.keywords && Array.isArray(keywordsData.keywords)) {
    return keywordsData.keywords.length
  }

  // If it's directly an array
  if (Array.isArray(keywordsData)) {
    return keywordsData.length
  }

  return 0
}

// Helper function to get competitors count
const getCompetitorsCount = (keywordsData: any): number => {
  if (!keywordsData) return 0

  // If it's an object with competitors array
  if (keywordsData.competitors && Array.isArray(keywordsData.competitors)) {
    return keywordsData.competitors.length
  }

  return 0
}

export function AnalyzeTab({ onViewKeywords, onViewCompetitors }: AnalyzeTabProps) {
  const [websites, setWebsites] = useState<Website[]>([])
  const [urlInput, setUrlInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [urlError, setUrlError] = useState("")
  const [includeCompetitors, setIncludeCompetitors] = useState(true)
  const toast = useToast()

  // URL validation and formatting
  const validateAndFormatUrl = (input: string): { isValid: boolean; formattedUrl: string; error?: string } => {
    let url = input.trim()

    url = url.replace(/\s+/g, "")

    if (!url) {
      return { isValid: false, formattedUrl: "", error: "URL is required" }
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    if (!url.includes(".") && !url.includes("localhost")) {
      const lastSlashIndex = url.lastIndexOf("/")
      const domainPart = lastSlashIndex > 6 ? url.substring(8, lastSlashIndex) : url.substring(8)

      if (!domainPart.includes(".")) {
        url = url.replace(/\/$/, "") + ".com/"
      }
    }

    try {
      const urlObj = new URL(url)

      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return { isValid: false, formattedUrl: url, error: "URL must start with http:// or https://" }
      }

      if (!urlObj.hostname) {
        return { isValid: false, formattedUrl: url, error: "Invalid domain name" }
      }

      return { isValid: true, formattedUrl: urlObj.toString() }
    } catch (error) {
      return {
        isValid: false,
        formattedUrl: url,
        error: "Please enter a valid URL (e.g., example.com or https://example.com)",
      }
    }
  }

  const handleUrlInputChange = (value: string) => {
    setUrlInput(value)
    if (urlError && value.trim()) {
      setUrlError("")
    }
  }

  // STEP 1: Get website topic
  const getWebsiteTopic = async (url: string): Promise<string> => {
    try {
      const response = await fetch("/api/scraper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      const data: ScraperResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || "Scraping failed")
      }

      const topic = data.niche?.niche || "General"
      return topic
    } catch (error) {
      console.error("Scraper API call failed:", error)
      throw error
    }
  }

  // STEP 2: Get keywords and competitors
  const getKeywordsAndCompetitors = async (topic: string, websiteUrl: string): Promise<KeywordsResponse> => {
    try {
      const response = await fetch("/api/keyword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          websiteUrl,
          includeCompetitors: includeCompetitors,
        }),
      })

      const data: KeywordsResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Keywords API failed")
      }

      return data
    } catch (error) {
      console.error("Keywords API call failed:", error)
      throw error
    }
  }

  // STEP 3: Save website to database
  const saveWebsiteToDB = async (url: string, topic: string, keywords: any[], competitors: any[]): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      console.log(`💾 Saving ${keywords.length} keywords and ${competitors?.length || 0} competitors to database...`)

      // Combine both keywords and competitors into a single object
      const combinedData = {
        keywords: Array.isArray(keywords) ? keywords : [],
        competitors: Array.isArray(competitors) ? competitors : [],
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          total_keywords: keywords?.length || 0,
          total_competitors: competitors?.length || 0,
          highest_competitor_overlap: competitors?.[0]?.common_keywords || 0,
        },
      }

      const insertData = {
        url: url,
        topic: topic,
        keywords: combinedData,
        user_id: user.id,
      }

      console.log("📦 Insert data prepared:", {
        url: insertData.url,
        topic: insertData.topic,
        keywords_count: combinedData.keywords.length,
        competitors_count: combinedData.competitors.length,
      })

      const { data, error } = await supabase.from("websites").insert([insertData]).select().single()

      if (error) {
        console.error("❌ Supabase insert error:", error)
        throw error
      }

      console.log("✅ Successfully saved website with combined keywords and competitors data")
      return data.id
    } catch (error) {
      console.error("💥 Error saving to database:", error)
      throw error
    }
  }

  const loadUserWebsites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from("websites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading websites:", error)
        return
      }

      if (data) {
        setWebsites(data)
      }
    } catch (error) {
      console.error("Error loading websites:", error)
    }
  }

  const deleteWebsiteFromDB = async (id: string) => {
    try {
      const { error } = await supabase.from("websites").delete().eq("id", id)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error("Error deleting website:", error)
      throw error
    }
  }

  // MAIN FUNCTION: Chain all APIs
  const handleAddWebsite = async () => {
    const validation = validateAndFormatUrl(urlInput)

    if (!validation.isValid) {
      setUrlError(validation.error || "Invalid URL")
      return
    }

    const formattedUrl = validation.formattedUrl

    setIsAnalyzing(true)
    const tempId = Math.random().toString()

    const newWebsite: Website = {
      id: tempId,
      url: formattedUrl,
      topic: "Detecting topic...",
      keywords: null,
      isAnalyzing: true,
    }
    setWebsites([...websites, newWebsite])
    setUrlInput("")

    try {
      // STEP 1: Get topic
      console.log("🔍 Step 1: Getting website topic...")
      const topic = await getWebsiteTopic(formattedUrl)

      // Update UI with detected topic
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId ? { ...site, topic: `Getting keywords for: ${topic}` } : site
        )
      )

      // STEP 2: Get keywords AND competitors
      console.log("🔍 Step 2: Getting keywords and competitors for topic:", topic)
      const keywordData = await getKeywordsAndCompetitors(topic, formattedUrl)

      // STEP 3: Save to database
      console.log("💾 Step 3: Saving to database...")
      const dbId = await saveWebsiteToDB(formattedUrl, topic, keywordData.keywords, keywordData.competitors)

      // Final UI update with complete data
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId
            ? {
                ...site,
                id: dbId,
                topic: topic,
                keywords: {
                  keywords: keywordData.keywords,
                  competitors: keywordData.competitors,
                  analysis_metadata: keywordData.analysis_metadata || {},
                },
                isAnalyzing: false,
              }
            : site
        )
      )

      // Show success toast
      toast.showToast({
        title: "Analysis Complete!",
        description: `Found ${keywordData.keywords.length} keywords and ${keywordData.competitors.length} competitors for "${topic}"`,
        type: "success",
      })
    } catch (error) {
      console.error("Error analyzing website:", error)

      const errorMessage = error instanceof Error ? error.message : "Analysis failed"

      // Remove failed website
      setTimeout(() => {
        setWebsites((prev) => prev.filter((site) => site.id !== tempId))
      }, 500)

      // Show error toast
      toast.showToast({
        title: "Analysis Failed",
        description: `Failed to analyze ${formattedUrl}: ${errorMessage}`,
        type: "error",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRemoveWebsite = async (id: string) => {
    try {
      await deleteWebsiteFromDB(id)
      setWebsites(websites.filter((site) => site.id !== id))

      toast.showToast({
        title: "Website Removed",
        description: "Website has been removed from your list",
        type: "success",
      })
    } catch (error) {
      console.error("Error deleting website:", error)

      toast.showToast({
        title: "Delete Failed",
        description: "Failed to remove website. Please try again.",
        type: "error",
      })
    }
  }

  // Load websites on mount
  useEffect(() => {
    loadUserWebsites()
  }, [])

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Add Website</CardTitle>
          <CardDescription>Enter your website URL to analyze its topic and discover keywords + competitors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="example.com or https://example.com"
              value={urlInput}
              onChange={(e) => handleUrlInputChange(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isAnalyzing && handleAddWebsite()}
              className="bg-input border-border/40"
              disabled={isAnalyzing}
            />
            <Button
              onClick={handleAddWebsite}
              disabled={isAnalyzing}
              className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeCompetitors"
              checked={includeCompetitors}
              onChange={(e) => setIncludeCompetitors(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="includeCompetitors" className="text-sm text-muted-foreground">
              Include competitor analysis (finds websites competing for similar keywords)
            </label>
          </div>

          {urlError && <p className="text-sm text-destructive">{urlError}</p>}
        </CardContent>
      </Card>

      {websites.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Your Websites</h3>
          {websites.map((site) => (
            <Card key={site.id} className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{site.url}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {site.isAnalyzing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Detecting topic...
                        </span>
                      ) : (
                        <>Topic: {site.topic}</>
                      )}
                    </p>

                    {!site.isAnalyzing && site.keywords && (
                      <div className="flex gap-4 mt-3">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <span className="font-medium">{getKeywordsCount(site.keywords)}</span>
                          <span>Keywords</span>
                        </p>

                        {getCompetitorsCount(site.keywords) > 0 && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span className="font-medium">{getCompetitorsCount(site.keywords)}</span>
                            <span>Competitors</span>
                          </p>
                        )}
                      </div>
                    )}

                    {site.created_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Added: {new Date(site.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!site.isAnalyzing && site.keywords && (
                      <>
                        <Button
                          onClick={() => onViewKeywords(site.id)}
                          variant="outline"
                          size="sm"
                          className="cursor-pointer gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Keywords
                        </Button>

                        {getCompetitorsCount(site.keywords) > 0 && (
                          <Button
                            onClick={() => onViewCompetitors(site.id)}
                            variant="outline"
                            size="sm"
                            className="cursor-pointer gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                          >
                            <Users className="w-4 h-4" />
                            View Competitors
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      onClick={() => handleRemoveWebsite(site.id)}
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}