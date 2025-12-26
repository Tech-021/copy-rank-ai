// app/paywall/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PaywallScreen from '@/components/PaywallScreen';
import { getUser } from '@/lib/auth';
import { supabase } from '@/lib/client';
import Image from 'next/image';
import { LoaderChevron } from '@/components/ui/LoaderChevron';

export default function PaywallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUserData() {
      try {
        // Get user from Supabase session
        const { data: user, error } = await getUser();
        
        if (!user || error || !user.id) {
          // No user found, redirect to login
          console.error('No authenticated user found');
          router.push('/login');
          return;
        }

        setUserEmail(user.email || '');
        setUserId(user.id || '');

        // Check subscription status
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('subscribe')
          .eq('id', user.id)
          .single();

        if (dbError) {
          console.error('Error checking subscription:', dbError);
          // If error checking subscription, continue to show paywall
          setIsLoading(false);
          return;
        }

        // If user is already subscribed, redirect to home
        if (userData?.subscribe === true) {
          router.push('/');
          return;
        }

        // User is not subscribed, show paywall
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        router.push('/login');
      }
    }

    loadUserData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="min-h-screen flex items-center justify-center">
            <LoaderChevron />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
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