"use client"

import { Dashboard } from "@/components/dashboard"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getUser, signOut } from "@/lib/auth"
import { useToast } from "@/components/ui/toast"

export default function DashboardRoute() {
  const router = useRouter()
  const toast = useToast()
  const [userEmail, setUserEmail] = useState<string>("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)

  // Protect the route
  useEffect(() => {
    async function checkAuth() {
      try {
        console.log("=== DASHBOARD AUTH CHECK STARTED ===")
        const { data: user } = await getUser()
        
        console.log("RAW USER DATA:", user)
        
        if (!user?.id) {
          console.log("No user found, redirecting to login")
          router.replace("/login")
          return
        }
        
        console.log("=== USER DATA DEBUG ===")
        console.log("1. Email:", user.email)
        console.log("2. user_metadata:", user.user_metadata)
        console.log("3. identities:", user.identities)
        
        // Set user email
        setUserEmail(user.email || "")
        
        // Check multiple possible locations for avatar
        const avatarFromMetadata = user.user_metadata?.avatar_url
        const pictureFromMetadata = user.user_metadata?.picture
        const avatarFromIdentity = user.identities?.[0]?.identity_data?.avatar_url
        const pictureFromIdentity = user.identities?.[0]?.identity_data?.picture
        
        console.log("4. Avatar sources:")
        console.log("   - user_metadata.avatar_url:", avatarFromMetadata)
        console.log("   - user_metadata.picture:", pictureFromMetadata)
        console.log("   - identities[0].identity_data.avatar_url:", avatarFromIdentity)
        console.log("   - identities[0].identity_data.picture:", pictureFromIdentity)
        
        const avatar = avatarFromMetadata || 
                      pictureFromMetadata || 
                      avatarFromIdentity ||
                      pictureFromIdentity ||
                      null
        
        console.log("5. Final Avatar URL:", avatar)
        setUserAvatar(avatar)
        console.log("=== END DEBUG ===")
        
      } catch (error) {
        console.error("Error in checkAuth:", error)
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

  return <Dashboard onLogout={handleLogout} userEmail={userEmail} userAvatar={userAvatar} />
}