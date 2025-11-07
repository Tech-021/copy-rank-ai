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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [sellingStatus, setSellingStatus] = useState("");
  const [revenue, setRevenue] = useState("");
  const [isForClient, setIsForClient] = useState("no");
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
        sellingStatus,
        revenue,
        isForClient,
      };
      
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

  const canProceed = sellingStatus && revenue && isForClient;

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
                Tell us a little about yourself
              </DialogTitle>

              {/* Progress dots */}
              <div className="flex justify-center mt-2">
                <div className="w-2 h-2 rounded-full bg-[#4a5fd8]" />
                <div className="w-2 h-2 rounded-full bg-gray-300 mx-1" />
                <div className="w-2 h-2 rounded-full bg-gray-300" />
              </div>
            </DialogHeader>

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Selling Status */}
              <div className="space-y-2">
                <div className="border border-gray-300 rounded-md p-3">
                  <Label className="text-xs text-gray-600 block mb-2">
                    Are you already selling?
                  </Label>
                  <Select value={sellingStatus} onValueChange={setSellingStatus}>
                    <SelectTrigger className="w-full border-0 p-0 h-6 focus:ring-0 focus-visible:ring-0 focus:outline-none">
                      <SelectValue placeholder="Please choose one..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Revenue */}
              <div className="space-y-2">
                <div className="border border-gray-300 rounded-md p-3">
                  <Label className="text-xs text-gray-600 block mb-2">
                    What is your current revenue?
                  </Label>
                  <Select value={revenue} onValueChange={setRevenue}>
                    <SelectTrigger className="w-full border-0 p-0 h-6 focus:ring-0 focus-visible:ring-0 focus:outline-none">
                      <SelectValue placeholder="Please choose one..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None yet</SelectItem>
                      <SelectItem value="below10k">Below $10k</SelectItem>
                      <SelectItem value="above10k">Above $10k</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Client Store */}
              <div className="pt-1">
                <Label className="text-xs text-gray-600 block mb-3">
                  Are you setting up a store for a client?
                </Label>
                <RadioGroup value={isForClient} onValueChange={setIsForClient}>
                  <div className="flex items-start space-x-2 mb-3">
                    <RadioGroupItem value="yes" id="r1" />
                    <Label
                      htmlFor="r1"
                      className="text-sm font-normal text-gray-700 cursor-pointer select-none leading-tight"
                    >
                      Yes, I'm designing/developing a store for a client
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="no" id="r2" />
                    <Label
                      htmlFor="r2"
                      className="text-sm font-normal text-gray-700 cursor-pointer select-none leading-tight"
                    >
                      No, this is for my own business
                    </Label>
                  </div>
                </RadioGroup>
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
                  "Next"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}