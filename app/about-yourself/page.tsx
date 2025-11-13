"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  
  // New state variables
  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Automatically open the dialog when the page loads
  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleNext = async () => {
    setIsLoading(true);
    
    // Here you can save the onboarding data to your database/API
    try {
      const onboardingData = {
        websiteName,
        competitors: [competitor1, competitor2, competitor3],
        keywords: [keyword1, keyword2, keyword3],
      };
      
      console.log("Onboarding Data:", onboardingData);
      
      // Save to your backend API
      // await fetch('/api/onboarding', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(onboardingData)
      // });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving onboarding data:", error);
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