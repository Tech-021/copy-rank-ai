"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface SyncCompetitorsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncCompetitorsDialog({
  isOpen,
  onClose,
}: SyncCompetitorsDialogProps) {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (isOpen && !synced) {
      const timer = setTimeout(() => {
        setSynced(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, synced]);

  const handleClose = () => {
    setSynced(false);
    onClose();
  };

  useEffect(() => {
    if (synced) {
      const timer = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [synced]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#101110] rounded-lg w-full max-w-[500px] p-8 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!synced ? (
          <>
            {/* Importing State */}
            <div className="text-center space-y-8">
              <h2 className="text-2xl  text-white">Syncing Keywords</h2>

              {/* Loading Checkmark Animation */}
              <div className="flex justify-center animate-spin py-8">
                <Image src="/loader.png" height={92} width={92} alt="icon" />
              </div>

              {/* Loading Button */}
              <button
                disabled
                className="w-full bg-[#53ff70] hover:bg-[#53ff70] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <div
                  className="w-8 h-8 rounded-full animate-spin
         bg-[conic-gradient(#00000000_0%,#000000FF_100%)]
         [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),black_0)]
         [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%-2px),black_0)]"
                ></div>
                <span></span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="text-center space-y-8">
              <h2 className="text-2xl  text-white">Keywords Synced!</h2>

              {/* Success Checkmark */}
              <div className="flex justify-center py-8">
                <Image src="/checkfordark.png" alt="icon" height={81} width={81} />
              </div>

              {/* View Keywords Button */}
              <button
                onClick={handleClose}
                className="w-full bg-[#53ff70] hover:bg-[#53ff70] text-black font-medium py-3 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
