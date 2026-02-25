import { supabase } from "./client"

type AuthReturn = { data: any; error: any }

// Helper function to get the correct base URL for both development and production
const getBaseUrl = () => {
  // Always prefer explicit env var — ensures production builds redirect to production URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  // Client-side fallback: use current origin (works for local dev)
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://copyrank.ai'
}

export async function signUp(email: string, password: string): Promise<AuthReturn> {
  try {
    const res: any = await supabase.auth.signUp({ email, password });
    
    // Check if user already exists by looking at the response
    if (res.data?.user && !res.data.session && !res.error) {
      if (res.data.user.identities && res.data.user.identities.length === 0) {
        return { 
          data: null, 
          error: { 
            message: 'Email already exists',
            code: 'EMAIL_EXISTS'
          } 
        };
      }
    }
    
    return { data: res.data ?? res.user ?? null, error: res.error ?? null };
  } catch (err) {
    console.error("lib/auth.signUp error:", err);
    return { data: null, error: err };
  }
}

export async function signIn(email: string, password: string): Promise<AuthReturn> {
  try {
    const res: any = await supabase.auth.signInWithPassword({ email, password })
    return { data: res.data ?? res.user ?? null, error: res.error ?? null }
  } catch (err) {
    console.error("lib/auth.signIn error:", err)
    return { data: null, error: err }
  }
}

export async function signOut(): Promise<AuthReturn> {
  try {
    const res: any = await supabase.auth.signOut()
    return { data: res.data ?? null, error: res.error ?? null }
  } catch (err) {
    console.error("lib/auth.signOut error:", err)
    return { data: null, error: err }
  }
}


export async function getUser(): Promise<AuthReturn> {
  try {
    const res: any = await supabase.auth.getUser()
    // normalize to return the actual user object or null
    const user = res?.data?.user ?? res?.user ?? null
    return { data: user, error: res.error ?? null }
  } catch (err) {
    console.error("lib/auth.getUser error:", err)
    return { data: null, error: err }
  }
}

export async function signUpWithGoogle(): Promise<AuthReturn> {
  try {
    const baseUrl = getBaseUrl()
    const res: any = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/auth/callback`
      }
    })
    return { data: res.data ?? null, error: res.error ?? null }
  } catch (err) {
    console.error("lib/auth.signUpWithGoogle error:", err)
    return { data: null, error: err }
  }
}

// Add forgot password function
export async function resetPassword(email: string): Promise<AuthReturn> {
  try {
    const baseUrl = getBaseUrl()
    const res: any = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password`,
    })
    return { data: res.data, error: res.error }
  } catch (err) {
    console.error("lib/auth.resetPassword error:", err)
    return { data: null, error: err }
  }
}

// Add update password function
export async function updatePassword(newPassword: string): Promise<AuthReturn> {
  try {
    const res: any = await supabase.auth.updateUser({
      password: newPassword
    })
    return { data: res.data, error: res.error }
  } catch (err) {
    console.error("lib/auth.updatePassword error:", err)
    return { data: null, error: err }
  }
}