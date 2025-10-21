"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2 } from "lucide-react"

interface Website {
  id: string
  url: string
  topic: string
  keywords: number
  isAnalyzing?: boolean
}

export function AnalyzeTab() {
  const [websites, setWebsites] = useState<Website[]>([])
  const [urlInput, setUrlInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const detectTopic = async (url: string): Promise<string> => {
    // Simulate API call to detect topic using AI
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const topics = [
      "Technology & SaaS",
      "E-commerce & Retail",
      "Healthcare & Wellness",
      "Finance & Fintech",
      "Education & Learning",
      "Travel & Hospitality",
    ]
    return topics[Math.floor(Math.random() * topics.length)]
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
      // Simulate topic detection
      const detectedTopic = await detectTopic(urlInput)

      // Update website with detected topic
      setWebsites((prev) =>
        prev.map((site) =>
          site.id === tempId
            ? {
                ...site,
                topic: detectedTopic,
                keywords: Math.floor(Math.random() * 50) + 10,
                isAnalyzing: false,
              }
            : site,
        ),
      )
    } catch (error) {
      console.error("Error analyzing website:", error)
      setWebsites((prev) => prev.filter((site) => site.id !== tempId))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRemoveWebsite = (id: string) => {
    setWebsites(websites.filter((site) => site.id !== id))
  }

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
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{site.keywords}</p>
                      <p className="text-xs text-muted-foreground">keywords found</p>
                    </div>
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
