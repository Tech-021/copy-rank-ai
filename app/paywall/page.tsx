// app/paywall/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PaywallScreen from '@/components/PaywallScreen';
import { getUser } from '@/lib/auth';

export default function PaywallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUserData() {
      try {

        // If no URL params, get user from Supabase session
        const { data: user, error } = await getUser();
        
        if (user && !error) {
          setUserEmail(user.email || '');
          // Supabase user object has user_metadata for additional info
          setUserId(user?.id || '');
        } else {
          // No user found, redirect to login
          console.error('No authenticated user found');
          router.push('/login');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [router]);

  console.log('userEmail', userEmail);
  console.log('userId', userId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PaywallScreen
      userEmail={userEmail}
      userId={userId}
    />
  );
}