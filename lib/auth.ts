import { supabase } from "./client"
type AuthReturn = { data: any; error: any }

// Helper function to get the correct base URL for both development and production
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin
    return window.location.origin
  }
  // Server-side: use environment variable or default to production URL
  return process.env.NEXT_PUBLIC_SITE_URL || 'v0-topic-detection-app.vercel.app'
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
    // Insert into users table if not already present
    const user = res.data?.user ?? res.user ?? null;
    if (user && user.id && user.email) {
      // Check if user already exists in users table
      const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('users').insert([
          { id: user.id, email: user.email, subscribe: true }
        ]);
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
    const res: any = await supabase.auth.signInWithPassword({ email, password });
    const user = res.data?.user ?? res.user ?? null;
    if (user && user.id && user.email) {
      // Check if user already exists in users table
      const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('users').insert([
          { id: user.id, email: user.email, subscribe: true }
        ]);
      }
    }
    return { data: res.data ?? res.user ?? null, error: res.error ?? null };
  } catch (err) {
    console.error("lib/auth.signIn error:", err);
    return { data: null, error: err };
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

// export async function signUpWithGoogle(): Promise<AuthReturn> {
//   try {
//     const baseUrl = getBaseUrl();
//     console.log("lib/auth.signUpWithGoogle baseUrl:", baseUrl)
//     const res: any = await supabase.auth.signInWithOAuth({
//       provider: 'google',
//       options: {
//         redirectTo: `${baseUrl}/auth/callback`
//       }
//     })
    
//     return { data: res.data ?? null, error: res.error ?? null }
//   } catch (err) {
//     console.error("lib/auth.signUpWithGoogle error:", err)
//     return { data: null, error: err }
//   }
// }

declare global {
  interface Window {
    google: any
  }
}
const ONE_TAP_KEY = 'google_one_tap_dismissed'

export async function signUpWithGoogle(credential?: string): Promise<AuthReturn> {
  try {
    let user = null;
    let error = null;
    let session = null;
    if (credential) {
      // Use the provided credential directly
      const res = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential
      });
      error = res.error;
      session = res.data?.session ?? null;
      user = res.data?.user ?? null;
    } else {
      // Fallback: legacy One Tap/manual popup flow
      await new Promise<void>((resolve) => {
        if (!window.google?.accounts?.id) {
          error = new Error('Google Identity Services not loaded');
          resolve();
          return;
        }
        const handleCredential = async (response: any) => {
          try {
            const res = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential
            });
            error = res.error;
            session = res.data?.session ?? null;
            user = res.data?.user ?? null;
          } catch (err) {
            error = err;
          }
          resolve();
        };
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: handleCredential
        });
        if (!localStorage.getItem(ONE_TAP_KEY)) {
          window.google.accounts.id.prompt((notification: any) => {
            if (
              notification.isNotDisplayed?.() ||
              notification.isSkippedMoment?.() ||
              notification.isDismissedMoment?.()
            ) {
              localStorage.setItem(ONE_TAP_KEY, 'true');
            }
          });
        }
        window.google.accounts.id.prompt();
      });
    }
    // Insert into users table if not already present
    if (user && user.id && user.email) {
      const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('users').insert([
          { id: user.id, email: user.email, subscribe: true }
        ]);
      }
    }

    if (error) return { data: null, error };
    return { data: session ?? null, error: null };
  } catch (err) {
    console.error('signUpWithGoogle error:', err);
    return { data: null, error: err };
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