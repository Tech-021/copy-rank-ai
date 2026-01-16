import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get the current path
  const path = request.nextUrl.pathname

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    // '/login',
    '/signup',
    '/auth/callback',
    '/auth/reset-password',
    '/paywall', // Add paywall to public routes
    '/dashboard', // Allow dashboard client-side to handle auth (avoid server redirect)
    '/payment/callback', // Payment callback should also be public
    '/payment/fail', // Payment fail page should be public
    '/about-yourself', // Payment fail page should be public
    '/articles',
    '/auth/onboarding-required',
    
    '/fonts',
    '/fav-icon.ico',
  ]

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') {
      return path === '/'
    }
    return path.startsWith(route)
  })

  // Check if the path is an API route
  const isApiRoute = path.startsWith('/api')

  // If it's a public route or API route, allow access
  if (isPublicRoute || isApiRoute) {
    return response
  }

  // Check authentication for protected routes
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is not authenticated, redirect to login
  if (!user || !user.id) {
    const loginUrl = new URL('/', request.url)
    // Store the original URL to redirect back after login
    loginUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(loginUrl)
  }

  // Check if user needs onboarding by checking pre_data table
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Check if user's email exists in pre_data and has complete information
  const { data: predata } = await supabaseAdmin
    .from('pre_data')
    .select('*')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Determine if user needs onboarding
  // User needs onboarding if: no pre_data exists OR pre_data exists but is incomplete
  const needsOnboarding = !predata || (() => {
    const hasWebsite = predata.website && predata.website.trim() !== ''
    const hasCompetitors = Array.isArray(predata.competitors) && predata.competitors.length > 0
    const hasKeywords = Array.isArray(predata.keywords) && predata.keywords.length > 0
    return !hasWebsite || (!hasCompetitors && !hasKeywords)
  })()

  // If user needs onboarding and is not already on the onboarding page, redirect
  if (needsOnboarding && path !== '/auth/onboarding-required') {
    const onboardingUrl = new URL('/auth/onboarding-required', request.url)
    // Store the original URL to redirect back after onboarding
    onboardingUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(onboardingUrl)
  }

  // User is authenticated and doesn't need onboarding, allow access
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|fav-icon.ico|fonts|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2|eot|txt)$).*)',
  ],
}
