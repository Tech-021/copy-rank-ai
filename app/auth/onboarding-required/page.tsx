"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function OnboardingRequiredPage() {
  const searchParams = useSearchParams()
  const [errorType, setErrorType] = useState<string>("")
  const [email, setEmail] = useState<string>("")

  useEffect(() => {
    const type = searchParams.get("error") || "general"
    const userEmail = searchParams.get("email") || ""
    setErrorType(type)
    setEmail(userEmail)
  }, [searchParams])

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
          title: "Competitors or Keywords Required",
          description: "Please add at least one competitor or keyword in the onboarding form before signing up.",
          detail: "To provide you with the best SEO insights, we need either competitor domains or target keywords from your onboarding form."
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="max-w-2xl w-full">
        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            {errorInfo.title}
          </h1>

          {/* Description */}
          <p className="text-xl text-slate-300 text-center mb-6">
            {errorInfo.description}
          </p>

          {/* Detail */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6 mb-8">
            <p className="text-slate-400 text-center leading-relaxed">
              {errorInfo.detail}
            </p>
          </div>

          {/* Email display if available */}
          {email && errorType === "no_email" && (
            <div className="bg-red-500/10 border-2 border-red-500/50 rounded-lg p-6 mb-8">
              <p className="text-red-300 font-bold text-center text-lg mb-3">
                ⚠️ Email Mismatch
              </p>
              <div className="bg-red-900/30 rounded-lg p-4 mb-3">
                <p className="text-red-200 text-sm text-center">
                  <span className="font-semibold">You tried to sign up with:</span>
                </p>
                <p className="text-white font-mono text-center text-base mt-1">
                  {email}
                </p>
              </div>
              <p className="text-red-300 text-sm text-center leading-relaxed">
                This email is <span className="font-bold">NOT</span> in our onboarding database. You must fill out the onboarding form using <span className="font-bold underline">this exact email address</span> before you can sign up.
              </p>
            </div>
          )}
          
          {email && errorType !== "no_email" && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-8">
              <p className="text-blue-300 text-sm text-center">
                <span className="font-semibold">Your email:</span> {email}
              </p>
              <p className="text-blue-400 text-xs text-center mt-2">
                Make sure to use this email when filling out the onboarding form
              </p>
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
                    : "Complete all required fields: your website, competitors, and keywords"
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
            <Link href="/" className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-lg transition-all shadow-lg hover:shadow-blue-500/25">
                <ArrowLeft className="mr-2" size={20} />
                Go to Home & Fill Form
              </Button>
            </Link>
          </div>

          {/* Help text */}
          <p className="text-slate-500 text-xs text-center mt-6">
            Need help? Contact us at{" "}
            <a href="mailto:support@copyrank.ai" className="text-blue-400 hover:text-blue-300 underline">
              support@copyrank.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

