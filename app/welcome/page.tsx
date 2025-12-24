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
    if (tab === "tab1") return "1 of 3";
    if (tab === "tab2") return "2 of 3";
    if (tab === "tab3") return "3 of 3";
    return "1 of 3";
  };

  const getStepTitle = () => {
    if (tab === "tab1") return "";
    if (tab === "tab2") return "Who are your top 3 competitors?";
    if (tab === "tab3") return "Add 3 keywords related to your business";
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
         <p className="relative flex items-center justify-center text-green-400/70 text-sm tracking-wider mb-6">
  <span className="absolute left-0 w-1/4 h-px bg-gradient-to-r from-transparent to-green-500/60"></span>

  <span className="px-4 text-[16px] text-[#53F870]">
    Getting your dashboard ready
  </span>

  <span className="absolute right-0 w-1/4 h-px bg-gradient-to-l from-transparent to-green-500/60"></span>
</p>
         <h4 className="
  text-[120px] font-bold
  text-transparent bg-clip-text
  bg-gradient-to-b
  from-[#1F7F2C]
  to-[#5AFF78]
  mb-6
">
  CopyRank
</h4>
{tab === "tab1" && <p className="text-[#53F870]">Let's start with your website</p>}
        </div>

        {/* Form Container */}
        <div className="bg-transparent backdrop-blur-md  rounded-2xl p-8 space-y-8">
          {/* Step Title */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-[#53F870]">
              {getStepTitle()}
            </h2>
          </div>

          {/* Tab 1 - Website */}
          {tab === "tab1" && (
            <div className="space-y-6">
            <div className="space-y-4">
  <div className="relative  ">
   <Input
  type="url"
  placeholder="www.mywebsite.com"
  value={websiteName}
  onChange={(e) => setWebsiteName(e.target.value)}
  className="
    w-full font-light! h-12 pr-24
   dark:bg-gradient-to-b
    dark:from-[rgba(46,152,57,0.38)]
    dark:via-[rgba(26,69,26,1)]
    dark:to-[rgba(4,35,13,1)]
    border border-[#2E9839]/40
    rounded-lg
    text-[#53F870]
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
        h-10 px-9
        bg-[#5AFF78] hover:bg-green-600
        text-black 
        rounded-md
      "
    >
      Next
    </Button>
  </div>
</div>
              <p className="text-center text-gray-500 text-sm">{getStepNumber()}</p>
            </div>
          )}

          {/* Tab 2 - Competitors */}
          {tab === "tab2" && !isLoading && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  {/* <label className="text-sm text-gray-400">
                    {allCompetitorsAdded ? "All Competitors Added" : `Add Competitor ${competitorsCount + 1} of 3`}
                  </label> */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="www.competitor.com"
                      value={currentCompetitorInput}
                      onChange={(e) => setCurrentCompetitorInput(e.target.value)}
                      disabled={allCompetitorsAdded}
                      className="
                        w-full font-light! h-12 pr-24
                        dark:bg-gradient-to-b
                        dark:from-[rgba(46,152,57,0.38)]
                        dark:via-[rgba(26,69,26,1)]
                        dark:to-[rgba(4,35,13,1)]
                        border border-[#085110]
                        rounded-lg
                        text-[#53F870]
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
                        h-10 px-9
                        bg-[#5AFF78] hover:bg-green-600
                        text-black 
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
                <div className="bg-black border border-[#085110] rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {competitor1 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-3 py-1">
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
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-3 py-1">
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
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-3 py-1">
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
              
              <div className="flex items-center justify-center">
                {/* <button
                  onClick={() => setTab("tab1")}
                  className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button> */}
                <div className="">
                <p className="text-gray-500 text-sm">{getStepNumber()}</p>
              </div>
              </div>

            </div>
          )}

          {/* Tab 3 - Keywords */}
          {tab === "tab3" && !isLoading && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  {/* <label className="text-sm text-gray-400">
                    {allKeywordsAdded ? "All Keywords Added" : `Add Keyword ${keywordsCount + 1} of 3`}
                  </label> */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="e.g. web design"
                      value={currentKeywordInput}
                      onChange={(e) => setCurrentKeywordInput(e.target.value)}
                      disabled={allKeywordsAdded}
                      className="
                        w-full font-light! h-12 pr-24
                        dark:bg-gradient-to-b
                        dark:from-[rgba(46,152,57,0.38)]
                        dark:via-[rgba(26,69,26,1)]
                        dark:to-[rgba(4,35,13,1)]
                        border border-[#2E9839]/40
                        rounded-lg
                        text-[#53F870]
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
                        h-10 px-9
                        bg-[#5AFF78] hover:bg-green-600
                        text-black 
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
                <div className="bg-black border border-[#085110] rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {keyword1 && (
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-3 py-1">
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
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-3 py-1">
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
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-[5px] px-3 py-1">
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
              
              <div className="flex items-center justify-center">
                {/* <button
                  onClick={() => setTab("tab2")}
                  className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button> */}
                <p className="text-gray-500 text-sm">{getStepNumber()}</p>
              </div>
            </div>
          )}

          {/* Tab 2 - Loader */}
          {(tab === "tab2" || tab === "tab3") && isLoading && (
            <div className="space-y-6 flex flex-col items-center justify-center py-16">
              <p className="text-[#53F870] text-sm tracking-wider">
                Getting your dashboard ready
              </p>
              <h2 className="text-6xl font-bold text-white mb-8">
                CopyRank
              </h2>
              <p className="text-gray-400 text-sm mb-12">
                Creating your first articles
              </p>
              <div className="animate-spin">
                <Image src="/loader.png" alt="Loading" width={92} height={92} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
      </div>

      {/* Footer - Full Width */}
      <div className="relative w-screen mt-20 pt-12 left-1/2 -translate-x-1/2">
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
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 py-8">
          {/* Social Icons */}
          <div className="flex items-center gap-4">
            <a href="#" className="text-[#53F870] hover:text-green-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 9-1 9-5.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
              </svg>
            </a>
            <a href="#" className="text-[#53F870] hover:text-green-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4m0-2c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm5.5-1.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5-.672-1.5-1.5-1.5-1.5.672-1.5 1.5z"/>
              </svg>
            </a>
            <a href="#" className="text-[#53F870] hover:text-green-400 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
          </div>

          {/* Logo and Text */}
          <div className="flex flex-col items-center gap-4">
            {/* <Image
              src="/logo.png"
              height={40}
              width={40}
              alt="logo"
            /> */}
            <div className="flex items-center gap-4 text-[#53F870] text-sm">
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