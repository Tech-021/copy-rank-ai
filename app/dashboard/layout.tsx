"use client"

import { Dashboard } from "@/components/dashboard"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getUser, signOut } from "@/lib/auth"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const toast = useToast()
  const [userEmail, setUserEmail] = useState<string>("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)

  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    let mounted = true
    async function checkAuth() {
      try {
        // First, check session directly from Supabase to avoid transient nulls
        const { data: sessionData } = await supabase.auth.getSession()
        const session = (sessionData as any)?.session ?? null

        if (!session) {
          if (mounted) {
            setCheckingAuth(false)
            router.replace("/login")
          }
          return
        }

        // If we have a session, fetch user details
        const { data: user } = await getUser()
        if (!user?.id) {
          if (mounted) {
            setCheckingAuth(false)
            router.replace("/login")
          }
          return
        }

        if (!mounted) return
        setUserEmail(user.email || "")
        const avatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          user.identities?.[0]?.identity_data?.avatar_url ||
          user.identities?.[0]?.identity_data?.picture ||
          null
        setUserAvatar(avatar)
        setCheckingAuth(false)
      } catch (err) {
        console.error("checkAuth error:", err)
        if (mounted) {
          setCheckingAuth(false)
          router.replace("/login")
        }
      }
    }
    checkAuth()
    return () => {
      mounted = false
    }
  }, [router])

  const handleLogout = async () => {
    try {
      const { error } = await signOut()
      if (error) {
        toast.showToast({ title: "Sign out failed", description: String(error), type: "error" })
      } else {
        toast.showToast({ title: "Signed out", description: "You have been signed out.", type: "success" })
        router.replace("/")
      }
    } catch (err) {
      console.error("signOut exception:", err)
    }
  }

  if (checkingAuth) return null

  return (
    <Dashboard onLogout={handleLogout} userEmail={userEmail} userAvatar={userAvatar}>
      {children}
    </Dashboard>
  )
}
