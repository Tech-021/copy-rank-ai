// app/paywall/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PaywallScreen from '@/components/PaywallScreen';

export default function PaywallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get user data from URL params
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    
    if (email) {
      setUserEmail(email);
      setUserName(name || '');
    }
    setIsLoading(false);
  }, [searchParams]);

  const handleActivateTrial = async () => {
    try {
      // Call your working LemonSqueezy API
      const response = await fetch('/api/lemonsqueezy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          userName,
          userId: `user-${Date.now()}` // In real app, get from auth
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const data = await response.json();
      
      // Redirect to LemonSqueezy checkout (your working API!)
      window.location.href = data.checkoutUrl;
      
    } catch (error) {
      console.error('Failed to activate trial:', error);
      throw error;
    }
  };

  const handleSkipTrial = () => {
    // Redirect to your analyze page or dashboard
    router.push('/analyze?plan=free');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PaywallScreen
      onActivateTrial={handleActivateTrial}
      onSkipTrial={handleSkipTrial}
      userEmail={userEmail}
    />
  );
}