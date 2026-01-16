"use client";
import { supabase } from "@/lib/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Check subscription status on mount
  useEffect(() => {
    let mounted = true;
    
    async function checkSubscription() {
      try {
        setIsCheckingSubscription(true);
        
        // Check if user is logged in
        const { data: user, error: userError } = await getUser();

        if (!user || userError || !user.id) {
          // User not logged in, redirect to login
          if (mounted) {
            router.push('/login');
          }
          return;
        }

        // FIRST: Check if user needs onboarding (pre_data check)
        const { data: predataResult } = await supabase
          .from('pre_data')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Determine if user needs onboarding
        const needsOnboarding = !predataResult || (() => {
          const predata = predataResult
          const hasWebsite = predata.website && predata.website.trim() !== ''
          const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0
          const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0
          return !hasWebsite || (!hasCompetitors && !hasKeywords)
        })()

        if (needsOnboarding) {
          console.log('User needs onboarding, redirecting to onboarding-required')
          if (mounted) {
            router.push('/auth/onboarding-required')
          }
          return
        }

        // SECOND: Check subscription status from the users table
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('subscribe')
          .eq('id', user.id)
          .single();

        if (dbError) {
          console.error('Error checking subscription:', dbError);
          // If error checking subscription, redirect to paywall to be safe
          if (mounted) {
            router.push('/paywall');
          }
          return;
        }

        // Allow access to dialog regardless of subscription status
        // Subscription checks will be handled within the dialog for specific features
        if (mounted) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        // On error, redirect to LemonSqueezy checkout
        if (mounted && user) {
          const checkoutUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || 'https://copyrank.lemonsqueezy.com/buy/1e25810b-38ba-4de5-a753-c06514cb9e91';
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
          const successUrl = `${baseUrl}/payment/callback?next=/dashboard`;
          const fullCheckoutUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${encodeURIComponent(user.id)}&checkout[product_options][redirect_url]=${encodeURIComponent(successUrl)}`;
          window.location.href = fullCheckoutUrl;
        }
      } finally {
        if (mounted) {
          setIsCheckingSubscription(false);
        }
      }
    }

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, [router]);
  
  // Show loading state while checking subscription
  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying subscription...</p>
        </div>
      </div>
    );
  }

  return (
    router.push('/welcome')
  );
}
