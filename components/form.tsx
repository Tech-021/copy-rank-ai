"use client";

import { useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/client";
import { Loader2, ChevronLeft } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export default function OnboardingDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  const [tab, setTab] = useState("tab1");

  const [websiteName, setWebsiteName] = useState("");
  const [competitor1, setCompetitor1] = useState("");
  const [competitor2, setCompetitor2] = useState("");
  const [competitor3, setCompetitor3] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [keyword3, setKeyword3] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  // ---------------------------
  // VALIDATION FUNCTIONS
  // ---------------------------
  const validateTab1 = () => {
    if (!websiteName.trim()) {
      toast.showToast({
        title: "Website URL Missing",
        description: "Please enter your website URL before continuing.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const validateTab2 = () => {
    if (!competitor1.trim() || !competitor2.trim() || !competitor3.trim()) {
      toast.showToast({
        title: "Competitors Missing",
        description: "Please enter all 3 competitors.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const validateTab3 = () => {
    if (!keyword1.trim() || !keyword2.trim() || !keyword3.trim()) {
      toast.showToast({
        title: "Keywords Missing",
        description: "Please enter all 3 keywords before submitting.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const nextTab = (current: string) => {
    if (current === "tab1" && validateTab1()) setTab("tab2");
    if (current === "tab2" && validateTab2()) setTab("tab3");
  };

  // ---------------------------
  // SUBMIT FUNCTION
  // ---------------------------
  const handleSubmitOnboarding = async () => {
    if (!validateTab3()) return;

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.showToast({
          title: "Not Logged In",
          description: "Please log in to continue.",
          type: "error",
        });
        return;
      }

      const payload = {
        clientDomain: websiteName.trim(),
        competitors: [
          competitor1.trim(),
          competitor2.trim(),
          competitor3.trim(),
        ],
        targetKeywords: [
          keyword1.trim(),
          keyword2.trim(),
          keyword3.trim(),
        ],
        userId: user.id,
      };

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Onboarding failed");
      }

      toast.showToast({
        title: "Website Added!",
        description: `Found ${data.totalKeywords} keywords. Generating articles…`,
        type: "success",
      });

      setIsDialogOpen(false);

      // Reset
      setWebsiteName("");
      setCompetitor1("");
      setCompetitor2("");
      setCompetitor3("");
      setKeyword1("");
      setKeyword2("");
      setKeyword3("");
    } catch (err: any) {
      toast.showToast({
        title: "Error",
        description: err.message || "Something went wrong",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="min-w-[1200px] px-0 py-0 max-h-[650px] overflow-y-scroll overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>

        <div className="dialog flex gap-[60px] w-full">

          {/* LEFT SIDE (STATIC UI) */}
          <div className="relative w-[500px] h-[780px] bg-[linear-gradient(to_top,rgb(31,135,61)_0%,rgb(44,162,74)_100%)] p-10 flex flex-col gap-10 rounded-l-lg overflow-hidden">
            <Image src="/dialog_logo.png" width={50} height={50} alt="" />

            <div className="flex flex-col items-center mt-14 relative">
              <h1 className="text-white font-normal text-[38px] leading-tight text-center">
                A few clicks away
                <br />
                from generating your
                <br />
                SEO optimized blogs
              </h1>

              <p className="text-white font-normal text-sm text-center mt-4">
                Instantly analyze your niche, target keywords, and publish content.
              </p>

              <Image
                src="/dialog_bg.png"
                width={650}
                height={420}
                alt=""
                className="absolute -right-40 -bottom-64"
              />
            </div>
          </div>

          {/* RIGHT SIDE (TABS) */}
          <div className="py-10 pr-10 flex flex-col gap-[140px] w-[700px]">

            <div className="text-right w-[600px]">
              <p className="text-[15px] text-[#00000080]">
                Having troubles?{" "}
                <span className="text-[#5baf57] cursor-pointer">Get Help</span>
              </p>
            </div>

            {/* ---------------- TAB 1 ---------------- */}
            {tab === "tab1" && (
              <div className="flex flex-col justify-between h-full">
                <div className="flex flex-col gap-[30px]">
                  <h1 className="text-[#000000B3] text-lg font-normal">
                    Website URL
                  </h1>

                  <Input
                    placeholder="Enter your website URL"
                    value={websiteName}
                    onChange={(e) => setWebsiteName(e.target.value)}
                    className="w-[500px] h-[50px]"
                  />

                  <button
                    onClick={() => nextTab("tab1")}
                    className="bg-[#5baf57] text-white w-[170px] h-[50px] rounded-[10px]"
                  >
                    Next
                  </button>

                  <p className="text-sm text-[#0000004D]">1 of 3</p>
                </div>

                <button className="flex text-[#000000b3] items-center">
                  <ChevronLeft />
                  Back
                </button>
              </div>
            )}

            {/* ---------------- TAB 2 ---------------- */}
            {tab === "tab2" && (
              <div className="flex flex-col justify-between h-full">
                <div className="flex flex-col gap-[30px]">
                  <h1 className="text-[#000000B3] text-lg font-normal">
                    Top 3 Competitors
                  </h1>

                  <div className="space-y-2">
                    <Input
                      placeholder="Competitor 1"
                      value={competitor1}
                      onChange={(e) => setCompetitor1(e.target.value)}
                    />
                    <Input
                      placeholder="Competitor 2"
                      value={competitor2}
                      onChange={(e) => setCompetitor2(e.target.value)}
                    />
                    <Input
                      placeholder="Competitor 3"
                      value={competitor3}
                      onChange={(e) => setCompetitor3(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={() => nextTab("tab2")}
                    className="bg-[#5baf57] text-white w-[170px] h-[50px] rounded-[10px]"
                  >
                    Next
                  </button>

                  <p className="text-sm text-[#0000004D]">2 of 3</p>
                </div>

                <button
                  onClick={() => setTab("tab1")}
                  className="flex text-[#000000b3] items-center"
                >
                  <ChevronLeft />
                  Back
                </button>
              </div>
            )}

            {/* ---------------- TAB 3 ---------------- */}
            {tab === "tab3" && (
              <div className="flex flex-col justify-between h-full">
                <div className="flex flex-col gap-[30px]">
                  <h1 className="text-[#000000B3] text-lg font-normal">
                    Keywords
                  </h1>

                  <div className="space-y-2">
                    <Input
                      placeholder="Keyword 1"
                      value={keyword1}
                      onChange={(e) => setKeyword1(e.target.value)}
                    />
                    <Input
                      placeholder="Keyword 2"
                      value={keyword2}
                      onChange={(e) => setKeyword2(e.target.value)}
                    />
                    <Input
                      placeholder="Keyword 3"
                      value={keyword3}
                      onChange={(e) => setKeyword3(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleSubmitOnboarding}
                    disabled={isSubmitting}
                    className="bg-[#5baf57] text-white w-[170px] h-[50px] rounded-[10px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Setting up...
                      </div>
                    ) : (
                      "Submit"
                    )}
                  </button>

                  <p className="text-sm text-[#0000004D]">3 of 3</p>
                </div>

                <button
                  onClick={() => setTab("tab2")}
                  className="flex text-[#000000b3] items-center"
                >
                  <ChevronLeft />
                  Back
                </button>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
