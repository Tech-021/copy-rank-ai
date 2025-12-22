"use client"

import { AnalyzeTab } from "@/components/tabs/analyze-tab"
import { useRouter } from "next/navigation"

export default function AnalyzePage() {
  const router = useRouter()

  return (
    <AnalyzeTab
      onViewKeywords={(websiteId: string) => {
        router.push(`/dashboard/keywords?websiteId=${encodeURIComponent(websiteId)}`)
      }}
      onViewCompetitors={(websiteId: string) => {
        router.push(`/dashboard/competitors?websiteId=${encodeURIComponent(websiteId)}`)
      }}
    />
  )
}
