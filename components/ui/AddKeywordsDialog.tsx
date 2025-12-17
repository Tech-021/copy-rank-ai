"use client"

import { X } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"

interface AddKeywordsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function AddKeywordsDialog({
  isOpen,
  onClose,
}: AddKeywordsDialogProps) {
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (isOpen && !added) {
      const timer = setTimeout(() => {
        setAdded(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, added])

  const handleClose = () => {
    setAdded(false)
    onClose()
  }

  useEffect(() => {
    if (added) {
      const timer = setTimeout(() => {
        handleClose()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [added])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-[500px] p-8 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!added ? (
          <>
            {/* Importing State */}
            <div className="text-center space-y-8">
              <h2 className="text-2xl  text-gray-900">
                Importing Keywords
              </h2>

              {/* Loading Checkmark Animation */}
              <div className="flex justify-center animate-spin py-8">
                <Image
                  src="/loader.png"
                  height={92}
                  width={92}
                  alt="icon"
                />
              </div>

              {/* Loading Button */}
              <button
                disabled
                className="w-full bg-green-600 hover:bg-green-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span></span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="text-center space-y-8">
              <h2 className="text-2xl  text-gray-900">
                Keywords Synced!
              </h2>

              {/* Success Checkmark */}
              <div className="flex justify-center py-8">
                <Image
                  src="/check.png"
                  alt="icon"
                  height={81}
                  width={81}
                />
              </div>

              {/* View Keywords Button */}
              <button
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                View Keywords
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
