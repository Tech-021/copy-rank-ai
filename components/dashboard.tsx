"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { AnalyzeTab } from "@/components/tabs/analyze-tab";
import { KeywordsTab } from "@/components/tabs/keywords-tab";
import { ArticlesTab } from "@/components/tabs/articles-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";
import { CompetitorsTab } from "@/components/tabs/competitors-tab"; // NEW: Import CompetitorsTab
import Image from "next/image";
import { getUser } from "@/lib/auth";
import { ProfileDropdown } from "@/components/profile-dropdown";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardProps {
  onLogout: () => void;
  userEmail?: string;
  userAvatar?: string | null;
  children?: React.ReactNode;
}

export function Dashboard({ onLogout, userEmail, userAvatar, children }: DashboardProps) {
  const pathname = usePathname() || "";
  const [activeTab, setActiveTab] = useState<
    "analyze" | "keywords" | "competitors" | "articles" | "settings"
  >(pathname.includes("/dashboard/articles")
    ? "articles"
    : pathname.includes("/dashboard/keywords")
    ? "keywords"
    : pathname.includes("/dashboard/competitors")
    ? "competitors"
    : pathname.includes("/dashboard/settings")
    ? "settings"
    : "analyze");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    null
  );
  const [localAvatar, setLocalAvatar] = useState<string | null>(
    userAvatar ?? null
  );

  // Debug: Log props received
  console.log("=== DASHBOARD COMPONENT PROPS ===");
  console.log("userEmail:", userEmail);
  console.log("userAvatar:", userAvatar);
  console.log("=== END PROPS ===");

  // Fallback: if parent didn't pass an avatar, fetch user and try to get it
  useEffect(() => {
    async function fetchAvatarIfMissing() {
      if (localAvatar) return;
      try {
        const { data: user } = await getUser();
        if (!user) return;

        const avatarFromMetadata = user.user_metadata?.avatar_url;
        const pictureFromMetadata = user.user_metadata?.picture;
        const avatarFromIdentity =
          user.identities?.[0]?.identity_data?.avatar_url;
        const pictureFromIdentity =
          user.identities?.[0]?.identity_data?.picture;

        const avatar =
          avatarFromMetadata ||
          pictureFromMetadata ||
          avatarFromIdentity ||
          pictureFromIdentity ||
          null;
        if (avatar) setLocalAvatar(avatar);
      } catch (err) {
        console.error("Dashboard: failed to fetch avatar fallback", err);
      }
    }
    fetchAvatarIfMissing();
  }, [localAvatar]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="backdrop-blur-sm sticky top-0 z-50 border-b bg-background/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center justify-center gap-16">
            <div className="w-full h-full rounded-xl bg-primary flex items-center justify-center">
              <Image src="/logo.png" alt="" width={50} height={50} />
            </div>
            <div
              className="
    flex gap-4 p-1.5 rounded-full
    bg-[rgb(247,247,247)]
    dark:bg-gradient-to-b
    dark:from-[#2E9839]
    dark:to-[#04230D]
    border border-transparent
    dark:border-[#2E9839]
  "
            >
              <Link
                href="/dashboard/analyze"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${
      pathname.includes("/dashboard/analyze") || pathname === "/dashboard"
        ? "bg-green-500 text-black"
        : "text-[#53F870] hover:text-green-600 hover:bg-green-100"
    }
  `}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/articles"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${pathname.includes("/dashboard/articles") ? "bg-green-500 text-black" : "text-[#53F870]"}
  `}
              >
                Blogs
              </Link>
              <Link
                href="/dashboard/keywords"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${
      pathname.includes("/dashboard/keywords")
        ? "bg-green-500 text-black"
        : "text-[#53F870] hover:text-green-600 hover:bg-green-100"
    }
  `}
              >
                Keywords
              </Link>
              {/* NEW: Competitors Tab */}
              <Link
                href="/dashboard/competitors"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${
      pathname.includes("/dashboard/competitors")
        ? "bg-green-500 text-black"
        : "text-[#53F870] hover:text-green-600 hover:bg-green-100"
    }
  `}
              >
                Competitors
              </Link>
              <Link
                href="/dashboard/settings"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${
      pathname.includes("/dashboard/settings")
        ? "bg-green-500 text-black"
        : "text-[#53F870] hover:text-green-600 hover:bg-green-100"
    }
  `}
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userEmail && (
              <ProfileDropdown
                userEmail={userEmail}
                userAvatar={localAvatar ?? userAvatar}
                onLogout={onLogout}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* If `children` are provided (app router nested pages), render them. Otherwise fallback to old tab behaviour. */}
        {children ? (
          children
        ) : (
          <>
            {activeTab === "analyze" && (
              <AnalyzeTab
                onViewKeywords={(websiteId) => {
                  setSelectedWebsiteId(websiteId);
                  setActiveTab("keywords");
                }}
                onViewCompetitors={(websiteId) => {
                  setSelectedWebsiteId(websiteId);
                  setActiveTab("competitors");
                }}
              />
            )}
            {activeTab === "keywords" && (
              <KeywordsTab websiteId={selectedWebsiteId ?? undefined} />
            )}
            {activeTab === "competitors" && (
              <CompetitorsTab websiteId={selectedWebsiteId ?? null} />
            )}
            {activeTab === "articles" && <ArticlesTab />}
            {activeTab === "settings" && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
}
