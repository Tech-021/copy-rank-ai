"use client"

import { Dashboard } from "@/components/dashboard"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getUser, signOut } from "@/lib/auth"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"

// Match onboarding's normalizeUrl logic so we can find the correct website row
function normalizeUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null

  const cleanDomain = websiteUrl
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .split("/")[0]

  if (!cleanDomain) return null
  return `https://www.${cleanDomain}`
}

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
        
        // Load competitor keywords directly from APIs (non-blocking) and
        // then attach them to the correct website record.
        if (predataResult?.competitors && Array.isArray(predataResult.competitors) && predataResult.competitors.length > 0) {
          // Fire and forget - don't await, let it run in background
          (async () => {
            try {
              // Get access token for API call
              const { data: { session: currentSession } } = await supabase.auth.getSession()
              const token = currentSession?.access_token
              
              if (!token) {
                console.log('⚠️ No auth token available for API calls')
                return
              }
              
              // Get first competitor from predata
              const competitor = predataResult.competitors[0]
              const competitorDomain = competitor.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
              
              console.log('📊 [Background] Step 1: Fetching relevant pages for competitor:', competitorDomain)
              
              // STEP 1: Call relevant-pages API
              const relevantPagesResponse = await fetch('/api/relevant-pages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  competitor: competitorDomain,
                  location_code: 2840,
                  language_code: 'en',
                  limit: 10
                })
              })
              
              if (!relevantPagesResponse.ok) {
                const errorData = await relevantPagesResponse.json().catch(() => ({}))
                console.error('❌ [Background] Relevant Pages API Error:', errorData)
                return
              }
              
              const relevantPagesData = await relevantPagesResponse.json()
              
              if (!relevantPagesData.success || !relevantPagesData.pages || relevantPagesData.pages.length === 0) {
                console.error('❌ [Background] No relevant pages found')
                return
              }
              
              // Get first page (highest traffic - already sorted)
              const firstPage = relevantPagesData.pages[0]
              const mostVisitedPageUrl = firstPage.page_address || firstPage.url || firstPage.page
              
              if (!mostVisitedPageUrl) {
                console.error('❌ [Background] No page URL found in relevant pages response')
                return
              }
              
              console.log(`✅ [Background] Step 1 Complete: Found most visited page: ${mostVisitedPageUrl}`)
              console.log(`   Traffic ETV: ${firstPage.metrics?.organic?.etv || 'N/A'}`)

              // Resolve which website these keywords belong to.
              // Prefer the website whose URL matches pre_data.website, else fallback
              // to the most recently created website for this user.
              let targetWebsiteId: string | null = null
              try {
                const normalizedClientUrl = normalizeUrl(predataResult.website || null)
                const { data: userWebsites, error: websitesError } = await supabase
                  .from('websites')
                  .select('id, url, created_at')
                  .eq('user_id', user.id)
                  .order('created_at', { ascending: false })

                if (websitesError) {
                  console.error('❌ [Background] Error fetching websites for keyword save:', websitesError)
                } else if (userWebsites && userWebsites.length > 0) {
                  if (normalizedClientUrl) {
                    const matched = userWebsites.find((w: any) => w.url === normalizedClientUrl)
                    targetWebsiteId = matched?.id || userWebsites[0].id
                  } else {
                    targetWebsiteId = userWebsites[0].id
                  }
                } else {
                  console.warn('⚠️ [Background] No websites found for user when saving keywords, creating one automatically...')
                  if (normalizedClientUrl) {
                    try {
                      const { data: created, error: createErr } = await supabase
                        .from('websites')
                        .insert([
                          {
                            url: normalizedClientUrl,
                            topic: 'General',
                            user_id: user.id,
                            keywords: {},
                          },
                        ])
                        .select('id')
                        .single()

                      if (createErr) {
                        console.error('❌ [Background] Failed to auto-create website:', createErr)
                      } else if (created?.id) {
                        targetWebsiteId = created.id
                        console.log('✅ [Background] Auto-created website for user:', created.id)
                      }
                    } catch (createUnexpected) {
                      console.error('❌ [Background] Unexpected error auto-creating website:', createUnexpected)
                    }
                  } else {
                    console.warn('⚠️ [Background] Cannot auto-create website – pre_data.website is empty')
                  }
                }
              } catch (resolveErr) {
                console.error('❌ [Background] Error resolving website for keyword save:', resolveErr)
              }
              
              // STEP 2: Call extract-keywords API (it will persist keywords when websiteId is provided)
              console.log('📊 [Background] Step 2: Extracting keywords from most visited page...')
              
              const keywordsResponse = await fetch('/api/extract-keywords', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  url: mostVisitedPageUrl,
                  limit: 100,
                  websiteId: targetWebsiteId || undefined,
                }),
              })
              
              if (!keywordsResponse.ok) {
                const errorData = await keywordsResponse.json().catch(() => ({}))
                console.error('❌ [Background] Extract Keywords API Error:', errorData)
                return
              }
              
              const keywordsData = await keywordsResponse.json()
              
              console.log('✅ [Background] Step 2 Complete: Extracted keywords')
              console.log('📄 Most Visited Page:', {
                url: mostVisitedPageUrl,
                title: keywordsData.title,
                traffic_etv: firstPage.metrics?.organic?.etv
              })
              console.log('🔑 Keywords Extracted:', keywordsData.keywords?.length || 0)
              
              // Log keywords
              if (keywordsData.keywords && Array.isArray(keywordsData.keywords)) {
                console.log('📋 Keywords List:')
                keywordsData.keywords.forEach((kw: any, index: number) => {
                  console.log(`  ${index + 1}. "${kw.keyword}" - Frequency: ${kw.frequency}`)
                })
              }

              // STEP 3: Enqueue article generation jobs based on these keywords.
              // This connects the new competitor-based keyword flow to the existing
              // article + image generation pipeline (article_jobs + cron).
              if (targetWebsiteId && keywordsData.keywords && Array.isArray(keywordsData.keywords) && keywordsData.keywords.length > 0) {
                try {
                  const enqueueBody = {
                    keywords: keywordsData.keywords,
                    websiteId: targetWebsiteId,
                    userId: user.id,
                    // Let the enqueue API and package limits decide how many articles;
                    // passing keywords.length gives it an upper bound.
                    totalArticles: keywordsData.keywords.length,
                  }
                  console.log('🚀 [Background] Enqueuing article jobs from extracted keywords:', {
                    websiteId: targetWebsiteId,
                    userId: user.id,
                    keywordCount: keywordsData.keywords.length,
                  })

                  fetch('/api/article-jobs/enqueue', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(enqueueBody),
                  })
                    .then(async (res) => {
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok || data?.error) {
                        console.error('❌ [Background] Failed to enqueue article jobs from competitor keywords:', data)
                      } else {
                        console.log(
                          `✅ [Background] Enqueued ${data.actual || data.jobCount || 0} article jobs from competitor keywords for website ${targetWebsiteId}`
                        )
                      }
                    })
                    .catch((err) => {
                      console.error('❌ [Background] Error calling /api/article-jobs/enqueue from competitor flow:', err)
                    })
                } catch (enqueueErr) {
                  console.error('❌ [Background] Unexpected error preparing enqueue payload:', enqueueErr)
                }
              } else {
                console.warn(
                  '⚠️ [Background] Skipping enqueue – no targetWebsiteId or no keywords available after extraction.'
                )
              }
            } catch (apiError) {
              console.error('❌ [Background] Error in keywords flow:', apiError)
            }
          })()
        } else {
          console.log('⚠️ Skipping keywords fetch - no competitors found in predata')
        }
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
