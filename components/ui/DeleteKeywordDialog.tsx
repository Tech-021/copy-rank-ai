"use client"

import { X } from "lucide-react"
import { useState } from "react"

interface DeleteKeywordDialogProps {
  isOpen: boolean
  keyword: string
  onClose: () => void
  onConfirm: () => void
}

export function DeleteKeywordDialog({
  isOpen,
  keyword,
  onClose,
  onConfirm,
}: DeleteKeywordDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-[450px] p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Delete Keyword?
            </h2>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete "{keyword}"? This action cannot be undone.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-10 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
