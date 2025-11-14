"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Trash2, ExternalLink, Users } from "lucide-react"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form state
  const [websiteName, setWebsiteName] = useState("")
  const [competitor1, setCompetitor1] = useState("")
  const [competitor2, setCompetitor2] = useState("")
  const [competitor3, setCompetitor3] = useState("")
  const [keyword1, setKeyword1] = useState("")
  const [keyword2, setKeyword2] = useState("")
  const [keyword3, setKeyword3] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleSubmitOnboarding = async () => {
    setIsSubmitting(true)
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.showToast({
          title: "Authentication Required",
          description: "Please log in to continue",
          type: "error",
        })
        setIsSubmitting(false)
        return
      }
  
      // Prepare onboarding data
      const onboardingData = {
        clientDomain: websiteName.trim(),
        competitors: [
          competitor1.trim(),
          competitor2.trim(),
          competitor3.trim()
        ],
        targetKeywords: [
          keyword1.trim(),
          keyword2.trim(),
          keyword3.trim()
        ],
        userId: user.id
      }
  
      console.log("Onboarding Data:", onboardingData)
  
      // Call onboarding API
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(onboardingData)
      })
  
      const data = await response.json()
  
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Onboarding failed')
      }
  
      console.log("✅ Onboarding successful:", data)
      
      // Close dialog
      setIsDialogOpen(false)
      
      // Reset form
      setWebsiteName("")
      setCompetitor1("")
      setCompetitor2("")
      setCompetitor3("")
      setKeyword1("")
      setKeyword2("")
      setKeyword3("")
      
      // Reload websites to show the new one
      await loadUserWebsites()
      
      // Show success toast
      toast.showToast({
        title: "Website Added Successfully!",
        description: `Found ${data.totalKeywords} keywords. 30 articles are being generated in the background.`,
        type: "success",
      })
      
    } catch (error) {
      console.error("Error during onboarding:", error)
      toast.showToast({
        title: "Failed to Add Website",
        description: error instanceof Error ? error.message : 'Unknown error',
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Validation: all fields must be filled
  const canProceed = 
    websiteName.trim() && 
    competitor1.trim() && 
    competitor2.trim() && 
    competitor3.trim() &&
    keyword1.trim() && 
    keyword2.trim() && 
    keyword3.trim()

  // Load websites on mount
  useEffect(() => {
    loadUserWebsites()
  }, [])

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Add Website</CardTitle>
          <CardDescription>Add your website with competitors and keywords to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            Add Your Website
          </Button>
        </CardContent>
      </Card>

      {/* Onboarding Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-xl shadow-lg border border-border/50 bg-white">
          <div className="px-10 py-8">
            <DialogHeader className="mb-6 text-center">
              <DialogTitle className="text-2xl text-center font-semibold text-gray-800">
                Tell us about your website
              </DialogTitle>
            </DialogHeader>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Website Name */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700 font-medium">
                  Website Name
                </Label>
                <Input
                  type="text"
                  placeholder="Enter your website name"
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                />
              </div>

              {/* Competitors */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700 font-medium">
                  Top 3 Competitors
                </Label>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Competitor 1"
                    value={competitor1}
                    onChange={(e) => setCompetitor1(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 2"
                    value={competitor2}
                    onChange={(e) => setCompetitor2(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 3"
                    value={competitor3}
                    onChange={(e) => setCompetitor3(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                </div>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700 font-medium">
                  Top 3 Keywords
                </Label>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Keyword 1"
                    value={keyword1}
                    onChange={(e) => setKeyword1(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 2"
                    value={keyword2}
                    onChange={(e) => setKeyword2(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 3"
                    value={keyword3}
                    onChange={(e) => setKeyword3(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end mt-8">
              <Button
                onClick={handleSubmitOnboarding}
                disabled={!canProceed || isSubmitting}
                className="px-6 bg-[#4a5fd8] hover:bg-[#3d52c7] text-white rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Setting up...
                  </div>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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