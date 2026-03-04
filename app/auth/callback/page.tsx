"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/client"
import { useToast } from "@/components/ui/toast"
import Image from "next/image"
import { LoaderChevron } from "@/components/ui/LoaderChevron"

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
          router.replace("/paywall")
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
          // For new signups, redirect to LemonSqueezy checkout
          // For existing users, redirect to dashboard
          const email = session.user?.email || '';
          const userId = session.user?.id || '';

          // Ensure there is a corresponding row in the `users` table for this auth user.
          // This prevents lookup failures (e.g. payment callback / webhooks) when the row is missing.
          try {
            await supabase
              .from('users')
              .upsert({ id: userId, email: email, subscribe: false, package: 'free' }, { returning: 'minimal' });
            console.log('Ensured users row exists for', userId);
          } catch (err) {
            console.warn('Could not upsert users row (non-fatal):', err);
          }
          
          // Check if this is a new user (created_at is very recent)
          const createdAt = new Date(session.user?.created_at || '');
          const now = new Date();
          const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          const isNewSignup = diffMinutes < 5; // New signup if created within last 5 minutes
          
          if (isNewSignup && email && userId) {
            // VALIDATE PREDATA BEFORE ALLOWING SIGNUP
            try {
              const predataResponse = await fetch(`/api/predata?email=${encodeURIComponent(email)}`);
              const predataResult = await predataResponse.json();
              
              // Check if email exists in predata
              if (!predataResult.success || !predataResult.rows || predataResult.rows.length === 0) {
                // Email not found in predata - redirect to onboarding page
                console.log("Validation failed: Email not in predata. Redirecting to onboarding:", userId);

                // Keep user signed in but redirect to onboarding page
                router.replace(`/auth/onboarding-required?error=no_email&email=${encodeURIComponent(email)}`);
                return;
              }
              
              // Get the most recent predata entry
              const predata = predataResult.rows[0];
              
              // Validate required fields: website, competitors, keywords
              const hasWebsite = predata.website && predata.website.trim() !== '';
              const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0;
              const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0;
              
              if (!hasWebsite) {
                console.log("Validation failed: No website. Redirecting to onboarding:", userId);

                // Keep user signed in but redirect to onboarding page
                router.replace(`/auth/onboarding-required?error=no_website&email=${encodeURIComponent(email)}`);
                return;
              }
              
              if (!hasCompetitors && !hasKeywords) {
                console.log("Validation failed: No competitors/keywords. Redirecting to onboarding:", userId);

                // Keep user signed in but redirect to onboarding page
                router.replace(`/auth/onboarding-required?error=no_data&email=${encodeURIComponent(email)}`);
                return;
              }
              
              // All validations passed - proceed with claiming predata
              console.log("✅ Validation passed. Claiming predata for processing...");

              // Claim the predata to trigger onboarding (keyword generation + article creation)
              try {
                // Get JWT token for authenticated API calls
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) {
                  console.error("❌ No auth token available for predata/claim API call");
                  throw new Error("No authentication token available");
                }

                const claimResponse = await fetch('/api/predata/claim', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    email: email,
                    userId: userId
                  })
                });

                const claimResult = await claimResponse.json();
                console.log("Predata claim result:", claimResult);

                if (!claimResult.success) {
                  console.warn("Predata claim failed:", claimResult.error);
                  // Don't fail signup - user can manually add data later
                }
              } catch (claimErr) {
                console.error("Predata claim error:", claimErr);
                // Don't fail signup - user can manually add data later
              }
              
            } catch (validationError) {
              console.error("Predata validation error:", validationError);

              // Keep user signed in but redirect to onboarding page
              router.replace(`/auth/onboarding-required?error=general&email=${encodeURIComponent(email)}`);
              return;
            }
            
            // New user - skip paywall and go to checkout
            const checkoutUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || 'https://copyrank.lemonsqueezy.com/buy/1e25810b-38ba-4de5-a753-c06514cb9e91';
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
            const successUrl = `${baseUrl}/payment/callback?next=/dashboard`;
            const fullCheckoutUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(email)}&checkout[custom][user_id]=${encodeURIComponent(userId)}&checkout[product_options][redirect_url]=${encodeURIComponent(successUrl)}`;
            window.location.href = fullCheckoutUrl;
            
          } else {
            // Existing user - go to dashboard
            toast.showToast({ 
              title: "Successfully signed in!", 
              description: "Welcome back!", 
              type: "success" 
            })
            router.replace("/dashboard")
          }
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
        <div className="min-h-screen flex items-center justify-center">
          <LoaderChevron />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Completing Authentication</h2>
        <p className="text-slate-400">Please wait while we sign you in...</p>
      </div>
    </div>
  )
}
















// // app/paywall/page.tsx
// 'use client';

// import { useEffect, useState } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import PaywallScreen from '../../../components/PaywallScreen';
// import { supabase } from '@/lib/client'; // Import supabase

// export default function PaywallPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const [userEmail, setUserEmail] = useState<string>('');
//   const [userName, setUserName] = useState<string>('');
//   const [userId, setUserId] = useState<string>('');
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     async function getUserData() {
//       try {
//         console.log("🔍 Paywall page - Getting user data");
        
//         // Method 1: Try to get from URL params first
//         const emailFromParams = searchParams.get('email');
//         const nameFromParams = searchParams.get('name');
        
//         console.log("📊 URL params:", { emailFromParams, nameFromParams });

//         if (emailFromParams) {
//           setUserEmail(emailFromParams);
//           setUserName(nameFromParams || '');
//           setIsLoading(false);
//           return;
//         }

//         // Method 2: If no URL params, get from Supabase session
//         console.log("🔄 No URL params, checking Supabase session...");
//         const { data: { session } } = await supabase.auth.getSession();
        
//         if (session?.user) {
//           console.log("✅ User from session:", session.user.email);
//           setUserEmail(session.user.email!);
//           setUserName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');
//           setUserId(session.user.id);
//         } else {
//           console.warn("⚠️ No user session found");
//           setUserEmail('user@example.com'); // Fallback
//         }

//         setIsLoading(false);

//       } catch (error) {
//         console.error("Error getting user data:", error);
//         setIsLoading(false);
//       }
//     }

//     getUserData();
//   }, [searchParams]);

//   const handleActivateTrial = async () => {
//     try {
//       console.log("🎯 Activating trial for:", userEmail);
      
//       if (!userEmail) {
//         throw new Error('User email is required');
//       }

//       // Call your LemonSqueezy API
//       const response = await fetch('/api/lemonsqueezy', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           userEmail,
//           userName,
//           userId: userId || `user-${Date.now()}`
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || 'Failed to create checkout');
//       }

//       const data = await response.json();
      
//       // Redirect to LemonSqueezy checkout
//       window.location.href = data.checkoutUrl;
      
//     } catch (error) {
//       console.error('Failed to activate trial:', error);
//       throw error;
//     }
//   };

//   const handleSkipTrial = () => {
//     router.push('/analyze?plan=free');
//   };

//   if (isLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
//       </div>
//     );
//   }

//   console.log("🎯 Paywall rendering with user:", { userEmail, userName });

//   return (
//     <PaywallScreen
//       onActivateTrial={handleActivateTrial}
//       onSkipTrial={handleSkipTrial}
//       userEmail={userEmail}
//     />
//   );
// }