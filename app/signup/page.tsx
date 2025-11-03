"use client"

import { SignUpPage } from "@/components/signup-page"
import { useRouter } from "next/navigation"

export default function SignUpRoute() {
  const router = useRouter()

  return (
    <SignUpPage
      onSignUpSuccess={(email) => {
        router.push("/dashboard")
      }}
      onBackToLanding={() => {
        router.push("/")
      }}
      onToggleLogin={() => {
        router.push("/login")
      }}
    />
  )
}