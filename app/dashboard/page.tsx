"use client"

import { Dashboard } from "@/components/dashboard"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { getUser, signOut } from "@/lib/auth"
import { useToast } from "@/components/ui/toast"

export default function DashboardRoute() {
  const router = useRouter()
  const toast = useToast()

  // Protect the route
  useEffect(() => {
    async function checkAuth() {
      const { data: user } = await getUser()
      if (!user?.id) {
        router.replace("/login")
      }
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    try {
      const { error } = await signOut()
      if (error) {
        console.error("signOut error:", error)
        toast.showToast({ title: "Sign out failed", description: String(error), type: "error" })
      } else {
        toast.showToast({ title: "Signed out", description: "You have been signed out.", type: "success" })
        router.replace("/")
      }
    } catch (err) {
      console.error("signOut exception:", err)
    }
  }

  return <Dashboard onLogout={handleLogout} userEmail="" />
}