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

interface WebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function WebsiteDialog({ open, onOpenChange, onSuccess }: WebsiteDialogProps) {
  const [websiteName, setWebsiteName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
        throw new Error(data.error || 'Failed to add website');
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col gap-10 my-2.5">
          <div className="flex flex-col gap-[30px]">
            <div>
              <h1 className="text-[#000000B3] text-lg font-normal">
                Website URL
              </h1>
              <p className="text-[15px] text-[#00000080] font-normal">
                Start with your domain
              </p>
            </div>
            <div className="flex flex-col gap-30">
            <div className="space-y-5">
              {/* Website Name */}
              <div>
                <Input
                  type="text"
                  placeholder="Enter your website URL"
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  disabled={isLoading}
                  className="w-[450px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d] disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <Button 
                onClick={handleAddWebsite}
                disabled={isLoading}
                className="bg-[#5baf57] hover:bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
