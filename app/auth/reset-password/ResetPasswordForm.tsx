"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "../../../components/ui/toast"
import { Eye, EyeOff, Check } from "lucide-react"
import { supabase } from "../../../lib/client"

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null)
  const [hashTokens, setHashTokens] = useState<{access_token: string | null, refresh_token: string | null}>({
    access_token: null,
    refresh_token: null
  })
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  useEffect(() => {
    console.log("=== RESET PASSWORD DEBUG ===")
    console.log("Full URL:", window.location.href)
    console.log("Search params:", Object.fromEntries(searchParams.entries()))
    console.log("Hash:", window.location.hash)

    // Check search parameters first
    const token = searchParams.get('token')
    const type = searchParams.get('type')
    
    if (token && type === 'recovery') {
      console.log("✅ Valid token found in search params")
      setIsTokenValid(true)
      return
    }

    // Check hash parameters (Supabase often uses this format)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')
      
      console.log("Hash access_token:", accessToken)
      console.log("Hash refresh_token:", refreshToken)
      console.log("Hash type:", hashType)

      if (accessToken && hashType === 'recovery') {
        console.log("✅ Valid token found in hash")
        setIsTokenValid(true)
        
        // Store the tokens in state so they're available when form is submitted
        setHashTokens({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        
        // Convert hash to search params for better UX and to persist the token
        const newUrl = `${window.location.pathname}?token=${accessToken}&type=recovery`
        window.history.replaceState(null, '', newUrl)
        return
      }
    }

    console.log("❌ No valid token found")
    setError("Invalid or expired reset link. Please request a new password reset.")
    setIsTokenValid(false)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    setIsLoading(true)

    try {
      console.log("🔄 Starting password reset process...")

      // Use the tokens from state (from the original hash)
      const { access_token, refresh_token } = hashTokens
      const type = searchParams.get('type')

      console.log("Using tokens from state:", {
        access_token: access_token ? 'present' : 'missing',
        refresh_token: refresh_token ? 'present' : 'missing',
        type
      })

      if (!access_token || type !== 'recovery') {
        throw new Error("Invalid reset token. Please request a new password reset.")
      }

      if (!password || !confirmPassword) {
        throw new Error("Please fill in all fields")
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match")
      }

      console.log("🔑 Setting up session with recovery tokens...")
      
      // Use setSession with BOTH access_token and refresh_token
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: access_token,
        refresh_token: refresh_token || '' // Use empty string if refresh_token is null
      })

      if (sessionError) {
        console.error("❌ Session setup failed:", sessionError)
        
        // If setSession fails, try a different approach - update user directly
        console.log("🔄 Trying direct password update without session...")
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password: password
        })

        if (updateError) {
          console.error("❌ Direct update also failed:", updateError)
          throw new Error("This reset link has expired or has already been used. Please request a new password reset.")
        }

        console.log("✅ Password updated successfully via direct method")
      } else {
        console.log("✅ Session set successfully:", sessionData)

        // Now update the password with the active session
        console.log("🔐 Updating password...")
        const { data, error: updateError } = await supabase.auth.updateUser({
          password: password
        })

        if (updateError) {
          console.error("❌ Password update error:", updateError)
          throw updateError
        }

        console.log("✅ Password updated successfully")
      }

      const successMsg = "Your password has been updated successfully! Redirecting to login..."
      setMessage(successMsg)
      
      try {
        toast.showToast({ 
          title: "Password updated", 
          description: "Your password has been updated successfully!", 
          type: "success" 
        })
      } catch {}

      // Wait a moment then redirect to login
      setTimeout(() => {
        router.push('/login')
      }, 2000)

    } catch (err: any) {
      console.error("❌ Reset password error:", err)
      
      // Provide more specific error messages
      let errorMessage = err.message || "Error updating password"
      
      if (err.message?.includes('session_missing') || err.message?.includes('Auth session missing')) {
        errorMessage = "The reset link has expired or is invalid. Please request a new password reset."
      } else if (err.message?.includes('invalid_otp')) {
        errorMessage = "Invalid reset token. Please use the link from your email."
      } else if (err.message?.includes('exchange_code_for_session')) {
        errorMessage = "This reset link has already been used or has expired. Please request a new password reset."
      }
      
      setError(errorMessage)
      try {
        toast.showToast({ title: "Reset failed", description: errorMessage, type: "error" })
      } catch {}
    } finally {
      setIsLoading(false)
    }
  }

  const passwordRequirements = [
    { label: "At least 6 characters", met: password.length >= 6 },
    {
      label: "Contains uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Contains lowercase letter",
      met: /[a-z]/.test(password),
    },
    { label: "Contains number", met: /\d/.test(password) },
  ]

  // Show loading state
  if (isTokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Loading...
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please wait while we verify your reset link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show invalid token message
  if (!isTokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Invalid Reset Link
            </h2>
            <p className="mt-2 text-center text-sm text-red-600">
              {error}
            </p>
            <p className="mt-4 text-center text-sm text-gray-600">
              The reset link may have expired or is invalid. Please request a new password reset.
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
        
        {message && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm text-center">{message}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <p className="text-red-500 text-center">{error}</p>}
          
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Password requirements */}
          <div className="space-y-2">
            {passwordRequirements.map((req) => (
              <div key={req.label} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    req.met
                      ? "bg-green-500/20 border border-green-500/50"
                      : "bg-gray-200/30 border border-gray-300"
                  }`}
                >
                  {req.met && <Check size={12} className="text-green-400" />}
                </div>
                <span className={req.met ? "text-green-400" : "text-gray-400"}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}