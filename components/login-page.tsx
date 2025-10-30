"use client"

import { useState, useEffect } from "react"
import { signIn, signUpWithGoogle } from "../lib/auth"
import { useToast } from "./ui/toast"
import { Eye, EyeOff, Check } from "lucide-react"
import Image from "next/image"

interface LoginPageProps {
  onLoginSuccess: (email: string) => void
  onBackToLanding: () => void
  onToggleSignUp: () => void
}

const testimonials = [
  {
    id: 1,
    quote:
      "With Salestable, I can ensure that our sales team is equipped with in-depth knowledge of the various aspects of plastic injection molding required to be an effective sales professional",
    author: "Rob L",
    title: "Director, Sales Operations @ HiTech Plastics & Molds",
    rating: 5,
  },
  {
    id: 2,
    quote:
      "Salestable has been a great partner for ContentBacon. We've gone from being a company where the founders are driving the sales to an organization with an effective sales team that is growing and thriving",
    author: "Wendy L",
    title: "Co-founder - ContentBacon",
    rating: 5,
  },
]

export function LoginPage({ onLoginSuccess, onBackToLanding, onToggleSignUp }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [rememberMe, setRememberMe] = useState(false)
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
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10">
          <div className="flex justify-center"> 
            <h2 className="text-white text-3xl font-semibold mb-12"></h2>
          </div>
          <div className="space-y-6 text-center">
            <div className="text-white text-5xl"></div>
            <p className="text-white text-lg leading-relaxed font-light"></p>
            <div className="flex justify-center gap-1">
              {[...Array(testimonial.rating)].map((_, i) => (
                <span key={i} className="text-yellow-300 text-xl"></span>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-white font-semibold text-lg"></p>
              <p className="text-blue-100 text-sm"></p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-center gap-2 mt-12">
          {/* <button onClick={handlePrevTestimonial} className="text-white hover:text-blue-100 transition">◀</button>
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentTestimonial(index)}
              className={`h-1 rounded-full transition-all ${index === currentTestimonial ? "bg-white w-8" : "bg-blue-300 w-2"}`}
            />
          ))}
          <button onClick={handleNextTestimonial} className="text-white hover:text-blue-100 transition">▶</button> */}
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-16">
        <div>
          <div className="mb-12">
            <div className="flex items-center justify-center gap-2 mb-8">
              {/* <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                {/* <span className="text-white font-bold text-lg">⚡</span> */}
              {/* </div>  */}
              {/* <span className="text-2xl font-bold text-gray-900">salestable</span> */}
            </div>
            {/* <h1 className="text-lg font-bold text-gray-900 mb-4">
              Embark on success with Salestable and join a community of hundreds of winning sales team
            </h1> */}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="text-gray-600">
              Don't have an account yet?{" "}
              <button type="button" onClick={onToggleSignUp} className="cursor-pointer text-blue-500 hover:text-blue-600 font-medium">
                Sign Up
              </button>
            </p>

            {/* Social Buttons */}
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
              {/* <button className="border border-gray-300 rounded-lg py-3 w-full flex items-center justify-center gap-2 hover:bg-gray-50 transition">
               <Image src='/linked.png' height={30} width={30} alt="icon" />
                <span className="text-gray-700 font-medium">LinkedIn</span>
              </button> */}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-400 text-sm">Sign in using email</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            {/* Email & Password */}
            <div>
              {error && <p className="text-red-500">{error}</p>}
              <p>Work email address</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              />
            </div>
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

            {/* Remember & Forgot */}
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
              <a href="#" className="text-blue-500 hover:text-blue-600 text-sm font-medium">Forgot Password?</a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer */}
        {/* <div className="text-center text-gray-500 text-sm space-y-1 mt-8">
          <p>© 2025 Salestable Inc. All rights reserved.</p>
          <div className="flex items-center justify-center gap-2">
            <a href="#" className="text-blue-500 hover:text-blue-600">Terms & Conditions</a>
            <span>and</span>
            <a href="#" className="text-blue-500 hover:text-blue-600">Privacy Policy</a>
          </div>
        </div> */}
      </div>
    </div>
  )
}
