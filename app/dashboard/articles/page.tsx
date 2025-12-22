"use client"

import { ArticlesTab } from "@/components/tabs/articles-tab"
import { useSearchParams } from "next/navigation"

export default function ArticlesPage() {
  const search = useSearchParams()
  const websiteId = search.get("websiteId") ?? undefined

  return <ArticlesTab websiteId={websiteId} />
}
