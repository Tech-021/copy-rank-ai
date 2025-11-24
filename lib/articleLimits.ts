import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Get the maximum number of articles allowed based on user's package
 */
export function getArticleLimit(packageType: 'free' | 'pro' | 'premium' | null | undefined): number {
  switch (packageType) {
    case 'free':
      return 3;
    case 'pro':
      return 15;
    case 'premium':
      return 30;
    default:
      return 3; // Default to free limit
  }
}

/**
 * Get user's package from database
 */
export async function getUserPackage(userId: string): Promise<'free' | 'pro' | 'premium'> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('package')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn(`Could not fetch package for user ${userId}, defaulting to 'free'`);
      return 'free';
    }

    return (data.package as 'free' | 'pro' | 'premium') || 'free';
  } catch (error) {
    console.error('Error fetching user package:', error);
    return 'free';
  }
}

/**
 * Get article limit for a specific user
 */
export async function getUserArticleLimit(userId: string): Promise<number> {
  const packageType = await getUserPackage(userId);
  return getArticleLimit(packageType);
}

