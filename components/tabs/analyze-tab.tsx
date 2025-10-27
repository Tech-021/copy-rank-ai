"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2 } from "lucide-react"
import { supabase } from "@/lib/client"

interface Website {
  id: string
  url: string
  topic: string
  keywords: number
  isAnalyzing?: boolean
  user_id?: string
  created_at?: string
}

interface ApiResponse {
  ok: boolean
  niche?: {
    niche: string
    confidence: number
    keywords?: string[]
    raw?: any
  }
  error?: {
    code: string
    message: string
  }
}

export function AnalyzeTab() {
  const [websites, setWebsites] = useState<Website[]>([])
  const [urlInput, setUrlInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeWebsite = async (url: string): Promise<{ topic: string }> => {
    try {
      const response = await fetch('https://v0-topic-detection-app-tedt-bgis50sz0.vercel.app/api/scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data: ApiResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || 'Analysis failed')
      }

      const topic = data.niche?.niche || "General"
      return { topic }
    } catch (error) {
      console.error('API call failed:', error)
      throw error
    }
  }

  const saveWebsiteToDB = async (website: Omit<Website, 'id' | 'created_at'>): Promise<string> => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await supabase
        .from('websites')
        .insert([
          {
            url: website.url,
            topic: website.topic,
            keywords: website.keywords,
            user_id: user.id,
          }
        ])
        .select()
        .single()

      if (error) {
        throw error
      }

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

  const handleAddWebsite = async () => {
    if (!urlInput.trim()) return

    setIsAnalyzing(true)
    const tempId = Math.random().toString()

    // Add website with analyzing state
    const newWebsite: Website = {
      id: tempId,
      url: urlInput,
      topic: "Detecting...",
      keywords: 0,
      isAnalyzing: true,
    }
    setWebsites([...websites, newWebsite])
    setUrlInput("")

    try {
      // Call the actual API
      const { topic } = await analyzeWebsite(urlInput)

      // Save to database
      const dbId = await saveWebsiteToDB({
        url: urlInput,
        topic: topic,
        keywords: Math.floor(Math.random() * 50) + 10, // Generate keyword count
        isAnalyzing: false,
      })

      // Update website with detected topic and real ID
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId
            ? {
                ...site,
                id: dbId,
                topic,
                isAnalyzing: false,
              }
            : site,
        ),
      )
    } catch (error) {
      console.error("Error analyzing website:", error)
      
      // Show error message to user
      const errorMessage = error instanceof Error ? error.message : "Analysis failed"
      
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId
            ? {
                ...site,
                topic: `Error: ${errorMessage}`,
                keywords: 0,
                isAnalyzing: false,
              }
            : site,
        ),
      )
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
    } catch (error) {
      console.error('Error deleting website:', error)
      alert('Failed to delete website. Please try again.')
    }
  }

  // Load websites on component mount
  useState(() => {
    loadUserWebsites()
  })

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
              placeholder="https://example.com"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
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
                    {site.created_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Added: {new Date(site.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
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
};