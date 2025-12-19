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
import { Switch } from "@/components/ui/switch";
import { Copy, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { getUser, updatePassword } from "@/lib/auth";
import Image from "next/image";

export function SettingsTab() {
  const [activeTab, setActiveTab] = useState("publishing");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    };
    getCurrentUser();
  }, []);

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
  };

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
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Notifications
              </h3>
              <p className="text-sm text-gray-600">
                Choose which updates you want to receive
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6 border rounded-[10px] border-gray-200">
                <div className="flex justify-between p-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Post Published
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Get notified when a post goes live
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyPostPublished}
                    onCheckedChange={(value) =>
                      handleSettingChange("notifyPostPublished", value)
                    }
                    className="mt-0.5"
                  />
                </div>
                <div className="border border-gray-200" />

                <div className="flex justify-between p-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Competitor Scan Complete
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Know when competitor analysis finishes
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyCompetitorScan}
                    onCheckedChange={(value) =>
                      handleSettingChange("notifyCompetitorScan", value)
                    }
                    className="mt-0.5"
                  />
                </div>
                <div className="border border-gray-200" />
                <div className="flex justify-between p-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Keyword Synced
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Receive updates when new keywords are added
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyKeywordSynced}
                    onCheckedChange={(value) =>
                      handleSettingChange("notifyKeywordSynced", value)
                    }
                    className="mt-0.5"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6 ">
                <div className="border border-gray-200 rounded-[10px] max-w-[654px] h-[220px] space-y-9">
                  <div className="flex justify-between mt-5 px-6 py-2  gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Draft Generated
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Be notified when a new draft is ready to review
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyDraftGenerated}
                      onCheckedChange={(value) =>
                        handleSettingChange("notifyDraftGenerated", value)
                      }
                      className="mt-0.5"
                    />
                  </div>
                  <div className="border border-gray-200" />

                  <div className="flex justify-between mt-5 px-6  gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Weekly Performance Summary
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Get a weekly overview of your content activity
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyWeeklyReport}
                      onCheckedChange={(value) =>
                        handleSettingChange("notifyWeeklyReport", value)
                      }
                      className="mt-0.5"
                    />
                  </div>
                </div>
              </div>
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

            <div className="grid grid-cols-2 gap-12">
              {/* Left Column */}
              <div className="space-y-0 border border-gray-200 rounded-lg ">
                {/* Profile Section */}
                <div className="flex items-center justify-between p-2 pb-4 border-b border-gray-200">
                  <div className="flex items-center p-2 gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-300" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Delani Web
                      </p>
                      <p className="text-xs text-gray-600">Free Tier</p>
                    </div>
                  </div>
                  <button className="h-8 px-3 text-xs hover:bg-gray-800 text-black">
                    Upgrade
                  </button>
                </div>

                {/* Email Section */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-xs text-gray-600">
                      {currentUser?.email || "admin@delani.pro"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs text-gray-500 hover:text-gray-900 hover:bg-transparent"
                  >
                    Change email
                  </Button>
                </div>

                {/* Password Section */}
                <div className="flex items-center px-4 py-5 justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Password
                    </p>
                    <p className="text-xs text-gray-600">••••••••</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs text-gray-500 hover:text-gray-900 hover:bg-transparent"
                  >
                    Change password
                  </Button>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* API Access Status */}
                <div className="space-y-3 border rounded-[10px] border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        API access status
                      </h4>
                      <p className="text-xs text-gray-600">
                        Know when competitor analysis finishes
                      </p>
                    </div>
                    <Switch checked={true} className="ml-auto" />
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
          <div className="border border-gray-200 rounded-lg p-6 space-y-6">
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Billing & Plan
              </h3>
              <p className="text-sm text-gray-600">
                Manage your subscription settings and usage info
              </p>
            </div>
            <div className="border border-gray-200 max-w-[654px] rounded-lg ">
              <div>
                <h4 className="text-sm p-3 font-medium text-gray-900 px-4 mb-3">
                  Current plan
                </h4>
                <p className="text-sm px-4 text-gray-700">Free Tier</p>
              </div>
              <div className="border border-gray-200" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium p-4 text-gray-900">
                  Usage summary
                </h4>
                <div className="space-y-2 text-sm p-2 px-4">
                  <div className="flex justify-between ">
                    <span className="text-gray-600">Websites</span>
                    <span className="text-gray-900">5 / 10</span>
                  </div>
                  {/* <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full w-1/2 bg-green-500 rounded" />
                </div> */}
                </div>
                <div className="space-y-2 text-sm p-2 px-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Keywords</span>
                    <span className="text-gray-900">25 / 100</span>
                  </div>
                  {/* <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full w-1/4 bg-blue-500 rounded" />
                </div> */}
                </div>
                <div className="space-y-2 text-sm p-2 px-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly posts</span>
                    <span className="text-gray-900">8 / 20</span>
                  </div>
                  {/* <div className="w-full h-2 bg-gray-200 rounded">
                  <div className="h-full w-2/5 bg-purple-500 rounded" />
                </div> */}
                </div>
              </div>

              <div className="pt-4 p-1 border-t border-gray-200 flex justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 px-3 mb-2">
                    Subscription
                  </p>
                  <p className="text-xs text-gray-600 px-3 ">
                    Upgrade your plan to see more features
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 border-gray-200 bg-white"
                  >
                    Upgrade Plan
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 border-gray-200 bg-white"
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
