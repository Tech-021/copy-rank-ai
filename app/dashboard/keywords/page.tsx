"use client"

import { KeywordsTab } from "@/components/tabs/keywords-tab"
import { useSearchParams } from "next/navigation"

export default function KeywordsPage() {
  const search = useSearchParams()
  const websiteId = search.get("websiteId") || undefined

  return <KeywordsTab websiteId={websiteId} />
}
