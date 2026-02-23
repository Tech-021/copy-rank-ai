'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { supabase } from '@/lib/client';
import { useToast } from '@/components/ui/toast';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 30; // Poll for up to 30 seconds (increased to allow webhook delivery)
  const nextPath = searchParams.get('next') || '/about-yourself';
  const toast = useToast();

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
        // Use maybeSingle() so missing rows don't throw an exception
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('subscribe, email')
          .eq('id', user.id)
          .maybeSingle();

        if (dbError) {
          console.error('Error checking subscription (db):', dbError);

          // If we've tried enough times, give up and redirect to fail page
          if (attempts >= MAX_ATTEMPTS) {
            router.push('/payment/fail');
            return;
          }

          // Otherwise, wait a bit and retry
          setTimeout(() => setAttempts(prev => prev + 1), 1000);
          return;
        }

        if (!userData) {
          console.warn('No users row found for authenticated user (id=' + user.id + '). Attempting best-effort upsert then retrying.');

          // Best-effort: try to create a users row for this auth user (so webhook can match it).
          // This may fail under strict RLS rules and that's OK.
          try {
            await supabase
              .from('users')
              .upsert({ id: user.id, email: user.email, subscribe: false, package: 'free' }, { returning: 'minimal' });
            console.log('Client-side upsert attempted for users row (id=' + user.id + ')');
          } catch (upsertErr) {
            console.warn('Client-side upsert for users row failed:', upsertErr);
          }

          if (attempts >= MAX_ATTEMPTS) {
            router.push('/payment/fail');
            return;
          }

          setTimeout(() => setAttempts(prev => prev + 1), 1000);
          return;
        }

        // Redirect based on subscription status
        if (userData?.subscribe === true) {
          // Get JWT token once for all API calls
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          if (!token) {
            console.error("❌ No auth token available - user may need to re-login");
            toast.showToast({
              title: "Session expired",
              description: "Please try logging in again",
              type: "warning",
            });
            router.push('/login');
            return;
          }

          // Claim any pre_data for this user (triggers onboarding)
          try {
            const email = (user.email || "").trim().toLowerCase();
            if (email) {
              await fetch("/api/predata/claim", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ email, userId: user.id }),
              }).catch(e => console.error("Claim pre_data failed:", e));
            }

            // Trigger immediate processing and show a toast so the user sees background work started

            fetch("/api/article-jobs/trigger", {
              method: "POST",
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })
              .then(async (res) => {
                if (res.ok) {
                  toast.showToast({
                    title: "Processing Started",
                    description: "Article processing has been triggered and will run in the background.",
                    type: "success",
                  });
                } else {
                  const err = await res.json().catch(() => ({}));
                  console.warn("Trigger endpoint returned non-ok:", err);
                }
              })
              .catch((e) => {
                console.error("Failed to call trigger endpoint:", e);
              });
          } catch (e) {
            console.error("Error claiming pre_data:", e);
          }

          // Successfully subscribed - redirect to requested next path
          router.push(nextPath);
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
  }, [router, attempts, nextPath, searchParams]);

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