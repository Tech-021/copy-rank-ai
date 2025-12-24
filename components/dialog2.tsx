"use client";

import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { CreatePostDialog } from "./ui/CreatePostDialog";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/client";
import { useToast } from "./ui/toast";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId?: string | null;
  onCreated?: () => void;
}

export function CreatePostDialogDashboard({
  open,
  onOpenChange,
  websiteId,
  onCreated,
}: CreatePostDialogProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogCompleted, setDialogCompleted] = useState(false);
  const [customKeyword, setCustomKeyword] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(
    null
  );
  const [selectedSeoKeywords, setSelectedSeoKeywords] = useState<string[]>([]);
  const [selectedSeoKeyword, setSelectedSeoKeyword] = useState<string | null>(
    null
  );
  const [selectedCompetitorKeywords, setSelectedCompetitorKeywords] = useState<
    string[]
  >([]);
  const [competitorKeywordSuggestions, setCompetitorKeywordSuggestions] =
    useState<string[]>([]);
  const [competitorKeywordMap, setCompetitorKeywordMap] = useState<
    Record<string, string[]>
  >({});
  const [competitorOptions, setCompetitorOptions] = useState<string[]>([]);
  const [keywordSuggestions, setKeywordSuggestions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStart, setLoadingStart] = useState<number | null>(null);
  const toast = useToast();

  const fallbackSuggestions = [
    "web design",
    "framer",
    "web development",
    "technology tutorial",
    "web development guide",
  ];

  // Loading/Completion dialog is now driven by actual enqueue status
  // instead of a timer. We open the loading dialog when submitting,
  // and set completion based on the API response.

  useEffect(() => {
    const loadOptions = async () => {
      if (!open) return;
      setLoadingOptions(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        let query = supabase
          .from("websites")
          .select("keywords, id")
          .eq("user_id", user.id);
        if (websiteId) query = query.eq("id", websiteId);
        const { data, error } = await query;
        if (error) throw error;

        const competitors: string[] = [];
        const keywords: string[] = [];
        const compKeywordMap: Record<string, string[]> = {};

        (data || []).forEach((site) => {
          const payload = (site as any)?.keywords || {};
          const compArr = Array.isArray(payload?.competitors)
            ? payload.competitors
            : [];
          compArr.forEach((c: any) => {
            const domain = typeof c === "string" ? c : c?.domain;
            if (domain && !competitors.includes(domain))
              competitors.push(domain);

            const cKeywordsRaw = Array.isArray(c?.keywords) ? c.keywords : [];
            const cKeywords: string[] = [];
            cKeywordsRaw.forEach((k: any) => {
              const val =
                typeof k === "string" ? k : k?.keyword || k?.name || k;
              if (val) cKeywords.push(String(val));
            });
            if (domain) {
              compKeywordMap[domain] = Array.from(new Set(cKeywords));
            }
          });

          const kwArr = Array.isArray(payload?.keywords)
            ? payload.keywords
            : [];
          kwArr.forEach((k: any) => {
            const val = typeof k === "string" ? k : k?.keyword || k?.name || k;
            if (val && !keywords.includes(val)) keywords.push(val);
          });
        });

        setCompetitorOptions(competitors);
        setKeywordSuggestions(keywords);
        setCompetitorKeywordMap(compKeywordMap);
      } catch (err) {
        console.error("Error loading competitor/keyword options:", err);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, [open, websiteId]);

  useEffect(() => {
    if (!selectedCompetitor) {
      setCompetitorKeywordSuggestions([]);
      setSelectedCompetitorKeywords([]);
      return;
    }
    const list = competitorKeywordMap[selectedCompetitor] || [];
    setCompetitorKeywordSuggestions(list);
    // reset selection when competitor changes
    setSelectedCompetitorKeywords([]);
  }, [selectedCompetitor, competitorKeywordMap]);

  return (
    <div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="min-w-[90vw] lg:min-w-[640px] w-full max-h-[85vh] lg:max-h-[600px] overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <VisuallyHidden>
            <DialogTitle></DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col gap-4 sm:gap-[30px]">
            <div className="flex flex-col gap-1.5 sm:gap-2.5">
              <h2 className="text-base sm:text-lg lg:text-3xl text-white font-normal">
                Choose what to write about
              </h2>
              <p className="text-xs sm:text-[15px] text-white">
                Pick a keyword as the focus for this post
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:gap-5">
              {/* 1) Competitor selection */}
              <div className="flex flex-col gap-2 sm:gap-2.5">
                <Select
                  value={selectedCompetitor ?? undefined}
                  onValueChange={setSelectedCompetitor}
                >
                  <SelectTrigger className="w-full h-14 sm:h-[60px]! bg-gradient-to-b text-[#53F870]! from-[#002B07] to-[#1A451A] border border-[#53F870] text-xs sm:text-sm">
                    <SelectValue placeholder="From Competitor" />
                  </SelectTrigger>
                  <SelectContent>
                    {competitorOptions.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No competitors found
                      </SelectItem>
                    ) : (
                      competitorOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {/* 1b) Competitor keyword chips - multi-select */}
                <div className="flex items-start justify-start gap-1.5 flex-wrap bg-transparent border border-[#53F870]! rounded-xl p-2 sm:p-3.5 w-full min-h-20 sm:min-h-[82px]">
                  {competitorKeywordSuggestions.length === 0 ? (
                    <p className="text-xs text-[#ffffff80]">
                      Select a competitor to see their keywords.
                    </p>
                  ) : (
                    competitorKeywordSuggestions.slice(0, 16).map((kw) => (
                      <button
                        key={kw}
                        onClick={() => {
                          setSelectedCompetitorKeywords((prev) =>
                            prev.includes(kw)
                              ? prev.filter((k) => k !== kw)
                              : [...prev, kw]
                          );
                        }}
                        className={`border border-[#53F870] bg-[rgba(114,235,98,0.13)] rounded-[5px] px-2 py-1 text-[9px] sm:text-[10px] text-[#53F870] font-normal cursor-pointer hover:border-black ${
                          selectedCompetitorKeywords.includes(kw)
                            ? "border-black text-[#53F870]"
                            : "border-[#0000004d] text-[#53F870]"
                        }`}
                        type="button"
                      >
                        {kw}
                      </button>
                    ))
                  )}
                </div>
                {/* 2) Current website SEO keywords select */}
                <Select
                  value={selectedSeoKeyword ?? undefined}
                  onValueChange={setSelectedSeoKeyword}
                >
                  <SelectTrigger className="w-full h-14 sm:h-[60px]! bg-gradient-to-b text-[#53F870]! from-[#002B07] to-[#1A451A] border-[#0000001a] text-xs sm:text-sm">
                    <SelectValue placeholder="From Your Keywords" />
                  </SelectTrigger>
                  <SelectContent>
                    {keywordSuggestions.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No keywords found
                      </SelectItem>
                    ) : (
                      keywordSuggestions.slice(0, 50).map((kw) => (
                        <SelectItem key={kw} value={kw}>
                          {kw}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {/* 2b) Current website SEO keyword chips - multi-select */}
                <div className="flex items-start justify-start bg-transparent border border-[#53F870]! gap-1.5 flex-wrap bg-[rgb(247,247,247)] rounded-xl p-3.5 lg:w-full w-[282px] min-h-[82px]">
                  {loadingOptions ? (
                    <p className="text-xs text-[#00000080]">
                      Loading keywords…
                    </p>
                  ) : (
                    (keywordSuggestions.length > 0
                      ? keywordSuggestions
                      : fallbackSuggestions
                    )
                      .slice(0, 16)
                      .map((kw) => (
                        <button
                          key={kw}
                          onClick={() => {
                            setSelectedSeoKeywords((prev) =>
                              prev.includes(kw)
                                ? prev.filter((k) => k !== kw)
                                : [...prev, kw]
                            );
                          }}
                          className={`border rounded-full px-2 py-1 text-[9px] sm:text-[10px] font-normal cursor-pointer hover:border-black ${
                            selectedSeoKeywords.includes(kw)
                              ? "border-black text-[#53F870]"
                              : "border-[#0000004d] text-[#53F870]"
                          }`}
                          type="button"
                        >
                          {kw}
                        </button>
                      ))
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:gap-2.5">
                  <Select
                    value={selectedSeoKeyword ?? undefined}
                    onValueChange={setSelectedSeoKeyword}
                  >
                    <SelectTrigger className="w-[588px]  h-[60px]! bg-gradient-to-b text-[#53F870]! from-[#002B07] to-[#1A451A]  border-[#0000001a]">
                      <SelectValue placeholder="From Your Keywords" />
                    </SelectTrigger>
                    <SelectContent>
                      {keywordSuggestions.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No keywords found
                        </SelectItem>
                      ) : (
                        keywordSuggestions.slice(0, 50).map((kw) => (
                          <SelectItem key={kw} value={kw}>
                            {kw}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex items-start justify-start bg-transparent border border-[#53F870]! gap-1.5 flex-wrap bg-[rgb(247,247,247)] rounded-xl p-3.5 w-full min-h-[82px]">
                    {loadingOptions ? (
                      <p className="text-xs text-[#00000080]">
                        Loading keywords…
                      </p>
                    ) : (
                      (keywordSuggestions.length > 0
                        ? keywordSuggestions
                        : fallbackSuggestions
                      )
                        .slice(0, 16)
                        .map((kw) => (
                          <button
                            key={kw}
                            onClick={() => {
                              setSelectedSeoKeywords((prev) =>
                                prev.includes(kw)
                                  ? prev.filter((k) => k !== kw)
                                  : [...prev, kw]
                              );
                            }}
                            className={`border rounded-full px-2 py-1 text-[9px] sm:text-[10px] font-normal cursor-pointer hover:border-black ${
                              selectedSeoKeywords.includes(kw)
                                ? "border-black text-[#53F870]"
                                : "border-[#0000004d] text-[#53F870]"
                            }`}
                            type="button"
                          >
                            {kw}
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* 4) Custom keyword */}
            </div>

            <div>
              <Button
                onClick={async () => {
                  // Show loading dialog immediately
                  setShowCreateDialog(true);
                  setDialogCompleted(false);
                  setLoadingStart(Date.now());
                  setIsSubmitting(true);
                  try {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) {
                      toast.showToast({
                        title: "Not signed in",
                        description: "Please sign in to create a post.",
                        type: "error",
                      });
                      setShowCreateDialog(false);
                      setIsSubmitting(false);
                      return;
                    }

                    // Collect all selected keywords
                    const allKeywords = new Set<string>();
                    selectedCompetitorKeywords.forEach((k) =>
                      allKeywords.add(k)
                    );
                    if (selectedSeoKeyword) allKeywords.add(selectedSeoKeyword);
                    selectedSeoKeywords.forEach((k) => allKeywords.add(k));
                    if (customKeyword.trim())
                      allKeywords.add(customKeyword.trim());

                    const keywords = Array.from(allKeywords);
                    console.log("🔍 Selected keywords:", keywords);
                    console.log("🔍 User ID:", user.id);
                    console.log("🔍 Website ID:", websiteId);

                    if (keywords.length === 0) {
                      toast.showToast({
                        title: "Missing keywords",
                        description:
                          "Please select or enter at least one keyword.",
                        type: "error",
                      });
                      setShowCreateDialog(false);
                      setIsSubmitting(false);
                      return;
                    }

                    // Enqueue jobs for background processing (cron/process handles generation)
                    const requestBody = {
                      keywords: keywords,
                      websiteId: websiteId,
                      userId: user.id,
                      totalArticles: keywords.length,
                    };
                    console.log("🚀 Enqueue request body:", requestBody);

                    const res = await fetch("/api/article-jobs/enqueue", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(requestBody),
                    });

                    const result = await res.json();
                    console.log("📥 Enqueue response:", result, res.status);

                    if (!res.ok || result?.error) {
                      console.error("Enqueue failed:", result);
                      toast.showToast({
                        title: "Failed to queue",
                        description: result?.error || "Unknown error",
                        type: "error",
                      });
                      // Hide loading dialog on failure
                      setShowCreateDialog(false);
                      setDialogCompleted(false);
                    } else {
                      const queued =
                        result.jobCount || result.actual || keywords.length;
                      toast.showToast({
                        title: "Queued",
                        description: `Queued ${queued} article job(s) for generation.`,
                        type: "success",
                      });
                      // Ensure the Creating state is visible for a minimum time
                      const MIN_LOADING_MS = 1500;
                      const elapsed = loadingStart ? Date.now() - loadingStart : MIN_LOADING_MS;
                      const waitMs = Math.max(0, MIN_LOADING_MS - elapsed);
                      setTimeout(() => {
                        // Mark as completed and close the selection dialog.
                        // Keep the loading dialog open in "Completed" state
                        // so the user can click "View Posts".
                        setDialogCompleted(true);
                        onOpenChange(false);
                        onCreated && onCreated();
                      }, waitMs);
                    }
                  } catch (err) {
                    console.error("Error enqueueing jobs:", err);
                    toast.showToast({
                      title: "Error",
                      description:
                        err instanceof Error ? err.message : "Unknown error",
                      type: "error",
                    });
                    setShowCreateDialog(false);
                    setDialogCompleted(false);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="w-full h-12 sm:h-[50px] text-white text-sm sm:text-base font-normal bg-[rgb(91,175,87)] hover:bg-[rgb(91,175,87)] cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CreatePostDialog
        isOpen={showCreateDialog}
        isLoading={!dialogCompleted}
        onClose={() => {
          setShowCreateDialog(false);
          setDialogCompleted(false);
        }}
        onConfirm={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
