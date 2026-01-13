"use client"

import { SignUpPage } from "@/components/signup-page"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"

export default function SignUpRoute() {
  const router = useRouter()
  const toast = useToast()

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
        // Require that the user has a pending onboarding (submitted from form/sheets)
        const pendingRaw = localStorage.getItem('pendingOnboarding');
        if (!pendingRaw) {
          toast.showToast({ title: 'Submission required', description: 'Please submit the onboarding form first (via the site form) before creating an account.', type: 'info' });
          return;
        }

        // Get user ID for LemonSqueezy checkout and verify OAuth email matches submitted email
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || '';
        const sessionEmail = user?.email || null;
        try {
          const pending = JSON.parse(pendingRaw);
          if (pending && pending.clientDomain) {
            // If the pending onboarding contains an email field (some flows may include it), compare
            // Otherwise compare saved email if you store it; here we assume pending may have clientDomain only
            const pendingEmail = (pending as any).email || null;
            if (pendingEmail && sessionEmail && pendingEmail !== sessionEmail) {
              toast.showToast({ title: 'Email mismatch', description: `Signed-in email (${sessionEmail}) doesn't match submitted email (${pendingEmail}). Please sign in with the same email or update the submitted email.`, type: 'error' });
              return;
            }
          }
        } catch (e) {
          // ignore parse errors
        }
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