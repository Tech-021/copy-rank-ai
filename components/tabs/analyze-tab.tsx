"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2, ExternalLink } from "lucide-react"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
interface AnalyzeTabProps {
  onViewKeywords: (websiteId: string) => void;
}

interface Website {
  id: string
  url: string
  topic: string
  keywords: number
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
  totalKeywords: number
  error?: string
}

export function AnalyzeTab({ onViewKeywords }: AnalyzeTabProps) {
  const [websites, setWebsites] = useState<Website[]>([])
  const [urlInput, setUrlInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [urlError, setUrlError] = useState("")
  const toast = useToast()

  // URL validation and formatting (keep your existing function)
  const validateAndFormatUrl = (input: string): { isValid: boolean; formattedUrl: string; error?: string } => {
    let url = input.trim()
    
    // Remove any extra spaces
    url = url.replace(/\s+/g, '')
    
    // Check if empty
    if (!url) {
      return { isValid: false, formattedUrl: "", error: "URL is required" }
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    // Add .com if no TLD is present
    if (!url.includes('.') && !url.includes('localhost')) {
      const lastSlashIndex = url.lastIndexOf('/')
      const domainPart = lastSlashIndex > 6 ? url.substring(8, lastSlashIndex) : url.substring(8)
      
      if (!domainPart.includes('.')) {
        url = url.replace(/\/$/, '') + '.com/'
      }
    }

    try {
      const urlObj = new URL(url)
      
      // Validate protocol
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return { isValid: false, formattedUrl: url, error: "URL must start with http:// or https://" }
      }

      // Validate hostname
      if (!urlObj.hostname) {
        return { isValid: false, formattedUrl: url, error: "Invalid domain name" }
      }

      return { isValid: true, formattedUrl: urlObj.toString() }

    } catch (error) {
      return { 
        isValid: false, 
        formattedUrl: url, 
        error: "Please enter a valid URL (e.g., example.com or https://example.com)" 
      }
    }
  }

  const handleUrlInputChange = (value: string) => {
    setUrlInput(value)
    // Clear error when user starts typing
    if (urlError && value.trim()) {
      setUrlError("")
    }
  }

  // STEP 1: Call scraper API to get topic/niche
  const getWebsiteTopic = async (url: string): Promise<string> => {
    try {
      const response = await fetch('/api/scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data: ScraperResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || 'Scraping failed')
      }

      const topic = data.niche?.niche || "General"
      return topic
    } catch (error) {
      console.error('Scraper API call failed:', error)
      throw error
    }
  }

  // STEP 2: Call keywords API with the topic
  const getKeywordsForTopic = async (topic: string): Promise<any[]> => {
    try {
      const response = await fetch('/api/keyword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
      })

      const data: KeywordsResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Keywords API failed')
      }

      return data.keywords || []
    } catch (error) {
      console.error('Keywords API call failed:', error)
      throw error
    }
  }

  // Save website to database
  const saveWebsiteToDB = async (url: string, topic: string, keywords: any[]): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error("User not authenticated")
    }

    console.log(`💾 Saving ${keywords.length} keywords to database as array...`);

    const { data, error } = await supabase
      .from('websites')
      .insert([
        {
          url: url,
          topic: topic,
          keywords: keywords, // Now storing the full array of keyword objects
          user_id: user.id,
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error);
      throw error
    }

    console.log('✅ Successfully saved website with full keyword data');
    return data.id
  } catch (error) {
    console.error('Error saving to database:', error)
    throw error
  }
}

  const loadUserWebsites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .from('websites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading websites:', error)
        return
      }

      if (data) {
        setWebsites(data)
      }
    } catch (error) {
      console.error('Error loading websites:', error)
    }
  }

  const deleteWebsiteFromDB = async (id: string) => {
    try {
      const { error } = await supabase
        .from('websites')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting website:', error)
      throw error
    }
  }

  // MAIN FUNCTION: Chain both APIs properly
  const handleAddWebsite = async () => {
    // Validate URL first
    const validation = validateAndFormatUrl(urlInput)
    
    if (!validation.isValid) {
      setUrlError(validation.error || "Invalid URL")
      return
    }

    const formattedUrl = validation.formattedUrl

    setIsAnalyzing(true)
    const tempId = Math.random().toString()

    // Add website with analyzing state
    const newWebsite: Website = {
      id: tempId,
      url: formattedUrl,
      topic: "Detecting topic...",
      keywords: 0,
      isAnalyzing: true,
    }
    setWebsites([...websites, newWebsite])
    setUrlInput("")

    try {
      // STEP 1: Get topic from scraper API
      console.log("🔍 Step 1: Getting website topic...")
      const topic = await getWebsiteTopic(formattedUrl)
      
      // Update UI with detected topic
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId
            ? { ...site, topic: `Getting keywords for: ${topic}` }
            : site
        )
      )

      // STEP 2: Get keywords for the detected topic
      console.log("🔍 Step 2: Getting keywords for topic:", topic)
      const keywords = await getKeywordsForTopic(topic)

      // STEP 3: Save everything to database
      console.log("💾 Step 3: Saving to database...")
      const dbId = await saveWebsiteToDB(formattedUrl, topic, keywords)

      // Final UI update with real data
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId
            ? {
                ...site,
                id: dbId,
                topic: topic,
                keywords: keywords.length,
                isAnalyzing: false,
              }
            : site,
        ),
      )

      // Show success toast
      toast.showToast({
        title: "Analysis Complete!",
        description: `Found ${keywords.length} keywords for "${topic}"`,
        type: "success"
      })

    } catch (error) {
      console.error("Error analyzing website:", error)
      
      // Show error message to user
      const errorMessage = error instanceof Error ? error.message : "Analysis failed"
      
      // Remove the failed website from UI after a short delay
      setTimeout(() => {
        setWebsites((prev) => prev.filter((site) => site.id !== tempId))
      }, 500)

      // Show error toast
      toast.showToast({
        title: "Analysis Failed",
        description: `Failed to analyze ${formattedUrl}: ${errorMessage}`,
        type: "error"
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRemoveWebsite = async (id: string) => {
    try {
      // Remove from database
      await deleteWebsiteFromDB(id)
      
      // Remove from local state
      setWebsites(websites.filter((site) => site.id !== id))

      // Show success toast
      toast.showToast({
        title: "Website Removed",
        description: "Website has been removed from your list",
        type: "success"
      })

    } catch (error) {
      console.error('Error deleting website:', error)
      
      // Show error toast
      toast.showToast({
        title: "Delete Failed",
        description: "Failed to remove website. Please try again.",
        type: "error"
      })
    }
  }

  // Load websites on component mount
  useEffect(() => {
    loadUserWebsites()
  }, [])

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Add Website</CardTitle>
          <CardDescription>Enter your website URL to analyze its topic and discover keywords</CardDescription>
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
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
          {urlError && (
            <p className="text-sm text-destructive">{urlError}</p>
          )}
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
          <p className="text-sm text-muted-foreground">
            Keywords: {Array.isArray(site.keywords) ? site.keywords.length : site.keywords || 0} found
          </p>
          {site.created_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Added: {new Date(site.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!site.isAnalyzing && (
            <Button
              onClick={() => onViewKeywords(site.id)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Keywords
            </Button>
          )}
          <Button
            onClick={() => handleRemoveWebsite(site.id)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
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