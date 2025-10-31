"use client"

import { useState, useEffect } from "react"
import { signIn, signUpWithGoogle, resetPassword } from "../lib/auth" // Import resetPassword
import { useToast } from "./ui/toast"
import { Eye, EyeOff, Check, ArrowLeft } from "lucide-react" // Added ArrowLeft
import Image from "next/image"

interface LoginPageProps {
  onLoginSuccess: (email: string) => void
  onBackToLanding: () => void
  onToggleSignUp: () => void
}

const testimonials = [
  // ... your existing testimonials
]

export function LoginPage({ onLoginSuccess, onBackToLanding, onToggleSignUp }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("") // For success messages
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [rememberMe, setRememberMe] = useState(false)
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false) // New state for forgot password mode
  const [resetLoading, setResetLoading] = useState(false) // Loading state for reset password
  const toast = useToast()

  // Auto-cycle testimonials every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleNextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  const handlePrevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setIsLoading(true)
    const { data, error } = await signIn(email, password)
    setIsLoading(false)

    if (error) {
      const msg = (error as any).message ?? String(error) ?? "Error signing in"
      setError(msg)
      try {
        toast.showToast({ title: "Sign in failed", description: msg, type: "error" })
      } catch {}
      return
    }

    try {
      toast.showToast({ title: "Signed in", description: "Welcome back!", type: "success" })
    } catch {}
    onLoginSuccess(email)
  }

  // New function to handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!email) {
      setError("Please enter your email address")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    setResetLoading(true)
    const { data, error } = await resetPassword(email)
    setResetLoading(false)

    if (error) {
      const msg = (error as any).message ?? String(error) ?? "Error sending reset email"
      setError(msg)
      try {
        toast.showToast({ title: "Reset failed", description: msg, type: "error" })
      } catch {}
      return
    }

    const successMsg = "Password reset instructions have been sent to your email"
    setMessage(successMsg)
    try {
      toast.showToast({ 
        title: "Check your email", 
        description: successMsg, 
        type: "success" 
      })
    } catch {}
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError("")
    const { data, error } = await signUpWithGoogle()
    setGoogleLoading(false)

    if (error) {
      const msg = (error as any).message ?? String(error) ?? "Error signing in with Google"
      setError(msg)
      try {
        toast.showToast({ title: "Google sign in failed", description: msg, type: "error" })
      } catch {}
      return
    }
  }

  const testimonial = testimonials[currentTestimonial]

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#2469fe] rounded-3xl m-4 p-12 flex-col justify-between relative overflow-hidden">
        {/* ... your existing testimonial section */}
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-16">
        <div>
          <div className="mb-12">
            <div className="flex items-center justify-center gap-2 mb-8">
              {/* ... your existing logo */}
            </div>
          </div>

          {/* Back button for forgot password mode */}
          {forgotPasswordMode && (
            <button
              onClick={() => {
                setForgotPasswordMode(false)
                setError("")
                setMessage("")
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 cursor-pointer"
            >
              <ArrowLeft size={20} />
              Back to Sign In
            </button>
          )}

          <form onSubmit={forgotPasswordMode ? handleForgotPassword : handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {forgotPasswordMode ? "Reset Your Password" : "Sign In"}
            </h2>
            
            {!forgotPasswordMode ? (
              <p className="text-gray-600">
                Don't have an account yet?{" "}
                <button type="button" onClick={onToggleSignUp} className="cursor-pointer text-blue-500 hover:text-blue-600 font-medium">
                  Sign Up
                </button>
              </p>
            ) : (
              <p className="text-gray-600">
                Enter your email address and we'll send you instructions to reset your password.
              </p>
            )}

            {/* Social Buttons - Only show in sign in mode */}
            {!forgotPasswordMode && (
              <>
                <div className="flex gap-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="cursor-pointer border border-gray-300 rounded-lg py-3 w-full flex items-center justify-center gap-2 hover:bg-gray-50 transition"
                  >
                   <Image src='/google.png' height={30} width={30} alt="icon" />
                    <span className="text-gray-700 font-medium">Google</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="text-gray-400 text-sm">Sign in using email</span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>
              </>
            )}

            {/* Success message */}
            {message && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm">{message}</p>
              </div>
            )}

            {/* Error message */}
            {error && <p className="text-red-500">{error}</p>}

            {/* Email field */}
            <div>
              <p>{forgotPasswordMode ? "Email address" : "Work email address"}</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>

            {/* Password field - Only show in sign in mode */}
            {!forgotPasswordMode && (
              <div className="relative">
                <p>Enter password</p>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="mt-6" size={20} /> : <Eye className="mt-6" size={20} />}
                </button>
              </div>
            )}

            {/* Remember & Forgot - Only show in sign in mode */}
            {!forgotPasswordMode && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-5 h-5 appearance-none border border-gray-300 rounded cursor-pointer checked:bg-blue-500 checked:border-blue-500 transition"
                    />
                    {rememberMe && <Check size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white pointer-events-none" />}
                  </div>
                  <span className="text-gray-600 text-sm">Remember me</span>
                </label>
                <button 
                  type="button"
                  onClick={() => setForgotPasswordMode(true)}
                  className="text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || resetLoading}
              className="cursor-pointer w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {forgotPasswordMode 
                ? (resetLoading ? "Sending..." : "Send Reset Instructions") 
                : (isLoading ? "Signing in..." : "Sign In")
              }
            </button>
          </form>
        </div>

        {/* Footer */}
        {/* ... your existing footer */}
      </div>
    </div>
  )
};