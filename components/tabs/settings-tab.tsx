"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, AlertCircle } from "lucide-react"

export function SettingsTab() {
  const [apiKey, setApiKey] = useState("sk_live_51234567890abcdefghijklmnop")
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedApiKey, setCopiedApiKey] = useState(false)
  const [settings, setSettings] = useState({
    articlesPerMonth: "30",
    publishingSchedule: "daily",
    autoPublish: false,
    emailNotifications: true,
    weeklyReport: true,
    aiModel: "qwen-turbo",
  })

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopiedApiKey(true)
    setTimeout(() => setCopiedApiKey(false), 2000)
  }

  const handleSettingChange = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const maskApiKey = (key: string) => {
    const visible = key.slice(-8)
    return `${"*".repeat(key.length - 8)}${visible}`
  }

  return (
    <div className="space-y-6">
      {/* Account Settings */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Manage your account information and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Email Address</label>
              <Input type="email" value="user@example.com" disabled className="mt-1 bg-input border-border/40" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Account Plan</label>
              <div className="mt-1 flex items-center gap-2">
                <Input value="Professional" disabled className="bg-input border-border/40" />
                <Badge className="bg-primary text-primary-foreground">Active</Badge>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40">
            <Button variant="outline" className="cursor-pointer border-border/40 bg-transparent">
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Manage your API keys for integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">API Key</label>
            <div className="mt-1 flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={showApiKey ? apiKey : maskApiKey(apiKey)}
                disabled
                className="bg-input border-border/40"
              />
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-border/40 bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "Hide" : "Show"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-border/40 bg-transparent gap-2"
                onClick={handleCopyApiKey}
              >
                {copiedApiKey ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Keep this key secret. Never share it publicly or commit it to version control.
            </p>
          </div>

          <div className="pt-4 border-t border-border/40">
            <Button variant="outline" className="cursor-pointer border-border/40 bg-transparent">
              Regenerate API Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Generation Settings */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Content Generation</CardTitle>
          <CardDescription>Configure how articles are generated and published</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Articles Per Month</label>
              <Select
                value={settings.articlesPerMonth}
                onValueChange={(value) => handleSettingChange("articlesPerMonth", value)}
              >
                <SelectTrigger className="mt-1 bg-input border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 articles</SelectItem>
                  <SelectItem value="20">20 articles</SelectItem>
                  <SelectItem value="30">30 articles</SelectItem>
                  <SelectItem value="50">50 articles</SelectItem>
                  <SelectItem value="100">100 articles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">AI Model</label>
              <Select value={settings.aiModel} onValueChange={(value) => handleSettingChange("aiModel", value)}>
                <SelectTrigger className="mt-1 bg-input border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qwen-turbo">Qwen Turbo (Recommended)</SelectItem>
                  <SelectItem value="qwen-plus">Qwen Plus</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude-3">Claude 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Publishing Schedule</label>
              <Select
                value={settings.publishingSchedule}
                onValueChange={(value) => handleSettingChange("publishingSchedule", value)}
              >
                <SelectTrigger className="mt-1 bg-input border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="every-other-day">Every Other Day</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Auto-Publish</label>
              <div className="mt-1 flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                <Switch
                  checked={settings.autoPublish}
                  onCheckedChange={(value) => handleSettingChange("autoPublish", value)}
                />
                <span className="text-sm text-muted-foreground">{settings.autoPublish ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Auto-publish is disabled by default</p>
              <p className="text-xs mt-1">
                Enable this only if you want articles to be automatically published without review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage how you receive updates and reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive email updates on article generation</p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(value) => handleSettingChange("emailNotifications", value)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
            <div>
              <p className="font-medium text-foreground">Weekly Report</p>
              <p className="text-sm text-muted-foreground">Get a summary of your content performance</p>
            </div>
            <Switch
              checked={settings.weeklyReport}
              onCheckedChange={(value) => handleSettingChange("weeklyReport", value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Your current usage and limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Articles Generated This Month</p>
                <p className="text-sm font-bold text-primary">18 / 30</p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: "60%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">API Calls This Month</p>
                <p className="text-sm font-bold text-primary">4,250 / 10,000</p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: "42.5%" }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Storage Used</p>
                <p className="text-sm font-bold text-primary">2.3 GB / 50 GB</p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: "4.6%" }}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="cursor-pointer border-red-200 text-red-700 hover:bg-red-100 w-full bg-transparent">
            Delete All Articles
          </Button>
          <Button variant="outline" className="cursor-pointer border-red-200 text-red-700 hover:bg-red-100 w-full bg-transparent">
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
