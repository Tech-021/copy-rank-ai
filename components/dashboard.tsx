"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, LogOut } from "lucide-react"
import { AnalyzeTab } from "@/components/tabs/analyze-tab"
import { KeywordsTab } from "@/components/tabs/keywords-tab"
import { ArticlesTab } from "@/components/tabs/articles-tab"
import { SettingsTab } from "@/components/tabs/settings-tab"

interface DashboardProps {
  onLogout: () => void
  userEmail?: string
}

export function Dashboard({ onLogout, userEmail }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"analyze" | "keywords" | "articles" | "settings">("analyze")
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">Viral SEO AI</span>
          </div>
          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{userEmail.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm text-muted-foreground hidden sm:inline">{userEmail}</span>
              </div>
            )}
            <Button onClick={onLogout} variant="outline" className="cursor-pointer border-border/40 bg-transparent gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border/40 overflow-x-auto">
          <button
            onClick={() => setActiveTab("analyze")}
            className={`cursor-pointer px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "analyze"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Analyze Your Website
          </button>
          <button>Add Your Competitors</button>
          <button
            onClick={() => setActiveTab("keywords")}
            className={`cursor-pointer px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "keywords"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Keywords
          </button>
          <button
            onClick={() => setActiveTab("articles")}
            className={`cursor-pointer px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "articles"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Articles
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`cursor-pointer px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === "settings"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "analyze" && (
          <AnalyzeTab 
            onViewKeywords={(websiteId) => {
              setSelectedWebsiteId(websiteId)
              setActiveTab("keywords")
            }} 
          />
        )}
        {activeTab === "keywords" && (
          <KeywordsTab websiteId={selectedWebsiteId} />
        )}
        {activeTab === "articles" && <ArticlesTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>
    </div>
  )
}