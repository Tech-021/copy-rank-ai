import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ToastProvider } from "@/components/ui/toast"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"

const geist = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist',
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: "SEOFlow - AI-Powered SEO Content Generation",
  description: "Analyze websites, discover keywords, and generate SEO-optimized articles at scale",
  generator: "v0.app",
  icons: "/fav-icon.ico"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <body className="antialiased dark" cz-shortcut-listen="true">
        <header className="fixed top-4 right-4 z-50">
          <Link
            href="/login"
            className="inline-flex items-center px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm font-medium text-white"
            aria-label="Sign in"
          >
            Sign in
          </Link>
        </header>

        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ToastProvider>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }>
              {children}
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}