"use client";

import { X } from "lucide-react";
import Image from "next/image";

interface KeywordsSyncedDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordsSyncedDialog({
  isOpen,
  onClose,
}: KeywordsSyncedDialogProps) {
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
            Keywords Synced!
          </h2>

          {/* Success Checkmark */}
          <div className="flex justify-center py-8">
            <Image
              src="/checkfordark.png"
              alt="success"
              height={81}
              width={81}
            />
          </div>
          <div
          onClick={onClose}
          className="w-full h-[50px] bg-[#5af870] hover:bg-[#5af870] cursor-pointer py-2.5 text-[#000000b3]">
            Done
          </div>
        </div>
      </div>
    </div>
  );
}
