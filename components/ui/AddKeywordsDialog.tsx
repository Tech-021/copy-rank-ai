"use client"

import { X } from "lucide-react"
import { LoaderChevron } from "./LoaderChevron"
import Image from "next/image"
import { useEffect, useState } from "react"

interface AddKeywordsDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd?: (keywords: string[]) => Promise<void>
}

export function AddKeywordsDialog({
  isOpen,
  onClose,
  onAdd,
}: AddKeywordsDialogProps) {
  const [added, setAdded] = useState(false)
  const [keywordInput, setKeywordInput] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleClose = () => {
    setAdded(false)
    setKeywordInput("")
    setIsAdding(false)
    onClose()
  }

  const handleAddKeywords = async () => {
    if (!keywordInput.trim()) return

    setIsAdding(true)

    // Parse keywords - split by newline or comma
    const keywords = keywordInput
      .split(/[\n,]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0)

    if (keywords.length === 0) {
      setIsAdding(false)
      return
    }

    // Call onAdd if provided
    if (onAdd) {
      await onAdd(keywords)
    }

    setAdded(true)
    setIsAdding(false)

    // Auto close after success
    setTimeout(() => {
      handleClose()
    }, 2000)
  }

  useEffect(() => {
    // Reset state when dialog opens
    if (isOpen) {
      setAdded(false)
      setKeywordInput("")
      setIsAdding(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-[500px] p-8 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {!added ? (
          <>
            {!isAdding ? (
              <>
                {/* Input State */}
                <div className="space-y-6">
                  <h2 className="text-2xl text-gray-900">
                    Add Keywords
                  </h2>
                  <p className="text-sm text-gray-600">
                    Enter keywords (one per line or comma-separated)
                  </p>

                  <textarea
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Enter keywords here..."
                    className="w-full h-48 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
                  />

                  <button
                    onClick={handleAddKeywords}
                    disabled={!keywordInput.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    Add Keywords
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Adding State */}
                <div className="text-center space-y-8">
                  <h2 className="text-2xl text-gray-900">
                    Adding Keywords
                  </h2>

                  {/* Loading Animation */}
                  <div className="flex justify-center">
                    <LoaderChevron />
                  </div>

                  {/* Loading Button */}
                  <button
                    disabled
                    aria-label="Adding keywords"
                    className="w-full bg-green-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </button>
                </div>
              </>
            )}
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
                  src="/checkfordark.png"
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
