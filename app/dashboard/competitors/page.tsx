"use client"

import { CompetitorsTab } from "@/components/tabs/competitors-tab"
import { useSearchParams } from "next/navigation"

export default function CompetitorsPage() {
  const search = useSearchParams()
  const websiteId = search.get("websiteId") ?? null

  return <CompetitorsTab websiteId={websiteId} />
}
