import { supabase } from "./client"

type AuthReturn = { data: any; error: any }

export async function signUp(email: string, password: string): Promise<AuthReturn> {
  try {
    const res: any = await supabase.auth.signUp({ email, password })
    return { data: res.data ?? res.user ?? null, error: res.error ?? null }
  } catch (err) {
    console.error("lib/auth.signUp error:", err)
    return { data: null, error: err }
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
    return { data: res.data ?? res.user ?? null, error: res.error ?? null }
  } catch (err) {
    console.error("lib/auth.getUser error:", err)
    return { data: null, error: err }
  }
}
