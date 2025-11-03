import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ToastProvider } from "@/components/ui/toast"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SEOFlow - AI-Powered SEO Content Generation",
  description: "Analyze websites, discover keywords, and generate SEO-optimized articles at scale",
  generator: "v0.app",
  icons: "/topicanalyzer-logo.png"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}  cz-shortcut-listen="true">
        <ToastProvider>
          {children}
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  )
}
