"use client";

import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message?: string;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
}: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101110] max-w-sm text-center">
        <DialogTitle className="text-lg font-medium text-white mb-2">
          {title}
        </DialogTitle>
        <p className="text-sm text-gray-400 mb-4">{message}</p>
        <Button
          onClick={() => onOpenChange(false)}
          className="mt-2 w-full bg-[#2E8B37] hover:bg-[#257F31] text-white h-10 cursor-pointer"
        >
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}

