import { getUser } from './auth';
import { supabase } from './client';

/**
 * Get current user data from Supabase session
 * This is the recommended way to get user information
 */
export async function getCurrentUser() {
  try {
    const { data: user, error } = await getUser();
    
    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      metadata: user.user_metadata || {},
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get the Supabase session directly
 * Useful when you need access token or refresh token
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return null;
    }

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: session.user,
      expiresAt: session.expires_at,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * ADVANCED: Access Supabase localStorage directly with dynamic key
 * This is NOT recommended - use getCurrentUser() or getCurrentSession() instead
 * Only use this if you absolutely need to access localStorage directly
 */
export function getSupabaseLocalStorageData() {
  if (typeof window === 'undefined') {
    return null; // Server-side, no localStorage
  }

  try {
    // Find all Supabase auth keys in localStorage
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') && key.includes('-auth-token')
    );

    if (supabaseKeys.length === 0) {
      return null;
    }

    // Get the first matching key (usually there's only one)
    const authKey = supabaseKeys[0];
    const authData = localStorage.getItem(authKey);

    if (!authData) {
      return null;
    }

    // Parse the stored session data
    const parsedData = JSON.parse(authData);
    return parsedData;
  } catch (error) {
    console.error('Error reading Supabase localStorage:', error);
    return null;
  }
}

/**
 * Get all Supabase-related localStorage keys
 * Useful for debugging
 */
export function getSupabaseStorageKeys() {
  if (typeof window === 'undefined') {
    return [];
  }

  return Object.keys(localStorage).filter(key => key.startsWith('sb-'));
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get user email with fallback options
 */
export async function getUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email || null;
}

