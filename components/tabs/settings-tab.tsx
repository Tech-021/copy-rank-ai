// components/tabs/settings-tab.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  const [userPackage, setUserPackage] = useState<"free" | "pro" | "premium" | null>(null);
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
  const [selectedPlanVariantId, setSelectedPlanVariantId] = useState<string | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const toast = useToast();
  const [isDirty, setIsDirty] = useState(false);

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

  // Notification option definitions (used to render the Notifications tab dynamically)
  const notificationOptions: { key: string; title: string; description: string }[] = [
    { key: "notifyPostPublished", title: "Post Published", description: "Get notified when a post goes live" },
    { key: "notifyDraftGenerated", title: "Draft Generated", description: "Be notified when a new draft is ready to review" },
    { key: "notifyCompetitorScan", title: "Competitor Scan Complete", description: "Know when competitor analysis finishes" },
    { key: "notifyWeeklyReport", title: "Weekly Performance Summary", description: "Get a weekly overview of your content activity" },
    { key: "notifyKeywordSynced", title: "Keyword Synced", description: "Receive updates when new keywords are added" },
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

  // fetch usage metrics when we have a user or their package
  useEffect(() => {
    const fetchUsage = async () => {
      if (!currentUser?.id) return;

      try {
        // articles total
        const artRes = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUser.id);
        const articlesCount = (artRes as any).count || 0;

        // articles this month
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const monthlyRes = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUser.id)
          .gte("created_at", start.toISOString());
        const monthlyCount = (monthlyRes as any).count || 0;

        // keywords across all websites
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
            else if (kw?.keywords && Array.isArray(kw.keywords)) keywordsCount += kw.keywords.length;
          });
        }

        // compute limits
        const articleLimit = getUserArticleLimit
          ? await getUserArticleLimit(currentUser.id)
          : 0;

        const keywordLimits: Record<string, number> = { free: 100, pro: 1000, premium: 5000 };
        const monthlyLimits: Record<string, number> = { free: 10, pro: 50, premium: 100 };
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
        // ignore usage errors
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

  // Load and save settings (API first, fallback to localStorage)
  const loadUserSettings = async (websiteId?: string | null, userId?: string | null) => {
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
      // ignore and fallback to localStorage
    }

    try {
      const uid = userId ?? currentUser?.id ?? null;
      const key = `user_settings${uid ? `_${uid}` : ""}${websiteId ? `_${websiteId}` : ""}`;
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
      const body = { settings, websiteId: websiteId || null, userId: currentUser?.id ?? null };
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.showToast({ title: "Saved", description: "Settings saved", type: "success" });
        setIsDirty(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to save");
    } catch (err: any) {
      // fallback: save to localStorage and notify user
      try {
        const uid = currentUser?.id ?? null;
        const key = `user_settings${uid ? `_${uid}` : ""}${websiteId ? `_${websiteId}` : ""}`;
        localStorage.setItem(key, JSON.stringify(settings));
        toast.showToast({
          title: "Saved locally",
          description: "Settings saved to browser (server failed).",
          type: "info",
        });
        setIsDirty(false);
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
    toast.showToast({ title: "Restored", description: "Settings reloaded", type: "success" });
  };

  useEffect(() => {
    // Load persisted settings on mount (falls back to localStorage)
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
        <div className="animate-spin">
          <Image src="/loader.png" alt="" width={92} height={92} />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "publishing", label: "Publishing" },
    { id: "connections", label: "Connections" },
    { id: "preferences", label: "Preferences" },
    { id: "notifications", label: "Notifications" },
    { id: "account", label: "Account" },
    { id: "billing", label: "Billing & Plan" },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl text-gray-900 font-medium">Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage publishing, integrations, and your account
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b  border-gray-200">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              // variant={"outline"}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-green-600 border w-27 py-2 rounded-2xl rounded-b-none"
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
          <div className="border border-gray-200 rounded-lg p-6  space-y-6">
            <div>
              <h3 className="text-base  font-medium text-gray-900 mb-1">
                Publishing
              </h3>
              <p className="text-sm text-gray-600">
                Control how and when your blog posts go live
              </p>
            </div>

            {/* Auto-publish Posts */}
            <div className="border  border-gray-200 max-w-[654px] rounded-[10px] ">
              <div className=" space-y-2">
                <label className="text-sm font-medium p-3 text-gray-900">
                  Auto-publish posts
                </label>
                <div className="flex justify-between p-3">
                  <p className="text-xs text-gray-600 mb-3">
                    When turned on, new posts will be published automatically
                    after generation
                  </p>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.autoPublish}
                      onCheckedChange={(value) =>
                        handleSettingChange("autoPublish", value)
                      }
                    />
                  </div>
                </div>
                <div className="border w-full border-gray-200" />
              </div>

              {/* Publishing Schedule */}
              <div className="space-y-2">
                <label className="text-sm font-medium p-3 text-gray-900">
                  Publishing Schedule
                </label>
                <p className="text-xs text-gray-600 p-3 mb-3">
                  Posts will be published based on your selected schedule
                </p>
                <div className="flex px-3 ">
                  <Select
                    value={settings.publishingFrequency}
                    onValueChange={(value) =>
                      handleSettingChange("publishingFrequency", value)
                    }
                  >
                    <SelectTrigger className="w-28 h-9 rounded-r-none border-gray-200 text-sm">
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
                    <SelectTrigger className="w-28 h-9 rounded-l-none border-gray-200 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                      <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                      <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Queue Size */}
              <div className="py-3 space-y-2">
                <div className="border border-gray-200 " />

                <label className="text-sm font-medium p-3 text-gray-900">
                  Queue size
                </label>
                <p className="text-xs text-gray-600 p-3 mb-3">
                  Only this number of ready posts will be kept in the publishing
                  queue at a time
                </p>
                <Select
                  value={settings.queueSize}
                  onValueChange={(value) =>
                    handleSettingChange("queueSize", value)
                  }
                >
                  <SelectTrigger className="w-28 h-9   ml-4 border-gray-200 text-sm">
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

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="h-9"
                onClick={() => handleResetSettings()}
                disabled={!isDirty}
              >
                Reset
              </Button>
              <Button
                className="h-9 px-4 bg-gray-900 text-white"
                onClick={() => handleSaveSettings()}
                disabled={!isDirty}
              >
                Save changes
              </Button>
            </div>
          </div>
        )}

        {/* Connections Tab */}
        {activeTab === "connections" && (
          <div className="border border-gray-200 rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Connections
              </h3>
              <p className="text-sm text-gray-600">
                Choose where your posts should be published
              </p>
            </div>

            <div className="border border-gray-300 max-w-[654px] p-4 rounded-[10px]">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Connected Websites
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">www.delani.pro</span>
                  <span className="text-xs text-green-600 font-medium">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700">
                    www.lander.studio
                  </span>
                  <span className="text-xs text-green-600 font-medium">
                    Active
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 h-9 text-green-500 border-gray-200  hover:bg-gray-50"
              >
                <Plus />
              </Button>
              <span className="ml-3">Add website</span>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Preferences
              </h3>
              <p className="text-sm text-gray-600">
                Customize how your posts are generated
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="border space-y-3 rounded-[10px] border-gray-200 max-w-[654px] ">
                <div className="space-y-2 p-4">
                  <label className="text-sm font-medium text-gray-900">
                    Default Language
                  </label>
                  <div className="flex justify-between">
                    <p className="text-xs py-2 text-gray-600 mb-3">
                      Select the language your posts will be written in by
                      default
                    </p>
                    <Select
                      value={settings.defaultLanguage}
                      onValueChange={(value) =>
                        handleSettingChange("defaultLanguage", value)
                      }
                    >
                      <SelectTrigger className="h-9 w-27 border-gray-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="border border-gray-200" />
                  <label className="text-sm font-medium text-gray-900 p-3">
                    Writing tone
                  </label>
                  <div className="flex justify-between p-3">
                    <p className="text-xs text-gray-600 mb-3">
                      Defines the overall style and personality of your content
                    </p>
                    <Select
                      value={settings.writingTone}
                      onValueChange={(value) =>
                        handleSettingChange("writingTone", value)
                      }
                    >
                      <SelectTrigger className="h-9 border-gray-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">
                          Professional
                        </SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 ">
                  <div className="border  border-gray-200" />
                  <label className="text-sm font-medium p-3 text-gray-900">
                    Post length
                  </label>
                  <div className="flex justify-between">
                    <p className="text-xs text-gray-600 p-3 mb-3">
                      Controls how detailed each generated post will be
                    </p>
                    <div className="flex items-center p-3 gap-2">
                      <Input
                        type="text"
                        value={settings.postLength}
                        onChange={(e) =>
                          handleSettingChange("postLength", e.target.value)
                        }
                        placeholder="e.g.1200"
                        className="h-9 w-27 mr-1 border-gray-200 text-sm"
                      />
                    </div>
                    {/* <span className="text-xs text-gray-600">words</span> */}
                  </div>
                </div>

                <div className="space-y-2 ">
                  <div className="border border-gray-200" />
                  <label className="text-sm font-medium p-4 text-gray-900">
                    SEO optimization level
                  </label>
                  <div className="flex justify-between ">
                    <p className="text-xs text-gray-600 p-4 mb-3">
                      Controls how heavily keywords are used
                    </p>
                    <Select
                      value={settings.seoLevel}
                      onValueChange={(value) =>
                        handleSettingChange("seoLevel", value)
                      }
                    >
                      <SelectTrigger className="h-9 mr-4  border-gray-200 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="aggressive">Aggressive</SelectItem>
                        <SelectItem value="conservative">
                          Conservative
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-1">Notifications</h3>
                <p className="text-sm text-gray-600">Choose which updates you want to receive</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    const next = { ...settings } as any;
                    notificationOptions.forEach((o) => (next[o.key] = true));
                    setSettings(next);
                    setIsDirty(true);
                  }}
                >
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    const next = { ...settings } as any;
                    notificationOptions.forEach((o) => (next[o.key] = false));
                    setSettings(next);
                    setIsDirty(true);
                  }}
                >
                  Disable All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {notificationOptions.map((opt) => (
                <div
                  key={opt.key}
                  className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                >
                  <Switch
                    checked={(settings as any)[opt.key]}
                    onCheckedChange={(value) => handleSettingChange(opt.key, value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{opt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === "account" && (
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Account
              </h3>
              <p className="text-sm text-gray-600">
                Manage your account details and preferences
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Profile</label>
                <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  {currentUser?.user_metadata?.avatar_url ? (
                    <Image
                      src={currentUser.user_metadata.avatar_url}
                      alt={currentUser.user_metadata?.full_name || currentUser.email || "avatar"}
                      width={48}
                      height={48}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-sm text-white">
                      {((currentUser?.user_metadata?.full_name || currentUser?.email || "U") as string)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{currentUser?.user_metadata?.full_name || currentUser?.email || "Your profile"}</p>
                    <p className="text-xs text-gray-600">{userPackage ? `${userPackage.charAt(0).toUpperCase() + userPackage.slice(1)} Tier` : "Free Tier"}</p>
                  </div>
                  <button className="h-8 px-3 text-xs hover:bg-gray-800 text-black">
                    Upgrade
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">API access status</label>
                <p className="text-xs text-gray-600 mb-3">
                  Know when competitor analysis finishes
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">API access active</span>
                  <Switch checked={true} className="ml-auto" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Email</label>
              <Input
                type="email"
                value={currentUser?.email || "admin@delani.pro"}
                disabled
                className="h-9 bg-gray-50 border-gray-200 text-sm"
              />
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div className="border border-gray-200 rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Billing & Plan
              </h3>
              <p className="text-sm text-gray-600">
                Manage your subscription settings and usage info
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Current plan</h4>
              <p className="text-sm text-gray-700">{userPackage ? `${userPackage.charAt(0).toUpperCase() + userPackage.slice(1)} Tier` : "Free Tier"}</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Usage summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Articles</span>
                  <span className="text-gray-900">{usage.articles} / {usage.articlesLimit || "—"}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full bg-green-500 rounded" style={{ width: `${usage.articlesLimit ? Math.min(100, Math.round((usage.articles / usage.articlesLimit) * 100)) : 0}%` }} />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Keywords</span>
                  <span className="text-gray-900">{usage.keywords} / {usage.keywordLimit || "—"}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full bg-blue-500 rounded" style={{ width: `${usage.keywordLimit ? Math.min(100, Math.round((usage.keywords / usage.keywordLimit) * 100)) : 0}%` }} />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly posts</span>
                  <span className="text-gray-900">{usage.monthlyPosts} / {usage.monthlyLimit || "—"}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full bg-purple-500 rounded" style={{ width: `${usage.monthlyLimit ? Math.min(100, Math.round((usage.monthlyPosts / usage.monthlyLimit) * 100)) : 0}%` }} />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Subscription</p>
                <p className="text-xs text-gray-600">Upgrade your plan to see more features</p>
              </div>
              <div className="flex gap-2">
                {/* Upgrade Plan dialog copied from articles tab */}
                {userPackage !== "premium" ? (
                  <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="h-9 border-gray-200 bg-white">
                        Upgrade Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Your Plan</DialogTitle>
                        <DialogDescription>
                          Choose a plan to upgrade your account. After selecting, you'll be redirected to LemonSqueezy to complete the purchase.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Plan</label>
                          <Select onValueChange={(value) => setSelectedPlanVariantId(value)}>
                            <SelectTrigger className="w-full h-10">
                              <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={process.env?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15 || ""}>
                                Pro — 15 articles
                              </SelectItem>
                              <SelectItem value={process.env?.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || ""}>
                                Premium — 30 articles
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" onClick={() => setIsPlanDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            disabled={isCreatingCheckout}
                            onClick={async () => {
                              if (!currentUser) {
                                alert("Please sign in to update your plan.");
                                return setIsPlanDialogOpen(false);
                              }
                              if (!selectedPlanVariantId) {
                                alert("Please select a plan.");
                                return;
                              }
                              try {
                                setIsCreatingCheckout(true);
                                if (selectedPlanVariantId) {
                                  window.location.href = selectedPlanVariantId;
                                  return; // fallback in case popup is blocked
                                }
                                const checkout = await createCheckout(
                                  selectedPlanVariantId!,
                                  currentUser.email,
                                  currentUser.user_metadata?.full_name || currentUser.name,
                                  currentUser.id
                                );
                                if (checkout?.url) {
                                  window.open(checkout.url, "_blank");
                                  setIsPlanDialogOpen(false);
                                  setTimeout(async () => {
                                    try {
                                      const pkg = await getUserPackage(currentUser.id);
                                      setUserPackage(pkg);
                                    } catch (e) {}
                                  }, 5000);
                                } else {
                                  alert("Failed to create checkout session. Please try again.");
                                }
                              } catch (err: any) {
                                console.error("Create checkout failed", err);
                                const message = err?.message || err?.error || "Failed to create checkout session. You can try the public checkout URL instead.";
                                const proVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_PRO || "1087280";
                                const premVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_PREMIUM || "1087281";
                                const fallbackUrl15 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_15;
                                const fallbackUrl30 = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30;
                                let fallbackUrl: string | null = null;
                                const selected = String(selectedPlanVariantId);
                                if (selected === String(proVar) && fallbackUrl15) fallbackUrl = fallbackUrl15;
                                if (selected === String(premVar) && fallbackUrl30) fallbackUrl = fallbackUrl30;
                                const silverVar = process.env.NEXT_PUBLIC_LEMON_VARIANT_SILVER_MONTHLY || "";
                                if (!fallbackUrl && selected === String(silverVar) && fallbackUrl15) fallbackUrl = fallbackUrl15;

                                if (fallbackUrl) {
                                  if (confirm(`${message}\n\nWould you like to open the public checkout URL?`)) {
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
                ) : (
                  <Button variant="outline" className="h-9 border-gray-200 bg-white" disabled>
                    Upgraded
                  </Button>
                )}

                <Button variant="outline" className="h-9 border-gray-200 bg-white">
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
