"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { getUser, updatePassword } from "@/lib/auth"

export function SettingsTab() {
  // Mock states (keep as is for other sections)
  const [apiKey, setApiKey] = useState("sk_live_51234567890abcdefghijklmnop")
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedApiKey, setCopiedApiKey] = useState(false)
  const [mockSettings, setMockSettings] = useState({
    articlesPerMonth: "30",
    publishingSchedule: "daily",
    autoPublish: false,
    emailNotifications: true,
    weeklyReport: true,
    aiModel: "qwen-turbo",
  })

  // Real states for account section
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Password change states
  const [changingPassword, setChangingPassword] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" })

  // Get current user on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: user } = await getUser()
      setCurrentUser(user)
      setLoading(false)
    }
    getCurrentUser()
  }, [])

  // Handle password change
  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordMessage({ type: "error", text: "Please fill in all password fields" })
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" })
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Password must be at least 6 characters" })
      return
    }

    try {
      setChangingPassword(true)
      setPasswordMessage({ type: "", text: "" })

      // Use your existing updatePassword function from auth.ts
      const { data, error } = await updatePassword(passwordData.newPassword)

      if (error) {
        setPasswordMessage({ type: "error", text: error.message || "Failed to update password" })
        return
      }

      setPasswordMessage({ type: "success", text: "Password updated successfully!" })
      
      // Reset form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      })
      setShowChangePassword(false)
      
    } catch (error) {
      setPasswordMessage({ type: "error", text: "An unexpected error occurred" })
    } finally {
      setChangingPassword(false)
    }
  }

  // Mock handlers (keep as is)
  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopiedApiKey(true)
    setTimeout(() => setCopiedApiKey(false), 2000)
  }

  const handleMockSettingChange = (key: string, value: string | boolean) => {
    setMockSettings((prev) => ({ ...prev, [key]: value }))
  }

  const maskApiKey = (key: string) => {
    const visible = key.slice(-8)
    return `${"*".repeat(key.length - 8)}${visible}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Account Settings - DYNAMIC (Only Email + Password Change) */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Email Address</label>
              <Input 
                type="email" 
                value={currentUser?.email || "Loading..."} 
                disabled 
                className="mt-1 bg-input border-border/40" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Account Plan</label>
              <div className="mt-1 flex items-center gap-2">
                <Input value="Free Plan" disabled className="bg-input border-border/40" />
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              </div>
            </div>
          </div>

          {/* Password Change Section */}
          <div className="pt-4 border-t border-border/40">
            {!showChangePassword ? (
              <Button 
                variant="outline" 
                className="cursor-pointer border-border/40 bg-transparent"
                onClick={() => setShowChangePassword(true)}
              >
                Change Password
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">New Password</label>
                    <div className="relative mt-1">
                      <Input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        className="bg-input border-border/40 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      >
                        {showPasswords.new ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Confirm Password</label>
                    <div className="relative mt-1">
                      <Input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        className="bg-input border-border/40 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {passwordMessage.text && (
                  <div className={`p-3 rounded-lg text-sm ${
                    passwordMessage.type === "error" 
                      ? "bg-red-50 text-red-800 border border-red-200" 
                      : "bg-green-50 text-green-800 border border-green-200"
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handlePasswordChange}
                    disabled={changingPassword}
                    className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {changingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowChangePassword(false)
                      setPasswordMessage({ type: "", text: "" })
                      setPasswordData({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: ""
                      })
                    }}
                    className="cursor-pointer border-border/40 bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rest of your mock sections remain exactly the same */}
      {/* API Configuration - MOCK */}
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

      {/* Content Generation Settings - MOCK */}
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
                value={mockSettings.articlesPerMonth}
                onValueChange={(value) => handleMockSettingChange("articlesPerMonth", value)}
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
              <Select
                value={mockSettings.aiModel}
                onValueChange={(value) => handleMockSettingChange("aiModel", value)}
              >
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
                value={mockSettings.publishingSchedule}
                onValueChange={(value) => handleMockSettingChange("publishingSchedule", value)}
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
                  checked={mockSettings.autoPublish}
                  onCheckedChange={(value) => handleMockSettingChange("autoPublish", value)}
                />
                <span className="text-sm text-muted-foreground">{mockSettings.autoPublish ? "Enabled" : "Disabled"}</span>
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

      {/* Notification Settings - MOCK */}
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
              checked={mockSettings.emailNotifications}
              onCheckedChange={(value) => handleMockSettingChange("emailNotifications", value)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
            <div>
              <p className="font-medium text-foreground">Weekly Report</p>
              <p className="text-sm text-muted-foreground">Get a summary of your content performance</p>
            </div>
            <Switch
              checked={mockSettings.weeklyReport}
              onCheckedChange={(value) => handleMockSettingChange("weeklyReport", value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics - MOCK
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
      </Card> */}

      {/* Danger Zone - MOCK */}
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