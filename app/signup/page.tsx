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
        } finally {
          router.push('/paywall');
        }
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