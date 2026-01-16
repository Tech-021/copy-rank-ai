"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getUser, signOut } from "@/lib/auth"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"
import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { LoaderChevron } from "@/components/ui/LoaderChevron"
import { SignUpPage } from "@/components/signup-page"
import Image from "next/image"

export default function Home() {
  const [authState, setAuthState] = useState<"signup" | "login" | "dashboard">("signup")
  const [userEmail, setUserEmail] = useState("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    async function check() {
      try {
        setIsCheckingSubscription(true)
        const { data } = await getUser()
        // data is normalized to the user object (or null)
        const user = data
        
        if (mounted && user && (user.id || user.email)) {
          setUserEmail(user.email ?? "")
          
          // Set user avatar from Google OAuth
          const avatar = user.user_metadata?.avatar_url || 
                        user.user_metadata?.picture || 
                        user.identities?.[0]?.identity_data?.avatar_url ||
                        user.identities?.[0]?.identity_data?.picture ||
                        null
          setUserAvatar(avatar)
          
          console.log("=== HOME PAGE USER DATA ===")
          console.log("Email:", user.email)
          console.log("Avatar:", avatar)
          console.log("User metadata:", user.user_metadata)
          console.log("Identities:", user.identities)

          // FIRST: Check if user needs onboarding (pre_data check)
          const { data: predataResult } = await supabase
            .from('pre_data')
            .select('*')
            .eq('email', user.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Determine if user needs onboarding
          const needsOnboarding = !predataResult || (() => {
            const predata = predataResult
            const hasWebsite = predata.website && predata.website.trim() !== ''
            const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0
            const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0
            return !hasWebsite || (!hasCompetitors && !hasKeywords)
          })()

          if (needsOnboarding) {
            console.log('User needs onboarding, redirecting to onboarding-required')
            if (mounted) {
              router.push('/auth/onboarding-required')
            }
            return
          }

          // Allow access to dashboard regardless of subscription status
          // Subscription checks will be handled within the app for specific features
          if (mounted) {
            setAuthState("dashboard")
          }
        } else {
          // No user logged in, default to signup page
          if (mounted) {
            setAuthState("signup")
          }
        }
      } catch (err) {
        console.error('Error in auth check:', err)
        if (mounted) {
          setAuthState("signup")
        }
      } finally {
        if (mounted) {
          setIsCheckingSubscription(false)
        }
      }
    }

    check()
    return () => {
      mounted = false
    }
  }, [router])

  const handleSignIn = () => {
    router.push("/login")
  }

  const handleSignUp = () => {
    router.push("/signup")
  }

  const handleLoginSuccess = (email: string) => {
    setUserEmail(email)
    // After login, check subscription status
    checkSubscriptionAndRedirect()
  }

  const handleSignUpSuccess = (email: string) => {
    setUserEmail(email)
    // After signup, check subscription status
    checkSubscriptionAndRedirect()
  }

  // Helper function to check subscription and redirect
  const checkSubscriptionAndRedirect = async () => {
    try {
      const { data: user } = await getUser()
      if (user?.id) {
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('subscribe')
          .eq('id', user.id)
          .single()

        if (!dbError && userData?.subscribe === true) {
          setAuthState("dashboard")
        } else {
          router.push('/paywall')
        }
      }
    } catch (err) {
      console.error('Error checking subscription:', err)
      router.push('/paywall')
    }
  }

  // If user becomes authenticated (dashboard state), redirect to the dashboard route
  useEffect(() => {
    if (authState === "dashboard") {
      router.replace("/dashboard")
    }
  }, [authState, router])

  const toast = useToast()

  const handleLogout = async () => {
    try {
      const { error } = await signOut()
      if (error) {
        console.error("signOut error:", error)
        try {
          toast.showToast({ title: "Sign out failed", description: String(error), type: "error" })
        } catch {}
      } else {
        try {
          toast.showToast({ title: "Signed out", description: "You have been signed out.", type: "success" })
        } catch {}
      }
    } catch (err) {
      console.error("signOut exception:", err)
    }

    setUserEmail("")
    setAuthState("signup")
  }

  const handleBackToLanding = () => {
    setAuthState("signup")
  }

  const handleToggleAuthMode = (mode: "login" | "signup") => {
    setAuthState(mode)
  }

  // Show loading state while checking subscription
  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderChevron />
      </div>
    )
  }

  if (authState === "dashboard") {
    // Redirecting to /dashboard via effect above; render nothing here.
    return null
  }

  if (authState === "login") {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={handleBackToLanding}
        onToggleSignUp={() => handleToggleAuthMode("signup")}
      />
    )
  }

  if (authState === "signup") {
    return (
      <SignUpPage
        onSignUpSuccess={handleSignUpSuccess}
        onBackToLanding={handleBackToLanding}
        onToggleLogin={() => handleToggleAuthMode("login")}
      />
    )
  }

  // Default: Show signup page
  return (
    <SignUpPage
      onSignUpSuccess={handleSignUpSuccess}
      onBackToLanding={handleBackToLanding}
      onToggleLogin={() => handleToggleAuthMode("login")}
    />
  )
}
