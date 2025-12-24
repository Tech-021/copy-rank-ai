"use client"

import { X } from "lucide-react"
import Image from "next/image";

interface CreatePostDialogProps {
  isOpen: boolean
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
}

export function CreatePostDialog({
  isOpen,
  isLoading,
  onClose,
}: CreatePostDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-[550px] p-4 sm:p-8 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {!isLoading ? (
          <>
            {/* Creating State */}
            <div className="text-center flex flex-col space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl text-gray-900">
                Creating Post
              </h2>
              <div className="flex justify-center animate-spin">
                <Image
                  src="/loader.png"
                  alt="icon"
                  height={92}
                  width={92}
                  
                />
              </div>
              {/* Loading Button */}
              <button
                disabled
                className="w-full bg-green-500 hover:bg-green-500 text-white font-medium py-2 sm:py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span></span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Completed State */}
            <div className="text-center space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl text-gray-900">
                Completed!
              </h2>

              {/* Success Checkmark */}
              <div className="flex justify-center py-4 sm:py-8">
                <div className="flex items-center justify-center">
                  <Image
                    src="/checkfordark.png"
                    height={81}
                    width={81}
                    alt="icon"
                  />
                </div>
              </div>

              {/* View Posts Button */}
              <button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-600 text-white font-medium py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
              >
                View Posts
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
