'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { supabase } from '@/lib/client';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 10; // Poll for up to 10 seconds

  useEffect(() => {
    async function checkSubscriptionAndRedirect() {
      try {
        // Get current user
        const { data: user, error: userError } = await getUser();
        
        if (!user || userError) {
          console.error('No authenticated user found');
          router.push('/login');
          return;
        }

        // Check subscription status from the users table
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('subscribe')
          .eq('id', user.id)
          .single();

        if (dbError) {
          console.error('Error checking subscription:', dbError);
          
          // If we've tried enough times, give up and redirect to fail page
          if (attempts >= MAX_ATTEMPTS) {
            router.push('/payment/fail');
            return;
          }
          
          // Otherwise, try again in 1 second
          setTimeout(() => setAttempts(prev => prev + 1), 1000);
          return;
        }

        // Redirect based on subscription status
        if (userData?.subscribe === true) {
          // Successfully subscribed - redirect to about-yourself page
          router.push('/about-yourself');
        } else if (attempts >= MAX_ATTEMPTS) {
          // Tried too many times, webhook might have failed or payment declined
          router.push('/payment/fail');
        } else {
          // Not subscribed yet, but webhook might still be processing
          // Try again in 1 second
          setTimeout(() => setAttempts(prev => prev + 1), 1000);
        }
      } catch (error) {
        console.error('Error in payment callback:', error);
        router.push('/payment/fail');
      }
    }

    checkSubscriptionAndRedirect();
  }, [router, attempts]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-8">
        <div className="mb-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900">
          Processing your payment...
        </h2>
        <p className="text-gray-600 mb-2">
          Please wait while we confirm your subscription.
        </p>
        <p className="text-sm text-gray-400">
          This usually takes just a few seconds.
        </p>
        {attempts > 3 && (
          <p className="text-xs text-gray-400 mt-4">
            Still processing... ({attempts}/{MAX_ATTEMPTS})
          </p>
        )}
      </div>
    </div>
  );
}