"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getUser, signOut } from "@/lib/auth"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"
import { LandingPage } from "@/components/landing-page"
import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { SignUpPage } from "@/components/signup-page"
import Image from "next/image"

export default function Home() {
  const [authState, setAuthState] = useState<"landing" | "login" | "signup" | "dashboard">("landing")
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
          
          // Check subscription status
          const { data: userData, error: dbError } = await supabase
            .from('users')
            .select('subscribe')
            .eq('id', user.id)
            .single()

          if (dbError) {
            console.error('Error checking subscription:', dbError)
            // If error checking subscription, redirect to paywall to be safe
            if (mounted) {
              router.push('/paywall')
            }
            return
          }

          // Check if user is subscribed
          if (mounted) {
            if (userData?.subscribe === true) {
              // User is subscribed, show dashboard
              setAuthState("dashboard")
            } else {
              // User is not subscribed, redirect to paywall
              router.push('/paywall')
            }
          }
        } else {
          // No user logged in, show landing page
          if (mounted) {
            setAuthState("landing")
          }
        }
      } catch (err) {
        console.error('Error in auth check:', err)
        if (mounted) {
          setAuthState("landing")
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
    setAuthState("landing")
  }

  const handleBackToLanding = () => {
    router.push("/")
  }

  const handleToggleAuthMode = (mode: "login" | "signup") => {
    router.push(mode === "login" ? "/login" : "/signup")
  }

  // Show loading state while checking subscription
  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin"><Image src="/loader.png" alt="" width={92} height={92} /></div>
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

  return <LandingPage onSignIn={handleSignIn} onSignUp={handleSignUp} />
}
