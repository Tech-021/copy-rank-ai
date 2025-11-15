"use client";
import { supabase } from "@/lib/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function OnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  
  // New state variables
  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

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

  // Automatically open the dialog when subscription check passes
  // (This is now handled in the subscription check useEffect above)

  const handleNext = async () => {
    setIsLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.showToast({
          title: "Authentication Required",
          description: "Please log in to continue",
          type: "error",
        });
        setIsLoading(false);
        return;
      }
  
      // Prepare onboarding data
      const onboardingData = {
        clientDomain: websiteName.trim(), // Client website URL
        competitors: [
          competitor1.trim(),
          competitor2.trim(),
          competitor3.trim()
        ],
        targetKeywords: [
          keyword1.trim(),
          keyword2.trim(),
          keyword3.trim()
        ],
        userId: user.id
      };
  
      console.log("Onboarding Data:", onboardingData);
  
      // Call onboarding API
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(onboardingData)
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Onboarding failed');
      }
  
      console.log("✅ Onboarding successful:", data);
      
      // Show success toast with article generation message
      toast.showToast({
        title: "Website Added Successfully!",
        description: `Found ${data.totalKeywords} keywords. 30 articles are being generated in the background.`,
        type: "success",
      });
      
      // Small delay to show the toast before navigation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to dashboard
      router.push("/");
      
    } catch (error) {
      console.error("Error during onboarding:", error);
      toast.showToast({
        title: "Onboarding Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Validation: all fields must be filled
  const canProceed = 
    websiteName.trim() && 
    competitor1.trim() && 
    competitor2.trim() && 
    competitor3.trim() &&
    keyword1.trim() && 
    keyword2.trim() && 
    keyword3.trim();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Background content (optional) */}
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Welcome to Viral SEO!
        </h1>
        <p className="text-gray-600 mb-8">
          We're setting up your account. Please complete your profile to get started.
        </p>
        
        {/* You can add additional content here if needed */}
      </div>

      {/* Onboarding Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-xl shadow-lg border border-border/50 bg-white">
          <div className="px-10 py-8">
            <DialogHeader className="mb-6 text-center">
              <DialogTitle className="text-2xl text-center font-semibold text-gray-800">
                Tell us about your website
              </DialogTitle>

              {/* Progress dots */}
              {/* <div className="flex justify-center mt-2">
                <div className="w-2 h-2 rounded-full bg-[#4a5fd8]" />
                <div className="w-2 h-2 rounded-full bg-gray-300 mx-1" />
                <div className="w-2 h-2 rounded-full bg-gray-300" />
              </div> */}
            </DialogHeader>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Website Name */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700 font-medium">
                  Website Name
                </Label>
                <Input
                  type="text"
                  placeholder="Enter your website name"
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                />
              </div>

              {/* Competitors */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700 font-medium">
                  Top 3 Competitors
                </Label>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Competitor 1"
                    value={competitor1}
                    onChange={(e) => setCompetitor1(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 2"
                    value={competitor2}
                    onChange={(e) => setCompetitor2(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 3"
                    value={competitor3}
                    onChange={(e) => setCompetitor3(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                </div>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700 font-medium">
                  Top 3 Keywords
                </Label>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Keyword 1"
                    value={keyword1}
                    onChange={(e) => setKeyword1(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 2"
                    value={keyword2}
                    onChange={(e) => setKeyword2(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 3"
                    value={keyword3}
                    onChange={(e) => setKeyword3(e.target.value)}
                    className="w-full border-gray-300 focus:border-[#4a5fd8] focus:ring-[#4a5fd8]"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end mt-8">
              <Button
                onClick={handleNext}
                disabled={!canProceed || isLoading}
                className="px-6 bg-[#4a5fd8] hover:bg-[#3d52c7] text-white rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Setting up...
                  </div>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}