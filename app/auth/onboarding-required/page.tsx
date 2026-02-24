"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import OnboardingDialog from "@/components/form"

// Utility to get home link safely for SSR/CSR
function getHomeLink() {
  if (typeof window !== 'undefined') {
    // Client-side: use window.location
    return window.location.origin.includes('localhost') ? '/' : (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://copyrank.ai/');
  }
  // Server-side: fallback to env or prod
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')) {
    return '/';
  }
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://copyrank.ai/';
}

export default function OnboardingRequiredPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorType, setErrorType] = useState<string>("")
  const [email, setEmail] = useState<string>("")

  useEffect(() => {
    const type = searchParams.get("error") || "general"
    const userEmail = searchParams.get("email") || ""
    setErrorType(type)
    setEmail(userEmail)
  }, [searchParams])

  useEffect(() => {
    const params = searchParams.toString()
    router.replace(`/onboarding${params ? `?${params}` : ""}`)
  }, [router, searchParams])

  const getErrorMessage = () => {
    switch (errorType) {
      case "no_email":
        return {
          title: "Email Not Found",
          description: `The email ${email} is not in our system.`,
          detail: "You must submit the onboarding form with the SAME email address you're using to sign up with Google. The emails must match exactly."
        }
      case "no_website":
        return {
          title: "Website Required",
          description: "Please provide your website in the onboarding form before signing up.",
          detail: "Your onboarding form is incomplete. We need your website URL to set up your account properly."
        }
      case "no_data":
        return {
          title: "Competitors Required",
          description: "Please add competitors in the onboarding form before signing up.",
          detail: "To provide you with the best SEO insights, we need competitor domains for your website. Keywords are optional."
        }
      default:
        return {
          title: "Onboarding Required",
          description: "Please submit the onboarding form before creating an account.",
          detail: "Complete the onboarding form to help us set up your account with the right data."
        }
    }
  }

  const errorInfo = getErrorMessage()

  return (
    <div className="min-h-screen bg-black">
      

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Card */}
        <div className="bg-[#07120b]/80 backdrop-blur-sm border border-[#06321b]/40 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-[#0CE06B]/10 flex items-center justify-center mb-2 border border-[#0CE06B]/20">
              <AlertCircle className="w-10 h-10 text-[#0CE06B]" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            {errorInfo.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-slate-300 text-center mb-6">
            {errorInfo.description}
          </p>

          {/* Detail */}
          <div className="bg-black/40 border border-[#083015]/30 rounded-lg p-6 mb-8">
            <p className="text-slate-300 text-center leading-relaxed">
              {errorInfo.detail}
            </p>
          </div>

          {/* Email display if available */}
          {email && errorType === "no_email" && (
            <div className="bg-[#3a1a12]/40 border-2 border-[#7a2b1f]/30 rounded-lg p-6 mb-8">
              <p className="text-red-300 font-bold text-center text-lg mb-3">⚠️ Email Mismatch</p>
              <div className="bg-[#2a0f0b]/40 rounded-lg p-4 mb-3">
                <p className="text-red-200 text-sm text-center"><span className="font-semibold">You tried to sign up with:</span></p>
                <p className="text-white font-mono text-center text-base mt-1">{email}</p>
              </div>
              <p className="text-red-300 text-sm text-center leading-relaxed">This email is <span className="font-bold">NOT</span> in our onboarding database. Fill out the onboarding form using <span className="font-bold underline">this exact email</span>.</p>
            </div>
          )}

          {email && errorType !== "no_email" && (
            <div className="bg-[#06180f]/50 border border-[#0b3f2a]/30 rounded-lg p-4 mb-8">
              <p className="text-[#9befb8] text-sm text-center"><span className="font-semibold">Your email:</span> {email}</p>
              <p className="text-slate-400 text-xs text-center mt-2">Make sure to use this email when filling out the onboarding form</p>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-semibold text-sm">1</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Go to the home page</h3>
                <p className="text-slate-400 text-sm">Return to the landing page where the onboarding form is located</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-semibold text-sm">2</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">
                  Fill out the onboarding form with {email ? "THIS email" : "your email"}
                </h3>
                <p className="text-slate-400 text-sm">
                  {errorType === "no_email" 
                    ? `Enter ${email || "your email"} in the form and complete all required fields`
                    : "Complete required fields: your website and competitors (keywords are optional)"
                  }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-semibold text-sm">3</span>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Sign up with Google using the SAME email</h3>
                <p className="text-slate-400 text-sm">
                  {errorType === "no_email"
                    ? "The email in your Google account must match the email in the onboarding form"
                    : "Use the exact same email address you provided in the form"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href={getHomeLink()} className="flex-1">
              <Button className="w-full bg-[#0CE06B] hover:bg-[#07c85a] text-black gap-2 rounded-full py-4 shadow-[0_6px_18px_rgba(12,224,107,0.12)]">
                <ArrowLeft className="mr-2" size={18} />
                Go to Home
              </Button>
            </Link>
          </div>

          {/* Inline onboarding form */}
          <div className="mt-10 overflow-x-auto">
            <OnboardingDialog inline />
          </div>

          {/* Help text */}
          <p className="text-slate-400 text-xs text-center mt-6">Need help? Contact us at <a href="mailto:support@copyrank.ai" className="text-[#9befb8] hover:text-[#83e8a6] underline">support@copyrank.ai</a></p>
        </div>
      </div>
    </div>
  )
}

