"use client";
import { supabase } from "@/lib/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

export default function OnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Check subscription status on mount
  useEffect(() => {
    let mounted = true;
    
    async function checkSubscription() {
      try {
        setIsCheckingSubscription(true);
        
        // Check if user is logged in
        const { data: user, error: userError } = await getUser();
        
        if (!user || userError || !user.id) {
          // User not logged in, redirect to login
          if (mounted) {
            router.push('/login');
          }
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
          // If error checking subscription, redirect to paywall to be safe
          if (mounted) {
            router.push('/paywall');
          }
          return;
        }

        // Check if user is subscribed
        if (mounted) {
          if (userData?.subscribe === true) {
            // User is subscribed, allow access - open dialog
            setIsOpen(true);
          } else {
            // User is not subscribed, redirect to paywall
            router.push('/paywall');
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        if (mounted) {
          router.push('/paywall');
        }
      } finally {
        if (mounted) {
          setIsCheckingSubscription(false);
        }
      }
    }

    checkSubscription();
    
    return () => {
      mounted = false;
    };
  }, [router]);

  // Show loading state while checking subscription
  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  return (
    router.push('/dashboard')
  );
}


