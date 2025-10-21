"use client"

import { useState } from "react"
import { LandingPage } from "@/components/landing-page"
import { Dashboard } from "@/components/dashboard"
import { LoginPage } from "@/components/login-page"
import { SignUpPage } from "@/components/signup-page"

export default function Home() {
  const [authState, setAuthState] = useState<"landing" | "login" | "signup" | "dashboard">("landing")
  const [userEmail, setUserEmail] = useState("")

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

  const handleLogout = () => {
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
