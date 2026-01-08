"use client"

import { SignUpPage } from "@/components/signup-page"
import { useRouter } from "next/navigation"

export default function SignUpRoute() {
  const router = useRouter()

  return (
    <SignUpPage
      onSignUpSuccess={async (email) => {
        try {
          // Try to fetch any pre-data rows for this email and save to localStorage
          const resp = await fetch(`/api/pre-data?email=${encodeURIComponent(email)}`);
          if (resp.ok) {
            const json = await resp.json();
            if (json?.success && Array.isArray(json.rows) && json.rows.length > 0) {
              // Save the most recent row as pendingOnboarding
              const row = json.rows[0];
              const onboardingData = {
                clientDomain: row.website,
                competitors: row.competitors || [],
                targetKeywords: row.keywords || [],
              };
              localStorage.setItem('pendingOnboarding', JSON.stringify(onboardingData));
            }
          }
        } catch (e) {
          console.error('Failed to fetch pre-data on signup:', e);
        }

        // Get user ID for LemonSqueezy checkout
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || '';
        const checkoutUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL_30 || 'https://copyrank.lemonsqueezy.com/buy/1e25810b-38ba-4de5-a753-c06514cb9e91';
        
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const successUrl = `${baseUrl}/payment/callback?next=/dashboard`;
        const fullCheckoutUrl = `${checkoutUrl}?checkout[email]=${encodeURIComponent(email)}&checkout[custom][user_id]=${encodeURIComponent(userId)}&checkout[product_options][redirect_url]=${encodeURIComponent(successUrl)}`;
        
        window.location.href = fullCheckoutUrl;
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