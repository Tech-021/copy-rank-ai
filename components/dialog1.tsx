"use client";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useToast } from "./ui/toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/client";
import { Button } from "./ui/button";
import { ErrorDialog } from "./ErrorDialog";

interface WebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WebsiteDialog({ open, onOpenChange, onSuccess }: WebsiteDialogProps) {
  const [websiteName, setWebsiteName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const validateWebsiteURL = (): boolean => {
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

  const handleAddWebsite = async () => {
    if (!validateWebsiteURL()) {
      return;
    }

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

      // Call API to analyze website and extract keywords
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          clientDomain: websiteName.trim(),
          competitors: [],
          targetKeywords: [],
          userId: user.id,
          isQuickAdd: true
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const message =
          data?.message ||
          data?.error ||
          "We couldn’t analyze this website. It may be blocking our crawler or temporarily unavailable.";
        setErrorMessage(message);
        setErrorDialogOpen(true);
        throw new Error(message);
      }

      toast.showToast({
        title: "Website Added Successfully!",
        description: `Found ${data.totalKeywords || 0} keywords. Articles are being generated in the background.`,
        type: "success",
      });

      // Reset form and close dialog
      setWebsiteName("");
      onOpenChange(false);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error("Error adding website:", error);
      toast.showToast({
        title: "Failed to Add Website",
        description: error instanceof Error ? error.message : "Unknown error",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#101110]">
          <VisuallyHidden>
            <DialogTitle></DialogTitle>
          </VisuallyHidden>
        <div className="flex flex-col gap-10 my-2.5">
          <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col items-center justify-center">
              <h2 className="text-white text-xl font-normal">
                Website URL
              </h2>
              <p className="text-[15px] text-[#ffffff4d] font-normal">
                Start with your domain
              </p>
            </div>
            <div className="flex flex-col gap-5">
            <div className="space-y-5">
              {/* Website Name */}
              <div>
                <Input
                  type="text"
                  placeholder="Enter your website URL"
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-[48px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#3fa45a] bg-transparent text-white focus-visible:ring-0 placeholder:text-[#ffffff4d] disabled:opacity-50"
                />
              </div>
            </div>
            <div className="mt-6">
              <Button 
                onClick={handleAddWebsite}
                disabled={isLoading}
                className="bg-[#2E8B37] hover:bg-[#257F31] border border-[#0000001a] text-white px-[60px] py-2 w-full h-[48px] rounded-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                    Adding...
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
            </div>
          </div>
          <div>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <ErrorDialog
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="We couldn’t analyze this website"
        message={
          errorMessage ||
          "Something went wrong while trying to read your site. It may be blocking our crawler or temporarily unavailable. Please try again, or use a different website URL."
        }
      />
    </>
  );
}
