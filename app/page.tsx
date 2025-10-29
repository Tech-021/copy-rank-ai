"use client"

import { useRouter } from "next/navigation"
import { LandingPage } from "@/components/landing-page"

export default function Home() {
  const router = useRouter()

  return (
    <LandingPage
      onSignIn={() => router.push("/login")}
      onSignUp={() => router.push("/signup")}
    />
  )
}