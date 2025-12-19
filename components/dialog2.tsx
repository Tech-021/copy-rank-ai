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

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostDialogDashboard({
  open,
  onOpenChange,
}: CreatePostDialogProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogCompleted, setDialogCompleted] = useState(false);
  
  useEffect(() => {
    if (showCreateDialog) {
      const timer = setTimeout(() => {
        setDialogCompleted(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showCreateDialog]);
  
  return (
    <div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="min-w-[640px] w-full max-h-[600px] overflow-x-hidden overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <VisuallyHidden>
            <DialogTitle></DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-2.5">
              <h2 className="text-3xl text-black font-normal">
                Choose what to write about
              </h2>
              <p className="text-[15px] text-[#00000080]">
                Pick a keyword as the focus for this post
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2.5">
                <Select>
                  <SelectTrigger className="w-[588px] h-[50px]! border-[#0000001a]">
                    <SelectValue placeholder="From Your Competitor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Competitor1">Competitor 1</SelectItem>
                    <SelectItem value="Competitor2">Competitor 2</SelectItem>
                    <SelectItem value="Competitor3">Competitor 3</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-start justify-start gap-1.5 flex-wrap bg-[rgb(247,247,247)] rounded-xl p-3.5 w-full h-[82px]">
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    web design
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    framer
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    web development
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    technology tutorial
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    web development guide
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <Select>
                  <SelectTrigger className="w-[588px] h-[50px]! border-[#0000001a]">
                    <SelectValue placeholder="From Your Competitor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Competitor1">Competitor 1</SelectItem>
                    <SelectItem value="Competitor2">Competitor 2</SelectItem>
                    <SelectItem value="Competitor3">Competitor 3</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-start justify-start gap-1.5 flex-wrap bg-[rgb(247,247,247)] rounded-xl p-3.5 w-full h-[82px]">
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    web design
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    framer
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    web development
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <Input
                  placeholder="Custom Keyword"
                  className="w-[588px] h-[50px]! border-[#0000001a]"
                />
                <div className="flex items-start justify-start gap-1.5 flex-wrap bg-[rgb(247,247,247)] rounded-xl p-3.5 w-full h-[82px]">
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    framer
                  </p>
                  <p className="border border-[#0000004d] rounded-full px-2 py-1 text-[10px] font-normal text-[#00000080] cursor-pointer">
                    web development
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Button 
              onClick={() => {
                setShowCreateDialog(true);
                onOpenChange(false);
              }}
              className="w-full h-[50px] text-white text-base font-normal bg-[rgb(91,175,87)] hover:bg-[rgb(91,175,87)] cursor-pointer">
                Generate SEO Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CreatePostDialog
        isOpen={showCreateDialog}
        isLoading={dialogCompleted}
        onClose={() => {
          setShowCreateDialog(false);
          setDialogCompleted(false);
        }}
        onConfirm={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
