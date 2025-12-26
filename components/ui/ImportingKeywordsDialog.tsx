"use client";

import { X } from "lucide-react";
import { LoaderChevron } from "./LoaderChevron";

interface ImportingKeywordsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportingKeywordsDialog({
  isOpen,
  onClose,
}: ImportingKeywordsDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#0a0a0a] rounded-2xl shadow-2xl w-full max-w-[550px] mx-4 p-8 relative border border-[#1a1a1a]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="text-center space-y-8 pt-4">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-white">
            Importing Keywords
          </h2>

          {/* Loader Animation */}
          <div className="flex justify-center py-8">
            <LoaderChevron />
          </div>

          {/* Loading Button */}
          <button
            disabled
            className="w-full bg-[#53f870] hover:bg-[#53f870] text-black font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            Importing...
          </button>
        </div>
      </div>
    </div>
  );
}
