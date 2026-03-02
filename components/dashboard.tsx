"use client";

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

const selectedWebsiteStorageKey = "selected-website-id";

const readSelectedWebsiteId = () => {
  try {
    return sessionStorage.getItem(selectedWebsiteStorageKey);
  } catch {
    return null;
  }
};

const writeSelectedWebsiteId = (websiteId: string) => {
  try {
    sessionStorage.setItem(selectedWebsiteStorageKey, websiteId);
  } catch {
    // ignore storage failures
  }
};

export function Dashboard({
  onLogout,
  userEmail,
  userAvatar,
  children,
}: DashboardProps) {
  const pathname = usePathname() || "";
  const [activeTab, setActiveTab] = useState<
    "analyze" | "keywords" | "competitors" | "articles" | "index" | "settings"
  >(
    pathname.includes("/dashboard/articles")
      ? "articles"
      : pathname.includes("/dashboard/keywords")
      ? "keywords"
      : pathname.includes("/dashboard/competitors")
      ? "competitors"
      : pathname.includes("/dashboard/settings")
      ? "settings"
      : "analyze"
  );
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    null
  );
  const [localAvatar, setLocalAvatar] = useState<string | null>(
    userAvatar ?? null
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Restore last selected website across page navigations
  useEffect(() => {
    if (selectedWebsiteId) return;
    const stored = readSelectedWebsiteId();
    if (stored) setSelectedWebsiteId(stored);
  }, [selectedWebsiteId]);

  // Persist whenever selection changes
  useEffect(() => {
    if (!selectedWebsiteId) return;
    writeSelectedWebsiteId(selectedWebsiteId);
  }, [selectedWebsiteId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="backdrop-blur-sm sticky top-0 z-50 border-b bg-background/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-16">
            <div className="w-full h-full rounded-xl flex items-center justify-center">
              <Image src="/newlogo.png" alt="" width={71.4} height={71.4} className="hidden lg:block" />
              <Image src="/newlogo.png" alt="" width={34} height={34} className="block lg:hidden" />
            </div>

            {/* DESKTOP NAV (UNCHANGED) */}
            <div
              className="
    hidden lg:flex gap-4 p-1.5 rounded-full
    dark:bg-linear-to-b
    dark:from-[rgba(46,152,57,0.38)]
    dark:via-[rgba(26,69,26,1)]
    dark:to-[rgba(4,35,13,1)]
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
              {/* <Link
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
              </Link> */}
              {/* NEW: Competitors Tab */}
              {/* <Link
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
              </Link> */}
              <Link
                href="/dashboard/articles"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${
      pathname.includes("/dashboard/articles") || pathname === "/dashboard"
        ? "bg-green-500 text-black"
        : "text-[#53F870] hover:text-green-600 hover:bg-green-100"
    }
  `}
              >
                Articles
              </Link>
              <Link
                href="/dashboard/index"
                className={`cursor-pointer px-6.5 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap rounded-full
    ${
      pathname.includes("/dashboard/index")
        ? "bg-green-500 text-black"
        : "text-[#53F870] hover:text-green-600 hover:bg-green-100"
    }
  `}
              >
                Index
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

          {/* RIGHT */}
          <div
            className="hidden lg:flex items-center gap-4 p-1.5 rounded-full
      text-[#53F870]
      dark:bg-linear-to-b
      dark:from-[rgba(46,152,57,0.38)]
      dark:via-[rgba(26,69,26,1)]
      dark:to-[rgba(4,35,13,1)]
      border border-transparent
      dark:border-[#2E9839]
    "
          >
            {userEmail && (
              <ProfileDropdown
                userEmail={userEmail}
                userAvatar={localAvatar ?? userAvatar}
                onLogout={onLogout}
              />
            )}
          </div>

          {/* MOBILE HAMBURGER */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden text-[#53F870]"
          >
            <svg
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 7h20M4 14h20M4 21h20" />
            </svg>
          </button>
        </div>

        {/* MOBILE MENU OVERLAY */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 h-[1880px] w-screen lg:hidden bg-[#0d0d0d] backdrop-blur-xl">
            <div className="flex flex-col h-full bg-[#0d0d0d]">
              {/* TOP */}
              <div className="flex items-center bg-[#0d0d0d] justify-between px-4 py-4">
                <Image src="/newlogo.png" alt="" width={36} height={36} className="flex lg:hidden" />

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#53F870]"
                >
                  <svg
                    width="28"
                    height="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 6l16 16M6 22L22 6" />
                  </svg>
                </button>
              </div>

              {/* NAV LINKS */}
              <nav className="mt-8 w-full h-full px-4 py-4 flex flex-col bg-[#0d0d0d] space-y-6 text-[#53F870] text-[15px]">
                <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard/analyze">Dashboard</Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard/keywords">Keywords</Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard/competitors">Competitors</Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard/articles">Articles</Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard/index">Index</Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard/settings">Settings</Link>
                {/* PROFILE */}
              <div className=" w-max flex items-center gap-4 py-1.5 rounded-full text-[#53F870] dark:bg-linear-to-b dark:from-[rgba(46,152,57,0.38)] dark:via-[rgba(26,69,26,1)] dark:to-[rgba(4,35,13,1)] border border-transparent dark:border-[#2E9839] ">
                {" "}
                {userEmail && (
                  <ProfileDropdown
                    userEmail={userEmail}
                    userAvatar={localAvatar ?? userAvatar}
                    onLogout={onLogout}
                  />
                )}{" "}
              </div>
              </nav>
            </div>
          </div>
        )}
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
