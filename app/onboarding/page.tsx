"use client"

import OnboardingDialog from "@/components/form"

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl">
        <OnboardingDialog inline showDevTester={false} />
      </div>
    </div>
  )
}
