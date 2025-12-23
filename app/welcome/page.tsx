"use client"
import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Zap, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/client";

export default function WelcomePage() {
  const [tab, setTab] = useState("tab1");
  const toast = useToast();
  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const validateTab1 = () => {
    if (!websiteName.trim()) {
      toast.showToast({
        title: "Missing Website URL",
        description: "Please enter your website URL to continue.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const validateTab2 = () => {
    if (!competitor1.trim() || !competitor2.trim() || !competitor3.trim()) {
      toast.showToast({
        title: "Missing Competitors",
        description: "Please enter all 3 competitors to continue.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const validateTab3 = () => {
    if (!keyword1.trim() || !keyword2.trim() || !keyword3.trim()) {
      toast.showToast({
        title: "Missing Keywords",
        description: "Please enter all 3 keywords before submitting.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    setIsLoading(true);
    
    try {
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
  
      const onboardingData = {
        clientDomain: websiteName.trim(),
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
      
      toast.showToast({
        title: "Website Added Successfully!",
        description: `Found ${data.totalKeywords} keywords. 30 articles are being generated in the background.`,
        type: "success",
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      router.push("/dashboard");
      
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

  const getStepNumber = () => {
    if (tab === "tab1") return "1 of 5";
    if (tab === "tab2") return "2 of 5";
    if (tab === "tab3") return "5 of 5";
    return "1 of 5";
  };

  const getStepTitle = () => {
    if (tab === "tab1") return "Let's start with your website";
    if (tab === "tab2") return "Who are your top 3 competitors?";
    if (tab === "tab3") return "Add 3 keywords related to your business";
    return "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0a2818] to-black relative overflow-hidden flex items-center justify-center">
      {/* Background Image */}
      <Image
        src="/planet.png"
        alt="background"
        fill
        className="absolute bottom-0 right-0 object-cover opacity-40 pointer-events-none"
        priority
      />

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-green-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-green-500/10 to-transparent"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-8">
            <div className=" rounded-3xl p-4">
             <Image
             src="/logo.png"
            height={71}
            width={71}
             alt="icon"
             />
            </div>
          </div>
          <p className="text-green-400/70 text-sm tracking-wider mb-6">
            Getting your dashboard ready
          </p>
          <h4 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-300 mb-6">
            CopyRank
          </h4>
        </div>

        {/* Form Container */}
        <div className="bg-black/60 backdrop-blur-md border border-green-500/20 rounded-2xl p-8 space-y-8">
          {/* Step Title */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-white">
              {getStepTitle()}
            </h2>
          </div>

          {/* Tab 1 - Website */}
          {tab === "tab1" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <Input
                  type="url"
                  placeholder="www.mywebsite.com"
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
              </div>
              <Button
                onClick={() => {
                  if (validateTab1()) {
                    setTab("tab2");
                  }
                }}
                className="w-full h-12 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-lg transition-colors"
              >
                Next
              </Button>
              <p className="text-center text-gray-500 text-sm">{getStepNumber()}</p>
            </div>
          )}

          {/* Tab 2 - Competitors */}
          {tab === "tab2" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="www.competitor1.com"
                  value={competitor1}
                  onChange={(e) => setCompetitor1(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
                <Input
                  type="text"
                  placeholder="www.competitor2.com"
                  value={competitor2}
                  onChange={(e) => setCompetitor2(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
                <Input
                  type="text"
                  placeholder="www.competitor3.com"
                  value={competitor3}
                  onChange={(e) => setCompetitor3(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
              </div>

              {/* Competitor Tags Display */}
              {(competitor1 || competitor2 || competitor3) && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {competitor1 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <span className="text-sm text-green-300">{competitor1}</span>
                        <button
                          onClick={() => setCompetitor1("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {competitor2 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <span className="text-sm text-green-300">{competitor2}</span>
                        <button
                          onClick={() => setCompetitor2("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {competitor3 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <span className="text-sm text-green-300">{competitor3}</span>
                        <button
                          onClick={() => setCompetitor3("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={() => {
                  if (validateTab2()) {
                    setTab("tab3");
                  }
                }}
                className="w-full h-12 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-lg transition-colors"
              >
                Next
              </Button>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setTab("tab1")}
                  className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <p className="text-gray-500 text-sm">{getStepNumber()}</p>
              </div>
            </div>
          )}

          {/* Tab 3 - Keywords */}
          {tab === "tab3" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Keyword 1"
                  value={keyword1}
                  onChange={(e) => setKeyword1(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
                <Input
                  type="text"
                  placeholder="Keyword 2"
                  value={keyword2}
                  onChange={(e) => setKeyword2(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
                <Input
                  type="text"
                  placeholder="Keyword 3"
                  value={keyword3}
                  onChange={(e) => setKeyword3(e.target.value)}
                  className="w-full h-12 bg-green-500/10 border border-green-500/30 rounded-lg text-white placeholder-gray-500 focus:border-green-500/60 focus:ring-green-500/20"
                />
              </div>

              {/* Keyword Tags Display */}
              {(keyword1 || keyword2 || keyword3) && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {keyword1 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <span className="text-sm text-green-300">{keyword1}</span>
                        <button
                          onClick={() => setKeyword1("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {keyword2 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <span className="text-sm text-green-300">{keyword2}</span>
                        <button
                          onClick={() => setKeyword2("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {keyword3 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <span className="text-sm text-green-300">{keyword3}</span>
                        <button
                          onClick={() => setKeyword3("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={() => {
                  if (validateTab3()) {
                    handleNext();
                  }
                }}
                disabled={isLoading}
                className="w-full h-12 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></span>
                    Submitting...
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setTab("tab2")}
                  className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <p className="text-gray-500 text-sm">{getStepNumber()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Terms & Conditions • Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}