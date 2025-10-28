"use client"

import { useState, useEffect } from "react"
import { getUser, signOut } from "@/lib/auth"
import { useToast } from "@/components/ui/toast"
import { LandingPage } from "@/components/landing-page"
import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { SignUpPage } from "@/components/signup-page"

export default function Home() {
  const [authState, setAuthState] = useState<"landing" | "login" | "signup" | "dashboard">("landing")
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    let mounted = true
    async function check() {
      try {
        const { data } = await getUser()
        // data is normalized to the user object (or null)
        const user = data
        if (mounted && user && (user.id || user.email)) {
          setUserEmail(user.email ?? "")
          setAuthState("dashboard")
        }
      } catch (err) {
        // ignore
      }
    }

    check()
    return () => {
      mounted = false
    }
  }, [])

  const handleSignIn = () => {
    setAuthState("login")
  }

  const handleSignUp = () => {
    setAuthState("signup")
  }

  const handleLoginSuccess = (email: string) => {
    setUserEmail(email)
    setAuthState("dashboard")
  }

  const handleSignUpSuccess = (email: string) => {
    setUserEmail(email)
    setAuthState("dashboard")
  }

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
    setAuthState("landing")
  }

  const handleToggleAuthMode = (mode: "login" | "signup") => {
    setAuthState(mode)
  }

  if (authState === "dashboard") {
    return <Dashboard onLogout={handleLogout} userEmail={userEmail} />
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
