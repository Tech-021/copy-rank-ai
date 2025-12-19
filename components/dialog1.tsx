"use client";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface WebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebsiteDialog({ open, onOpenChange }: WebsiteDialogProps) {
  const [websiteName, setWebsiteName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
        </VisuallyHidden>
        {isDialogOpen && 
        (<div className="flex flex-col justify-center gap-20 my-10">
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
                  className="w-[450px] h-[50px] border border-solid border-[#0000001a] focus-visible:border focus-visible:border-[#0000001a] focus-visible:ring-0 placeholder:text-[#0000004d]"
                />
              </div>
            </div>
            <div>
              <button className="bg-[#5baf57] border border-[#0000001a] text-white px-[60px] py-1 w-[170px] h-[50px] rounded-[10px] cursor-pointer">
                Next
              </button>
            </div>
          </div>
          <div>
          </div>
        </div>)}
      </DialogContent>
    </Dialog>
  );
}
