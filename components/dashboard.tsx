"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, LogOut } from "lucide-react"
import { AnalyzeTab } from "@/components/tabs/analyze-tab"
import { KeywordsTab } from "@/components/tabs/keywords-tab"
import { ArticlesTab } from "@/components/tabs/articles-tab"
import { SettingsTab } from "@/components/tabs/settings-tab"
import { CompetitorsTab } from "@/components/tabs/competitors-tab" // NEW: Import CompetitorsTab
import Image from "next/image"
import { getUser } from "@/lib/auth"

interface DashboardProps {
  onLogout: () => void
  userEmail?: string
  userAvatar?: string | null
}

export function Dashboard({ onLogout, userEmail, userAvatar }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"analyze" | "keywords" | "competitors" | "articles" | "settings">("analyze") // NEW: Added competitors
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null)
  const [localAvatar, setLocalAvatar] = useState<string | null>(userAvatar ?? null)

  // Debug: Log props received
  console.log("=== DASHBOARD COMPONENT PROPS ===")
  console.log("userEmail:", userEmail)
  console.log("userAvatar:", userAvatar)
  console.log("=== END PROPS ===")

  // Fallback: if parent didn't pass an avatar, fetch user and try to get it
  useEffect(() => {
    async function fetchAvatarIfMissing() {
      if (localAvatar) return
      try {
        const { data: user } = await getUser()
        if (!user) return

        const avatarFromMetadata = user.user_metadata?.avatar_url
        const pictureFromMetadata = user.user_metadata?.picture
        const avatarFromIdentity = user.identities?.[0]?.identity_data?.avatar_url
        const pictureFromIdentity = user.identities?.[0]?.identity_data?.picture

        const avatar = avatarFromMetadata || pictureFromMetadata || avatarFromIdentity || pictureFromIdentity || null
        if (avatar) setLocalAvatar(avatar)
      } catch (err) {
        console.error("Dashboard: failed to fetch avatar fallback", err)
      }
    }
    fetchAvatarIfMissing()
  }, [localAvatar])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center justify-center gap-16">
            <div className="w-full h-full rounded-xl bg-primary flex items-center justify-center">
              <Image src="/logo.png" alt="" width={50} height={50} />
            </div>
            <div className="flex gap-4 bg-[rgb(247,247,247)] p-1.5 rounded-full">
          <button
            onClick={() => setActiveTab("analyze")}
            className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
              activeTab === "analyze"
                ? "text-white bg-black rounded-full"
                : "text-[#00000080]"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("articles")}
            className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
              activeTab === "articles"
                ? "text-white bg-black rounded-full"
                : "text-[#00000080] "
            }`}
          >
            Blogs
          </button>
          <button
            onClick={() => setActiveTab("keywords")}
            className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
              activeTab === "keywords"
                ? "text-white bg-black rounded-full"
                : "text-[#00000080] "
            }`}
          >
            Keywords
          </button>
          {/* NEW: Competitors Tab */}
          <button
            onClick={() => setActiveTab("competitors")}
            className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
              activeTab === "competitors"
                ? "text-white bg-black rounded-full"
                : "text-[#00000080] "
            }`}
          >
            Add Your Competitors
          </button>
          <button
            onClick={() => setActiveTab("settings")}
           className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
              activeTab === "settings"
                ? "text-white bg-black rounded-full"
                : "text-[#00000080] "
            }`}
          >
            Settings
          </button>
        </div>
          </div>
          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="flex items-center border rounded-full py-1.5 pl-6 pr-1.5  gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">{userEmail}</span>
                {(() => {
                  const avatarToShow = localAvatar ?? userAvatar ?? "/profileimg.png"
                  const isExternal = typeof avatarToShow === "string" && avatarToShow.startsWith("http")
                  if (isExternal) {
                    return (
                      // Use native img for external URLs to avoid Next/Image domain issues in dev
                      <img
                        src={avatarToShow}
                        alt="Profile"
                        width={50}
                        height={50}
                        className="rounded-full object-cover"
                      />
                    )
                  }

                  return (
                    <Image
                      src={avatarToShow}
                      alt="Profile"
                      width={50}
                      height={50}
                      className="rounded-full object-cover"
                    />
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}

        {/* Tab Content */}
        {activeTab === "analyze" && (
          <AnalyzeTab 
            onViewKeywords={(websiteId) => {
              setSelectedWebsiteId(websiteId)
              setActiveTab("keywords")
            }}
            onViewCompetitors={(websiteId) => { // NEW: Add onViewCompetitors prop
              setSelectedWebsiteId(websiteId)
              setActiveTab("competitors")
            }} 
          />
        )}
        {activeTab === "keywords" && (
          <KeywordsTab websiteId={selectedWebsiteId} />
        )}
        {/* NEW: Competitors Tab Content */}
        {activeTab === "competitors" && (
          <CompetitorsTab websiteId={selectedWebsiteId} />
        )}
        {activeTab === "articles" && <ArticlesTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>
    </div>
  )
}