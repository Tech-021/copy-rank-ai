"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"

export default function AuthCallbackPage() {
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // Get the current URL hash and search parameters
        const hash = window.location.hash.substring(1)
        const searchParams = new URLSearchParams(window.location.search)
        
        // Check if we have OAuth parameters
        const hasAuthParams = hash.includes('access_token') || 
                             searchParams.has('code') || 
                             searchParams.has('error')

        if (!hasAuthParams) {
          console.warn('No auth parameters found in URL')
          router.replace("/")
          return
        }

        let result: any = null

        // Try different methods to handle the auth callback
        if (searchParams.has('code')) {
          // Handle OAuth code exchange (most common for Supabase)
          result = await supabase.auth.exchangeCodeForSession(searchParams.get('code')!)
        } else if (hash) {
          // Handle implicit flow (token in hash)
          const hashParams = new URLSearchParams(hash)
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')
          
          if (access_token) {
            result = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || undefined
            })
          }
        }

        // Check for errors
        if (result?.error) {
          console.error("Auth callback error:", result.error)
          toast.showToast({ 
            title: "Authentication failed", 
            description: result.error.message || "Please try again", 
            type: "error" 
          })
          router.replace("/auth/signin")
          return
        }

        // Check if we have a valid session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          toast.showToast({ 
            title: "Successfully signed in!", 
            description: "Welcome back!", 
            type: "success" 
          })
          router.replace("/dashboard") // Redirect to dashboard instead of home
        } else {
          toast.showToast({ 
            title: "Authentication incomplete", 
            description: "Please try signing in again", 
            type: "warning" 
          })
          router.replace("/auth/signin")
        }

      } catch (error) {
        console.error("Auth callback exception:", error)
        toast.showToast({ 
          title: "Authentication error", 
          description: "Something went wrong. Please try again.", 
          type: "error" 
        })
        router.replace("/auth/signin")
      }
    }

    handleAuthCallback()
  }, [router, toast])

  // Show loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Completing Authentication</h2>
        <p className="text-slate-400">Please wait while we sign you in...</p>
      </div>
    </div>
  )
}