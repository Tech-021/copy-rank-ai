"use client"
import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Zap, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/client";
import { LoaderChevron } from "@/components/ui/LoaderChevron";

export default function WelcomePage() {
  const [tab, setTab] = useState("tab1");
  const toast = useToast();
  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [currentCompetitorInput, setCurrentCompetitorInput] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");
  const [currentKeywordInput, setCurrentKeywordInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const competitorsCount = [competitor1, competitor2, competitor3].filter(c => c.trim()).length;
  const allCompetitorsAdded = !!(competitor1.trim() && competitor2.trim() && competitor3.trim());
  const keywordsCount = [keyword1, keyword2, keyword3].filter(k => k.trim()).length;
  const allKeywordsAdded = !!(keyword1.trim() && keyword2.trim() && keyword3.trim());
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
        ]
      };

      // If user isn't authenticated, save onboarding to localStorage and redirect to signup
      if (!user) {
        try {
          localStorage.setItem('pendingOnboarding', JSON.stringify(onboardingData));
        } catch (e) {
          console.error('Failed to save pending onboarding:', e);
        }

        toast.showToast({
          title: "Authentication Required",
          description: "Please sign up or log in to continue",
          type: "info",
        });

        setIsLoading(false);
        router.push('/signup');
        return;
      }
  
      // attach userId and perform onboarding now that user is authenticated
      const onboardingDataWithUser = {
        ...onboardingData,
        userId: user.id,
      };
  
      console.log("Onboarding Data:", onboardingData);
  
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(onboardingDataWithUser)
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
    if (tab === "tab1") return "1 of 3";
    if (tab === "tab2") {
      const step = Math.min(competitorsCount + 1, 3);
      return `${step} of 3`;
    }
    if (tab === "tab3") {
      const step = Math.min(keywordsCount + 1, 3);
      return `${step} of 3`;
    }
    return "1 of 3";
  };

  const getStepTitle = () => {
    if (tab === "tab1") return "";
    if (tab === "tab2") {
      if (!competitor1) return "Who is your biggest competitor?";
      if (competitor1 && !competitor2) return "Who is your second competitor?";
      if (competitor1 && competitor2 && !competitor3) return "Who is your third competitor?";
      return "Who is your third competitor?";
    }
    if (tab === "tab3") return allKeywordsAdded ? "" : "Add 3 keywords related to your business";
    return "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0a2818] to-black relative overflow-hidden flex flex-col items-center justify-center">
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
        {/* Ellipse 1 - Bottom */}
        <Image
          src="/ellipse1.png"
          alt="ellipse1"
          fill
          className="absolute bottom-0 left-100 -translate-x-1/2 object-cover opacity-70"
          priority
        />
        {/* Ellipse 2 - Top */}
        <Image
          src="/ellipse2.png"
          alt="ellipse2"
          fill
          className="absolute -top-590 left-59 object-cover z-50 opacity-90"
          priority
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            <div className="rounded-3xl p-2 sm:p-4">
             <Image
             src="/logo.png"
            height={50}
            width={50}
            className="sm:w-[71px] sm:h-[71px]"
             alt="icon"
             />
            </div>
          </div>
         <p className="relative flex items-center justify-center text-green-400/70 text-xs sm:text-sm tracking-wider mb-4 sm:mb-6">
  <span className="absolute left-0 w-1/4 h-px bg-gradient-to-r from-transparent to-green-500/60"></span>

  <span className="px-2 sm:px-4 text-sm sm:text-[16px] text-[#53F870]">
    Getting your dashboard ready
  </span>

  <span className="absolute right-0 w-1/4 h-px bg-gradient-to-l from-transparent to-green-500/60"></span>
</p>
         <h4 className="
  text-5xl sm:text-7xl lg:text-[120px] font-bold
  text-transparent bg-clip-text
  bg-gradient-to-b
  from-[#1F7F2C]
  to-[#5AFF78]
  mb-4 sm:mb-6
  leading-tight
">
  CopyRank
</h4>
{tab === "tab1" && <p className="text-[#53F870] text-sm sm:text-base">Let's start with your website</p>}
        </div>

        {/* Form Container */}
        <div className="bg-transparent backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
          {/* Step Title */}
          <div className="text-center space-y-2">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-[#53F870]">
              {getStepTitle()}
            </h2>
          </div>

          {/* Tab 1 - Website */}
          {tab === "tab1" && (
            <div className="space-y-4 sm:space-y-6">
            <div className="space-y-4">
  <div className="relative">
   <Input
  type="url"
  placeholder="www.mywebsite.com"
  value={websiteName}
  onChange={(e) => setWebsiteName(e.target.value)}
  className="
    w-full font-light! h-10 sm:h-12 pr-20 sm:pr-24
   dark:bg-gradient-to-b
    dark:from-[rgba(46,152,57,0.38)]
    dark:via-[rgba(26,69,26,1)]
    dark:to-[rgba(4,35,13,1)]
    border border-[#2E9839]/40
    rounded-lg
    text-[#53F870]
    text-sm sm:text-base
      focus:outline-none!
    
    placeholder-[#53F870]!
    focus:border-[#2E9839]
    focus:ring-2 focus:ring-[#2E9839]/30
  "
/>

    <Button
      onClick={() => {
        if (validateTab1()) {
          setTab("tab2");
        }
      }}
      className="
        absolute right-1 top-1/2 -translate-y-1/2
        h-8 sm:h-10 px-6 sm:px-9
        bg-[#5AFF78] hover:bg-green-600
        text-black text-sm sm:text-base
        rounded-md
      "
    >
      Next
    </Button>
  </div>
</div>
              <p className="text-center text-gray-500 text-xs sm:text-sm">{getStepNumber()}</p>
            </div>
          )}

          {/* Tab 2 - Competitors */}
          {tab === "tab2" && !isLoading && (
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="www.competitor.com"
                      value={currentCompetitorInput}
                      onChange={(e) => setCurrentCompetitorInput(e.target.value)}
                      disabled={allCompetitorsAdded}
                      className="
                        w-full font-light! h-10 sm:h-12 pr-20 sm:pr-24
                        dark:bg-gradient-to-b
                        dark:from-[rgba(46,152,57,0.38)]
                        dark:via-[rgba(26,69,26,1)]
                        dark:to-[rgba(4,35,13,1)]
                        border border-[#085110]
                        rounded-lg
                        text-[#53F870]
                        text-sm sm:text-base
                        placeholder-[#53F870]!
                        focus:border-[#6dce77]
                      "
                    />
                    <Button
                      onClick={() => {
                        if (allCompetitorsAdded) {
                          if (validateTab2()) {
                            setTab("tab3");
                          }
                        } else {
                          if (!currentCompetitorInput.trim()) {
                            toast.showToast({
                              title: "Empty Input",
                              description: "Please enter a competitor URL",
                              type: "error",
                            });
                            return;
                          }
                          if (!competitor1) {
                            setCompetitor1(currentCompetitorInput.trim());
                          } else if (!competitor2) {
                            setCompetitor2(currentCompetitorInput.trim());
                          } else if (!competitor3) {
                            setCompetitor3(currentCompetitorInput.trim());
                          }
                          setCurrentCompetitorInput("");
                        }
                      }}
                      disabled={isLoading}
                      className="
                        absolute right-1 top-1/2 -translate-y-1/2
                        h-8 sm:h-10 px-6 sm:px-9
                        bg-[#5AFF78] hover:bg-green-600
                        text-black text-sm sm:text-base
                        rounded-md
                      "
                    >
                      {allCompetitorsAdded ? "Next" : "Add"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Competitor Tags Display */}
              {competitorsCount > 0 && (
                <div className="bg-black border border-[#085110] rounded-lg p-3 sm:p-4">
                  <div className="flex flex-wrap gap-2">
                    {competitor1 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <span className="text-green-300">{competitor1}</span>
                        <button
                          onClick={() => setCompetitor1("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                    {competitor2 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <span className="text-green-300">{competitor2}</span>
                        <button
                          onClick={() => setCompetitor2("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                    {competitor3 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <span className="text-green-300">{competitor3}</span>
                        <button
                          onClick={() => setCompetitor3("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-center">
                <div className="">
                <p className="text-gray-500 text-xs sm:text-sm">{getStepNumber()}</p>
              </div>
              </div>

            </div>
          )}

          {/* Tab 3 - Keywords */}
          {tab === "tab3" && !isLoading && (
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="e.g. web design"
                      value={currentKeywordInput}
                      onChange={(e) => setCurrentKeywordInput(e.target.value)}
                      disabled={allKeywordsAdded}
                      className="
                        w-full font-light! h-10 sm:h-12 pr-20 sm:pr-24
                        dark:bg-gradient-to-b
                        dark:from-[rgba(46,152,57,0.38)]
                        dark:via-[rgba(26,69,26,1)]
                        dark:to-[rgba(4,35,13,1)]
                        border border-[#2E9839]/40
                        rounded-lg
                        text-[#53F870]
                        text-sm sm:text-base
                        placeholder-[#53F870]!
                        focus:border-[#2E9839]
                      "
                    />
                    <Button
                      onClick={() => {
                        if (allKeywordsAdded) {
                          if (validateTab3()) {
                            handleNext();
                          }
                        } else {
                          if (!currentKeywordInput.trim()) {
                            toast.showToast({
                              title: "Empty Input",
                              description: "Please enter a keyword",
                              type: "error",
                            });
                            return;
                          }
                          if (!keyword1) {
                            setKeyword1(currentKeywordInput.trim());
                          } else if (!keyword2) {
                            setKeyword2(currentKeywordInput.trim());
                          } else if (!keyword3) {
                            setKeyword3(currentKeywordInput.trim());
                          }
                          setCurrentKeywordInput("");
                        }
                      }}
                      disabled={isLoading}
                      className="
                        absolute right-1 top-1/2 -translate-y-1/2
                        h-8 sm:h-10 px-6 sm:px-9
                        bg-[#5AFF78] hover:bg-green-600
                        text-black text-sm sm:text-base
                        rounded-md
                      "
                    >
                      {allKeywordsAdded ? "Next" : "Add"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Keywords Tags Display */}
              {keywordsCount > 0 && (
                <div className="bg-black border border-[#085110] rounded-lg p-3 sm:p-4">
                  <div className="flex flex-wrap gap-2">
                    {keyword1 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <span className="text-green-300">{keyword1}</span>
                        <button
                          onClick={() => setKeyword1("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                    {keyword2 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <span className="text-green-300">{keyword2}</span>
                        <button
                          onClick={() => setKeyword2("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                    {keyword3 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <span className="text-green-300">{keyword3}</span>
                        <button
                          onClick={() => setKeyword3("")}
                          className="text-green-400 hover:text-green-300"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-center">
                <p className="text-gray-500 text-xs sm:text-sm">{getStepNumber()}</p>
              </div>
            </div>
          )}

          {/* Tab 2 - Loader */}
          {(tab === "tab2" || tab === "tab3") && isLoading && (
            <div className="space-y-4 sm:space-y-6 flex flex-col items-center justify-center py-12 sm:py-16">
              <p className="text-[#53F870] text-xs sm:text-sm mb-8 sm:mb-12">
                Creating your first articles
              </p>
              <LoaderChevron />
            </div>
          )}
        </div>

        {/* Footer */}
      </div>

      {/* Footer - Full Width */}
      <div className="relative w-screen mt-12 sm:mt-20 pt-8 sm:pt-12 left-1/2 -translate-x-1/2">
        {/* Background Image */}
        <Image
          src="/planet.png"
          alt="background"
          width={1520}
          height={500}
          className="w-full object-cover opacity-60 pointer-events-none"
          priority
        />
        
        {/* Footer Content */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 sm:gap-6 py-6 sm:py-8 px-4">
          {/* Social Icons */}
       <div className="flex items-center gap-3 sm:gap-4">
  {/* X / Twitter */}
  <a href="https://twitter.com/yourprofile" target="_blank" rel="noopener noreferrer">
    <Image
      src="/xpng.png"
      alt="X / Twitter"
      height={25}
      width={25}
    />
  </a>

  {/* Threads */}
  <a href="https://www.threads.net/yourprofile" target="_blank" rel="noopener noreferrer">
    <Image
      src="/thread.png"
      alt="Threads"
      height={25}
      width={25}
    />
  </a>

  {/* LinkedIn */}
  <a href="https://www.linkedin.com/in/yourprofile" target="_blank" rel="noopener noreferrer">
    <Image
      src="/in.png"
      alt="LinkedIn"
      height={25}
      width={25}
    />
  </a>
</div>

          {/* Logo and Text */}
          <div className="flex flex-col items-center gap-2 sm:gap-4">
            {/* Mobile Layout - Stacked */}
            <div className="lg:hidden flex flex-col items-center gap-2 text-[#53F870]">
              <a href="#" className="text-xs hover:text-green-400 transition-colors">Terms & Conditions</a>
              <a href="#" className="text-xs hover:text-green-400 transition-colors">Privacy Policy</a>
            </div>
            
            {/* Desktop Layout - Inline with dot */}
            <div className="hidden lg:flex items-center gap-4 text-[#53F870] text-sm">
              <a href="#" className="hover:text-green-400 transition-colors">Terms & Conditions</a>
              <span className="text-[#5AFF78]">•</span>
              <a href="#" className="hover:text-green-400 transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}