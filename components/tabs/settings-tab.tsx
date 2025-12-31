// components/tabs/settings-tab.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LoaderChevron } from "@/components/ui/LoaderChevron";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getUserPackage, getUserArticleLimit } from "@/lib/articleLimits";
import { supabase } from "@/lib/client";
import { createCheckout } from "@/lib/lemonSqueezy";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { getUser, updatePassword } from "@/lib/auth";
import Image from "next/image";
import { useToast } from "@/components/ui/toast";

export function SettingsTab() {
  const [activeTab, setActiveTab] = useState("publishing");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPackage, setUserPackage] = useState<
    "free" | "pro" | "premium" | null
  >(null);
  const [usage, setUsage] = useState({
    articles: 0,
    articlesLimit: 0,
    keywords: 0,
    keywordLimit: 0,
    monthlyPosts: 0,
    monthlyLimit: 0,
  });
  const [loading, setLoading] = useState(true);

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedPlanVariantId, setSelectedPlanVariantId] = useState<
    string | null
  >(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const toast = useToast();
  const [isDirty, setIsDirty] = useState(false);

  // Inline feedback for publishing automation and subtle save success state
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mock states
  const [apiKey, setApiKey] = useState("sk_live_51234567890abcdefghijklmnop");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const [settings, setSettings] = useState({
    autoPublish: false,
    publishingTime: "8:00 AM",
    publishingFrequency: "daily",
    queueSize: "5 posts",
    defaultLanguage: "english",
    writingTone: "professional",
    postLength: "1200",
    seoLevel: "balanced",
    notifyPostPublished: true,
    notifyDraftGenerated: true,
    notifyCompetitorScan: true,
    notifyWeeklyReport: false,
    notifyKeywordSynced: true,
  });

  // Notification option definitions
  const notificationOptions: {
    key: string;
    title: string;
    description: string;
  }[] = [
    {
      key: "notifyPostPublished",
      title: "Post Published",
      description: "Get notified when a post goes live",
    },
    {
      key: "notifyDraftGenerated",
      title: "Draft Generated",
      description: "Be notified when a new draft is ready to review",
    },
    {
      key: "notifyCompetitorScan",
      title: "Competitor Scan Complete",
      description: "Know when competitor analysis finishes",
    },
    {
      key: "notifyWeeklyReport",
      title: "Weekly Performance Summary",
      description: "Get a weekly overview of your content activity",
    },
    {
      key: "notifyKeywordSynced",
      title: "Keyword Synced",
      description: "Receive updates when new keywords are added",
    },
  ];

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: user } = await getUser();
      setCurrentUser(user);
      if (user?.id) {
        try {
          const pkg = await getUserPackage(user.id);
          setUserPackage(pkg);
        } catch (e) {
          // ignore
        }
      }
      setLoading(false);
    };
    getCurrentUser();
  }, []);

  //For dynamic domains in the connection tab
   const [connectedWebsites, setConnectedWebsites] = useState<
    Array<{ id: string; domain: string; status: "Active" | "Inactive" }>
  >([]);
  const [connectedWebsitesLoading, setConnectedWebsitesLoading] = useState(false);

  const loadConnectedWebsites = async (userId: string) => {
    setConnectedWebsitesLoading(true);
    try {
      const { data, error } = await supabase
        .from("websites")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Debug once to see the real column name holding the domain:
      // console.log("websites row sample:", data?.[0]);

      const mapped =
        (data ?? [])
          .map((w: any) => {
            const domain = String(
              w?.clientDomain ?? w?.domain ?? w?.website ?? w?.url ?? ""
            ).trim();

            if (!domain) return null;

            const isInactive =
              w?.is_active === false ||
              String(w?.status ?? "").toLowerCase() === "inactive" ||
              String(w?.status ?? "").toLowerCase() === "disabled";

            return {
              id: String(w.id),
              domain,
              status: isInactive ? "Inactive" : "Active",
            };
          })
          .filter(Boolean) as Array<{ id: string; domain: string; status: "Active" | "Inactive" }>;

      setConnectedWebsites(mapped);
    } catch (e) {
      console.warn("Failed to load connected websites", e);
      setConnectedWebsites([]);
    } finally {
      setConnectedWebsitesLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    loadConnectedWebsites(currentUser.id);
  }, [currentUser?.id]);

  // Fetch usage metrics
  useEffect(() => {
    const fetchUsage = async () => {
      if (!currentUser?.id) return;

      try {
        const artRes = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUser.id);
        const articlesCount = (artRes as any).count || 0;

        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const monthlyRes = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUser.id)
          .gte("created_at", start.toISOString());
        const monthlyCount = (monthlyRes as any).count || 0;

        const { data: sites } = await supabase
          .from("websites")
          .select("keywords")
          .eq("user_id", currentUser.id);

        let keywordsCount = 0;
        if (Array.isArray(sites)) {
          sites.forEach((s: any) => {
            const kw = s?.keywords;
            if (!kw) return;
            if (Array.isArray(kw)) keywordsCount += kw.length;
            else if (kw?.keywords && Array.isArray(kw.keywords))
              keywordsCount += kw.keywords.length;
          });
        }

        const articleLimit = getUserArticleLimit
          ? await getUserArticleLimit(currentUser.id)
          : 0;

        const keywordLimits: Record<string, number> = {
          free: 100,
          pro: 1000,
          premium: 5000,
        };
        const monthlyLimits: Record<string, number> = {
          free: 10,
          pro: 50,
          premium: 100,
        };
        const pkg = userPackage || "free";

        setUsage({
          articles: articlesCount,
          articlesLimit: articleLimit,
          keywords: keywordsCount,
          keywordLimit: keywordLimits[pkg],
          monthlyPosts: monthlyCount,
          monthlyLimit: monthlyLimits[pkg],
        });
      } catch (err) {
        console.warn("Failed to fetch usage", err);
      }
    };

    fetchUsage();
  }, [currentUser, userPackage]);

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  const maskApiKey = (key: string) => {
    const visible = key.slice(-8);
    return `${"*".repeat(key.length - 8)}${visible}`;
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Update inline feedback when publishing-related settings change
  useEffect(() => {
    const { autoPublish, publishingFrequency, publishingTime } = settings;
    if (autoPublish) {
      const freqLabel =
        publishingFrequency === "daily"
          ? "daily"
          : publishingFrequency === "weekly"
          ? "weekly"
          : "monthly";
      setInlineMessage(
        `Posts will publish ${freqLabel} at ${publishingTime}`
      );
    } else {
      setInlineMessage("Auto-publish is turned off");
    }
  }, [settings.autoPublish, settings.publishingFrequency, settings.publishingTime]);

  const loadUserSettings = async (
    websiteId?: string | null,
    userId?: string | null
  ) => {
    try {
      const uid = userId ?? currentUser?.id ?? null;
      const params = new URLSearchParams();
      if (websiteId) params.set("websiteId", String(websiteId));
      if (uid) params.set("userId", String(uid));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/user/settings${qs}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          setIsDirty(false);
          return;
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const uid = userId ?? currentUser?.id ?? null;
      const key = `user_settings${uid ? `_${uid}` : ""}${
        websiteId ? `_${websiteId}` : ""
      }`;
      const raw = localStorage.getItem(key);
      if (raw) {
        setSettings(JSON.parse(raw));
        setIsDirty(false);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSaveSettings = async (websiteId?: string | null) => {
    try {
      const body = {
        settings,
        websiteId: websiteId || null,
        userId: currentUser?.id ?? null,
      };
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.showToast({
          title: "Saved",
          description: "Settings saved",
          type: "success",
        });
        // subtle inline success state near the Save button
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsDirty(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to save");
    } catch (err: any) {
      try {
        const uid = currentUser?.id ?? null;
        const key = `user_settings${uid ? `_${uid}` : ""}${
          websiteId ? `_${websiteId}` : ""
        }`;
        localStorage.setItem(key, JSON.stringify(settings));
        toast.showToast({
          title: "Saved locally",
          description: "Settings saved to browser (server failed).",
          type: "info",
        });
        setIsDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch {
        toast.showToast({
          title: "Save failed",
          description: err?.message || "Could not save settings",
          type: "error",
        });
      }
    }
  };

  const handleResetSettings = async (websiteId?: string | null) => {
    await loadUserSettings(websiteId);
    toast.showToast({
      title: "Restored",
      description: "Settings reloaded",
      type: "success",
    });
  };

  useEffect(() => {
    loadUserSettings();
  }, []);

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordMessage("Please fill in all fields");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage("Passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters");
      return;
    }

    try {
      const { error } = await updatePassword(passwordData.newPassword);
      if (error) {
        setPasswordMessage("Failed to update password");
        return;
      }
      setPasswordMessage("Password updated successfully!");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordMessage(""), 2000);
    } catch (err) {
      setPasswordMessage("An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoaderChevron />
      </div>
    );
  }

  const tabs = [
    { id: "publishing", label: "Publishing" },
    { id: "connections", label: "Connections" },
    { id: "account", label: "Account" },
    { id: "billing", label: "Billing & Plan" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-2xl text-white font-medium">Settings</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Manage publishing, integrations, and your account
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 overflow-x-auto">
        <div className="flex gap-4 sm:gap-8 min-w-min">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-green-600 bg-[rgba(83,248,112,0.1)] border w-auto px-2 sm:px-4 py-2 rounded-2xl rounded-b-none"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Publishing Tab */}
        {activeTab === "publishing" && (
          <div className="border border-gray-800 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white mb-1">
                Publishing
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Control how and when your blog posts go live
              </p>
            </div>

            {/* Auto-publish Posts */}
            <div className="border border-gray-800 w-full sm:max-w-[654px] rounded-[10px]">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium p-2 sm:p-3 text-white">
                  Auto-publish posts
                </label>
                <div className="flex items-center justify-between gap-3 p-2 sm:p-3">
                  <p className="text-xs text-gray-500 flex-1">
                    When turned on, new posts will be published automatically
                    after generation
                  </p>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={settings.autoPublish}
                      onCheckedChange={(value) =>
                        handleSettingChange("autoPublish", value)
                      }
                    />
                  </div>
                </div>
                <div className="border w-full border-gray-800" />
              </div>

              {/* Publishing Schedule */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium p-2 sm:p-3 text-white">
                  Publishing Schedule
                </label>
                <p className="text-xs text-gray-500 p-2 sm:p-3 mb-3">
                  Posts will be published based on your selected schedule
                </p>
                <div className="flex px-2 sm:px-3">
                  <Select
                    value={settings.publishingFrequency}
                    onValueChange={(value) =>
                      handleSettingChange("publishingFrequency", value)
                    }
                  >
                    <SelectTrigger className="w-28 h-9 rounded-r-none border-r-0 border-gray-800 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={settings.publishingTime}
                    onValueChange={(value) =>
                      handleSettingChange("publishingTime", value)
                    }
                  >
                    <SelectTrigger className="w-28 h-9 rounded-l-none border-gray-800 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                      <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                      <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inlineMessage && (
                  <p className={`text-xs mt-2 p-2 ${settings.autoPublish ? "text-green-400" : "text-gray-500"}`}>
                    {inlineMessage}
                  </p>
                )}
              </div>

              {/* Queue Size */}
              <div className="py-2 sm:py-3 space-y-2">
                <div className="border border-gray-800" />

                <label className="text-xs sm:text-sm font-medium p-2 sm:p-3 text-white">
                  Queue size
                </label>
                <p className="text-xs text-gray-500 p-2 sm:p-3 mb-3">
                  Only this number of ready posts will be kept in the publishing
                  queue at a time
                </p>
                <Select
                  value={settings.queueSize}
                  onValueChange={(value) =>
                    handleSettingChange("queueSize", value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-28 h-9 ml-0 sm:ml-4 border-gray-800 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 post">1 post</SelectItem>
                    <SelectItem value="5 posts">5 posts</SelectItem>
                    <SelectItem value="10 posts">10 posts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 items-center">
              <Button
                className="h-8 sm:h-9 bg-transparent text-gray-300 border border-gray-600 text-xs sm:text-sm hover:bg-gray-800"
                onClick={() => handleResetSettings()}
                disabled={!isDirty}
              >
                Reset
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  className="h-8 sm:h-9 bg-green-600 hover:bg-green-700 text-white border-transparent text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleSaveSettings()}
                  disabled={!isDirty}
                >
                  Save changes
                </Button>
                {saveSuccess && (
                  <div className="flex items-center gap-1 text-green-400 text-xs">
                    <Check className="h-4 w-4" />
                    <span>Saved</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}

        {/* Notifications Tab */}

        {/* Account Tab */}

        {/* Billing Tab */}
        {activeTab === "connections" && (
          <div className="border border-gray-800 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white mb-1">
                Connections
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Choose where your posts should be published
              </p>
            </div>

            <div className="border border-gray-800 w-full sm:max-w-[654px] p-3 sm:p-4 rounded-[10px]">
              <h4 className="text-xs sm:text-sm font-medium text-white mb-3">
                Connected Websites
              </h4>
              <div className="space-y-2">
              {connectedWebsitesLoading ? (
                <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
              ) : connectedWebsites.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">
                  No websites connected yet.
                </div>
              ) : (
                connectedWebsites.map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-transparent rounded"
                  >
                    <span className="text-xs sm:text-sm text-gray-500">
                      {site.domain}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        site.status === "Active" ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {site.status}
                    </span>
                  </div>
                ))
              )}
            </div>
              <Button
                className="mt-4 h-9 text-[#5baf57] border-[#d0d0d0] bg-[#53f8701a] hover:bg-[#53f8701a]"
              >
                <Plus />
              </Button>
              <span className="ml-3 text-[#ffffffb3]">Connect Website</span>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === "account" && (
          <div className="border border-gray-800 rounded-lg p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <h3 className="text-sm sm:text-base font-medium text-white mb-1">Account</h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Manage your account details and preferences
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12">
              {/* Left Column */}
              <div className="space-y-0 border border-gray-800 rounded-lg">
                {/* Profile Section */}
                <div className="flex items-center justify-between p-2 sm:p-3 pb-4 border-b border-gray-800">
                  <div className="flex items-center p-1 sm:p-2 gap-3 sm:gap-4">
                    {currentUser?.user_metadata?.avatar_url ? (
                      <Image
                        src={currentUser.user_metadata.avatar_url}
                        alt={
                          currentUser.user_metadata?.full_name ||
                          currentUser.email ||
                          "avatar"
                        }
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-sm text-white">
                        {(
                          (currentUser?.user_metadata?.full_name ||
                            currentUser?.email ||
                            "U") as string
                        )[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-white">
                        {currentUser?.user_metadata?.full_name ||
                          currentUser?.email ||
                          "Your profile"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {userPackage
                          ? `${
                              userPackage.charAt(0).toUpperCase() +
                              userPackage.slice(1)
                            } Tier`
                          : "Free Tier"}
                      </p>
                    </div>
                  </div>
                  <button className="h-7 sm:h-8 px-2 sm:px-3 text-xs hover:bg-gray-800 text-white flex-shrink-0">
                    Upgrade
                  </button>
                </div>

                {/* Email Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 sm:p-3 sm:px-4 py-3 sm:py-4 border-b border-gray-800">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-white">Email</p>
                    <p className="text-xs text-gray-500">
                      {currentUser?.email || "admin@delani.pro"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs text-gray-500 hover:text-gray-900 hover:bg-transparent flex-shrink-0"
                  >
                    Change email
                  </Button>
                </div>

                {/* Password Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 sm:p-3 sm:px-4 py-3 sm:py-5 sm:pt-4">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-white">Password</p>
                    <p className="text-xs text-gray-600">••••••••</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs text-gray-500 hover:text-gray-900 hover:bg-transparent flex-shrink-0"
                  >
                    Change password
                  </Button>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4 sm:space-y-6">
                {/* API Access Status */}
                <div className="space-y-3 border rounded-[10px] border-gray-800 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-xs sm:text-sm font-medium text-white">
                        API access status
                      </h4>
                      <p className="text-xs text-gray-500">
                        Know when competitor analysis finishes
                      </p>
                    </div>
                    <Switch checked={true} className="flex-shrink-0" />
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="text"
                        value={showApiKey ? apiKey : maskApiKey(apiKey)}
                        disabled
                        className="h-9 bg-gray-100 border border-gray-200 text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCopyApiKey}
                        className="flex-1 h-9 bg-gray-900 hover:bg-gray-800 text-white text-sm"
                      >
                        {copiedApiKey ? (
                          <Check className="h-4 w-4 mr-2" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        {copiedApiKey ? "Copied" : "Show key"}
                      </Button>
                      <Button className="flex-1 h-9 bg-red-500 hover:bg-red-600 text-white text-sm">
                        Regenerate key
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="border border-gray-800 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white mb-1">
                Billing & Plan
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Manage your subscription settings and usage info
              </p>
            </div>
            <div className="border border-gray-800 w-full sm:max-w-[654px] rounded-lg">
              <div>
                <h4 className="text-xs sm:text-sm p-2 sm:p-3 sm:px-4 font-medium text-white mb-2 sm:mb-3">
                  Current plan
                </h4>
                <p className="text-xs sm:text-sm px-2 sm:px-4 text-gray-500">Free Tier</p>
              </div>
              <div className="border border-gray-800" />
              <div className="space-y-2 sm:space-y-3">
                <h4 className="text-xs sm:text-sm font-medium p-2 sm:p-4 text-white">
                  Usage summary
                </h4>
                <div className="space-y-2 text-xs sm:text-sm p-2 sm:px-4">
                  <div className="flex justify-between ">
                    <span className="text-gray-500">Websites</span>
                    <span className="text-gray-500">5 / 10</span>
                  </div>
                  {/* <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full w-1/2 bg-green-500 rounded" />
                </div> */}
                </div>
                <div className="space-y-2 text-sm p-2 px-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Keywords</span>
                    <span className="text-gray-500">25 / 100</span>
                  </div>
                  {/* <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full w-1/4 bg-blue-500 rounded" />
                </div> */}
                </div>
                <div className="space-y-2 text-sm p-2 px-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Monthly posts</span>
                    <span className="text-gray-500">8 / 20</span>
                  </div>
                  {/* <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full w-2/5 bg-purple-500 rounded" />
                </div> */}
                </div>
              </div>

              <div className="pt-3 sm:pt-4 p-2 sm:p-1 border-t border-gray-800 flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-0">
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-medium text-white px-2 sm:px-3 mb-1 sm:mb-2">
                    Subscription
                  </p>
                  <p className="text-xs text-gray-600 px-2 sm:px-3">
                    Upgrade your plan to see more features
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {userPackage !== "premium" ? (
                    <>
                      <Button
                        variant="outline"
                        className="h-8 sm:h-9 border-gray-200 bg-white text-xs sm:text-sm"
                        onClick={() => setIsPlanDialogOpen(true)}
                      >
                        Upgrade Plan
                      </Button>

                      <Dialog
                        open={isPlanDialogOpen}
                        onOpenChange={setIsPlanDialogOpen}
                      >
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Your Plan</DialogTitle>
                            <DialogDescription>
                              Choose a plan to upgrade your account. After
                              selecting, you'll be redirected to LemonSqueezy to
                              complete the purchase.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium">
                                Plan
                              </label>
                              <Select
                                onValueChange={(value) =>
                                  setSelectedPlanVariantId(value)
                                }
                              >
                                <SelectTrigger className="w-full h-10">
                                  <SelectValue placeholder="Select a plan" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    value={
                                      process.env
                                        ?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15 ||
                                      ""
                                    }
                                  >
                                    Pro — 15 articles
                                  </SelectItem>
                                  <SelectItem
                                    value={
                                      process.env
                                        ?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 ||
                                      ""
                                    }
                                  >
                                    Premium — 30 articles
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                onClick={() => setIsPlanDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                disabled={isCreatingCheckout}
                                onClick={async () => {
                                  if (!currentUser) {
                                    alert(
                                      "Please sign in to update your plan."
                                    );
                                    return setIsPlanDialogOpen(false);
                                  }
                                  if (!selectedPlanVariantId) {
                                    alert("Please select a plan.");
                                    return;
                                  }
                                  try {
                                    setIsCreatingCheckout(true);
                                    if (selectedPlanVariantId) {
                                      window.location.href =
                                        selectedPlanVariantId;
                                      return;
                                    }
                                    const checkout = await createCheckout(
                                      selectedPlanVariantId!,
                                      currentUser.email,
                                      currentUser.user_metadata?.full_name ||
                                        currentUser.name,
                                      currentUser.id
                                    );
                                    if (checkout?.url) {
                                      window.open(checkout.url, "_blank");
                                      setIsPlanDialogOpen(false);
                                      setTimeout(async () => {
                                        try {
                                          const pkg = await getUserPackage(
                                            currentUser.id
                                          );
                                          setUserPackage(pkg);
                                        } catch (e) {}
                                      }, 5000);
                                    } else {
                                      alert(
                                        "Failed to create checkout session. Please try again."
                                      );
                                    }
                                  } catch (err: any) {
                                    console.error(
                                      "Create checkout failed",
                                      err
                                    );
                                    const message =
                                      err?.message ||
                                      err?.error ||
                                      "Failed to create checkout session. You can try the public checkout URL instead.";
                                    const proVar =
                                      process.env
                                        .NEXT_PUBLIC_LEMON_VARIANT_PRO ||
                                      "1087280";
                                    const premVar =
                                      process.env
                                        .NEXT_PUBLIC_LEMON_VARIANT_PREMIUM ||
                                      "1087281";
                                    const fallbackUrl15 =
                                      process.env
                                        .NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15;
                                    const fallbackUrl30 =
                                      process.env
                                        .NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30;
                                    let fallbackUrl: string | null = null;
                                    const selected = String(
                                      selectedPlanVariantId
                                    );
                                    if (
                                      selected === String(proVar) &&
                                      fallbackUrl15
                                    )
                                      fallbackUrl = fallbackUrl15;
                                    if (
                                      selected === String(premVar) &&
                                      fallbackUrl30
                                    )
                                      fallbackUrl = fallbackUrl30;
                                    const silverVar =
                                      process.env
                                        .NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY ||
                                      "";
                                    if (
                                      !fallbackUrl &&
                                      selected === String(silverVar) &&
                                      fallbackUrl15
                                    )
                                      fallbackUrl = fallbackUrl15;

                                    if (fallbackUrl) {
                                      if (
                                        confirm(
                                          `${message}\n\nWould you like to open the public checkout URL?`
                                        )
                                      ) {
                                        window.open(fallbackUrl, "_blank");
                                        setIsPlanDialogOpen(false);
                                      }
                                    } else {
                                      alert(message);
                                    }
                                  } finally {
                                    setIsCreatingCheckout(false);
                                  }
                                }}
                              >
                                Proceed
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-8 sm:h-9 border-gray-200 bg-white text-xs sm:text-sm"
                      disabled
                    >
                      Upgraded
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-8 sm:h-9 border-gray-200 bg-white text-xs sm:text-sm"
                  >
                    View Invoices
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
