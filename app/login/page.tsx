"use client"

import { LoginPage } from "@/components/login-page"
import { useRouter } from "next/navigation"

export default function LoginRoute() {
  const router = useRouter()

  return (
    <LoginPage
      onLoginSuccess={(email) => {
        router.push("/paywall")
      }}
      onBackToLanding={() => {
        router.push("/")
      }}
      onToggleSignUp={() => {
        router.push("/signup")
      }}
    />
  )
}