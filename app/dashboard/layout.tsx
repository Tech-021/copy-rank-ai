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
  const [authPassed, setAuthPassed] = useState(false)

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

        // FIRST: Check if user needs onboarding (pre_data check)
        console.log('Dashboard layout: Checking pre_data for user:', user.email)
        const { data: predataResult } = await supabase
          .from('pre_data')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        console.log('Dashboard layout: predataResult:', predataResult)

        // Determine if user needs onboarding
        const needsOnboarding = !predataResult || (() => {
          const predata = predataResult
          const hasWebsite = predata.website && predata.website.trim() !== ''
          const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0
          const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0
          console.log('Dashboard layout: hasWebsite:', hasWebsite, 'hasCompetitors:', hasCompetitors, 'hasKeywords:', hasKeywords)
          return !hasWebsite || (!hasCompetitors && !hasKeywords)
        })()

        console.log('Dashboard layout: needsOnboarding:', needsOnboarding)

        if (needsOnboarding) {
          console.log('Dashboard layout: User needs onboarding, redirecting from dashboard')
          if (mounted) {
            setCheckingAuth(false)
            router.replace('/auth/onboarding-required')
          }
          return
        }

        // Check subscription status - redirect to LemonSqueezy if not subscribed
        console.log('Dashboard layout: Checking subscription for user:', user.id);
        const { data: userData, error: subError } = await supabase
          .from('users')
          .select('subscribe')
          .eq('id', user.id)
          .single();

        console.log('Dashboard layout: subscription result:', userData, 'error:', subError);

        // if (!userData?.subscribe) {
        //   console.log('Dashboard layout: User not subscribed, redirecting to LemonSqueezy');
        //   if (mounted) {
        //     setCheckingAuth(false)
        //     const checkoutUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || 'https://copyrank.lemonsqueezy.com/buy/1e25810b-38ba-4de5-a753-c06514cb9e91';
        //     const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        //     const successUrl = `${baseUrl}/payment/callback?next=/dashboard`;
        //     const fullCheckoutUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${encodeURIComponent(user.id)}&checkout[product_options][redirect_url]=${encodeURIComponent(successUrl)}`;
        //     window.location.href = fullCheckoutUrl;
        //   }
        //   return
        // }

        setUserEmail(user.email || "")
        const avatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          user.identities?.[0]?.identity_data?.avatar_url ||
          user.identities?.[0]?.identity_data?.picture ||
          null
        setUserAvatar(avatar)
        
        // Allow page to render first (non-blocking)
        setCheckingAuth(false)
        setAuthPassed(true)
        
        // DISABLED: Background keyword generation removed
        // Keywords are now only generated during onboarding via /api/onboarding
        // This ensures keywords only come from onboarding relevant pages
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

  if (checkingAuth || !authPassed) return null

  return (
    <Dashboard onLogout={handleLogout} userEmail={userEmail} userAvatar={userAvatar}>
      {children}
    </Dashboard>
  )
}
