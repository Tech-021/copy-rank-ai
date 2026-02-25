"use client";

import { useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/client";
import { Loader2, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// ---------------------------
// SIMPLE KEYWORD GAP TESTER (DEV ONLY)
// ---------------------------
function KeywordGapTester() {
  const [clientDomain, setClientDomain] = useState("");
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientDomain: clientDomain.trim(),
          competitors: [competitorDomain.trim()],
          targetKeywords: keywords.filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch keywords");
      }
      setResults(data.keywords || []);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 my-8 bg-gray-50 max-w-xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">Keyword Gap Tester (DEV)</h2>
      <div className="flex flex-col gap-3 mb-4">
        <Input
          placeholder="Your Website URL"
          value={clientDomain}
          onChange={e => setClientDomain(e.target.value)}
        />
        <Input
          placeholder="Competitor URL"
          value={competitorDomain}
          onChange={e => setCompetitorDomain(e.target.value)}
        />
        <Input
          placeholder="Comma separated keywords (optional)"
          value={keywords.join(", ")}
          onChange={e => setKeywords(e.target.value.split(",").map(k => k.trim()))}
        />
        <button
          className="bg-[#5baf57] text-white rounded px-4 py-2 mt-2 disabled:opacity-60"
          onClick={handleFetch}
          disabled={loading || !clientDomain || !competitorDomain}
        >
          {loading ? "Fetching..." : "Fetch Keyword Gap"}
        </button>
      </div>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {results.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Results:</h3>
          <ul className="max-h-60 overflow-y-auto border rounded bg-white p-2">
            {results.map((kw, i) => (
              <li key={i} className="py-1 px-2 border-b last:border-b-0 text-sm">
                {kw.keyword} <span className="text-gray-400">({kw.search_volume})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function OnboardingDialog({
  inline = false,
  showDevTester = process.env.NODE_ENV === "development",
}: {
  inline?: boolean
  showDevTester?: boolean
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(!inline);

  const [tab, setTab] = useState("tab1");

  const [websiteName, setWebsiteName] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [keywords, setKeywords] = useState<string[]>([""]);

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
    const hasCompetitor = competitors.some((c) => c.trim());
    if (!hasCompetitor) {
      toast.showToast({
        title: "Competitor Missing",
        description: "Please enter at least one competitor.",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const validateTab3 = () => true;

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
        competitors: competitors.map((c) => c.trim()).filter(Boolean),
        targetKeywords: keywords.map((k) => k.trim()).filter(Boolean),
        userId: user.id,
      };

      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No valid session found");
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
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
      setCompetitors([""]);
      setKeywords([""]);
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
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

  const content = (
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
                      Competitors
              </h1>

              <div className="space-y-2">
                      {competitors.map((value, index) => (
                        <div key={`competitor-${index}`} className="flex items-center gap-2">
                          <Input
                            placeholder={`Competitor ${index + 1}`}
                            value={value}
                            onChange={(e) => {
                              const next = [...competitors]
                              next[index] = e.target.value
                              setCompetitors(next)
                            }}
                          />
                          {competitors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCompetitors((prev) =>
                                  prev.filter((_, i) => i !== index)
                                )
                              }}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCompetitors((prev) => [...prev, ""])}
                        className="text-xs text-[#5baf57] hover:text-[#4a9a48] w-fit"
                      >
                        + Add another competitor
                      </button>
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
                      {keywords.map((value, index) => (
                        <div key={`keyword-${index}`} className="flex items-center gap-2">
                          <Input
                            placeholder={`Keyword ${index + 1}`}
                            value={value}
                            onChange={(e) => {
                              const next = [...keywords]
                              next[index] = e.target.value
                              setKeywords(next)
                            }}
                          />
                          {keywords.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setKeywords((prev) =>
                                  prev.filter((_, i) => i !== index)
                                )
                              }}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setKeywords((prev) => [...prev, ""])}
                        className="text-xs text-[#5baf57] hover:text-[#4a9a48] w-fit"
                      >
                        + Add another keyword
                      </button>
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
  );

  return (
    <>
      {showDevTester && <KeywordGapTester />}
      {inline ? (
        <div className="min-w-[1200px] px-0 py-0 max-h-[650px] overflow-y-scroll overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {content}
        </div>
      ) : (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="min-w-[1200px] px-0 py-0 max-h-[650px] overflow-y-scroll overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <VisuallyHidden>
              <DialogTitle></DialogTitle>
            </VisuallyHidden>
            {content}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
