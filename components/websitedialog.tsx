"use client";

import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/client";

interface MyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function Dialog1({ open, onOpenChange }: MyDialogProps) {
  const [tab, setTab] = useState("tab1");
  const toast = useToast();
  const [ isDialogOpen, setIsDialogOpen ] = useState(true)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[1200px] max-h-[600px] overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-x-hidden  px-0 py-0 ">
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>

    {isDialogOpen && 
    (<div className="dialog flex gap-[60px] w-full">
      {/* Left section */}
      <div className="relative w-[500px] h-[780px] bg-[linear-gradient(to_top,rgb(31,135,61)_0%,rgb(44,162,74)_100%)] overflow-hidden p-10 flex flex-col gap-10 rounded-l-lg">
        <div>
          <Image src="/dialog_logo.png" alt="" width={50} height={50} />
        </div>
        <div className="flex flex-col gap-4 relative items-center justify-center mt-14">
          <h1 className="text-white font-normal text-[38px]">
            A few clicks away <br />
            from generating your <br />
            SEO optimized blogs
          </h1>
          <p className="text-white font-normal text-sm max-w-lg">
            Instantly analyze your niche, target high-volume keywords, and{" "}
            <br />
            publish content that converts.
          </p>
          <Image
            src="/dialog_bg.png"
            alt=""
            width={650}
            height={420}
            className="absolute -right-40 -bottom-64"
          />
        </div>
        <Image
          src="/line1.png"
          alt=""
          width={968}
          height={558}
          className="absolute top-100 left-0"
        />
        <Image
          src="/line2.png"
          alt=""
          width={682}
          height={398}
          className="absolute top-82 left-0"
        />
        <Image
          src="/line3.png"
          alt=""
          width={1148}
          height={662}
          className="absolute top-16 left-0"
        />
      </div>
      {/* Right section */}
      <div className="py-10 pr-10 flex flex-col gap-[140px] w-[700px]">
        <div className="w-[600px] text-right">
          <p className="text-[15px] font-normal text-[#00000080]">
            Having troubles?{" "}
            <span className="text-[#5baf57] font-normal cursor-pointer">
              Get Help
            </span>
          </p>
        </div>
        {tab === "tab1" && (
          <div className="flex flex-col gap-60">
            <div className="flex flex-col gap-[30px]">
              <div>
                <h1 className="text-[#000000B3] text-lg font-normal">
                  Website URL
                </h1>
                <p className="text-[15px] text-[#00000080] font-normal">
                  Start with your domain
                </p>
              </div>
              <div className="space-y-5">
                {/* Website Name */}
                <div>
                  <Input
                    type="text"
                    placeholder="Enter your website URL"
                    value={websiteName}
                    onChange={(e) => setWebsiteName(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => {
                    validateTab1()
                    setTab("tab2")}}
                  className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer"
                >
                  Next
                </button>
              </div>
              <div>
                <p className="text-sm text-[#0000004D] font-normal">1 of 3</p>
              </div>
            </div>
            <div>
                <button
                // onClick={() => setTab('tab2')}
                className="flex text-[#000000b3] text-[15px] items-center cursor-pointer"
                ><ChevronLeft />Back</button>
            </div>
          </div>
        )}
        {tab === "tab2" && (
          <div className="flex flex-col gap-30">
            <div className="flex flex-col gap-[30px]">
              <div>
                <h1 className="text-[#000000B3] text-lg font-normal">
                  Top 3 Competitiors
                </h1>
                <p className="text-[15px] text-[#00000080] font-normal">
                  Who are you Beating
                </p>
              </div>
              <div className="space-y-5">
                {/* Competitors Name */}
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Competitor 1"
                    value={competitor1}
                    onChange={(e) => setCompetitor1(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 2"
                    value={competitor2}
                    onChange={(e) => setCompetitor2(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Competitor 3"
                    value={competitor3}
                    onChange={(e) => setCompetitor3(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => {
                    validateTab2();
                    setTab("tab3")
                  }}
                  className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer"
                >
                  Next
                </button>
              </div>
              <div>
                <p className="text-sm text-[#0000004D] font-normal">2 of 3</p>
              </div>
            </div>
            <div>
                <button
                onClick={() => setTab('tab1')}
                className="flex text-[#000000b3] text-[15px] items-center cursor-pointer"
                ><ChevronLeft />Back</button>
            </div>
          </div>
        )}
        {tab === "tab3" && (
          <div className="flex flex-col gap-30">
            <div className="flex flex-col gap-[30px]">
              <div>
                <h1 className="text-[#000000B3] text-lg font-normal">
                  Keywords
                </h1>
                <p className="text-[15px] text-[#00000080] font-normal">
                  What do you want rank for?
                </p>
              </div>
              <div className="space-y-5">
                {/* Website Name */}
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Keyword 1"
                    value={keyword1}
                    onChange={(e) => setKeyword1(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 2"
                    value={keyword2}
                    onChange={(e) => setKeyword2(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                  <Input
                    type="text"
                    placeholder="Keyword 3"
                    value={keyword3}
                    onChange={(e) => setKeyword3(e.target.value)}
                    className="w-[500px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => {
                    validateTab3();
                    setTab("tab3")}}
                  className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer"
                >
                  Submit
                </button>
              </div>
              <div>
                <p className="text-sm text-[#0000004D] font-normal">3 of 3</p>
              </div>
            </div>
            <div>
                <button
                onClick={() => setTab('tab2')}
                className="flex text-[#000000b3] text-[15px] items-center cursor-pointer"
                ><ChevronLeft />Back</button>
            </div>
          </div>
        )}
      </div>
    </div>)}
    </DialogContent>
    </Dialog>
  );
}
