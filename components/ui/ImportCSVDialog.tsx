"use client"

import { X } from "lucide-react"
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import Image from "next/image"

interface ImportCSVDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (file: File) => void
}

export function ImportCSVDialog({
  isOpen,
  onClose,
  onImport,
}: ImportCSVDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  if (!isOpen) return null

  const handleFileSelect = (file: File) => {
    if (file.name.endsWith('.csv')) {
      setSelectedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleImport = () => {
    if (selectedFile) {
      onImport(selectedFile)
      setSelectedFile(null)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    onClose()
  }

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

        {/* Title */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Import CSV
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Drag and drop, or click to import keywords CSV file
        </p>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className=" rounded-lg py-29 text-center cursor-pointer hover:border-gray-400 transition-colors mb-6 bg-gray-50"
        >
          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex justify-center mb-3">
                <div className=" text-white rounded px-3 py-2 text-sm font-medium flex flex-col items-center gap-2">
                  <Image
                    src="/file.png"
                    alt="success"
                    width={110}
                    height={79}
                  />
                  {/* {selectedFile.name} */}
                  <p className="text-gray-400">{selectedFile.name}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center text-4xl mb-2">
               <Image
               src="/greenplus.png"
               alt="icon"
               height={65}
               width={65}
               
               />
              </div>
              {/* <p className="text-sm text-gray-600">
                Drag and drop your CSV file here or click to browse
              </p> */}
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileSelect(e.target.files[0])
            }
          }}
          className="hidden"
        />

        {/* File Name Display */}
        {!selectedFile && (
          
          <div className="mb-6 text-center">
  <div className="relative w-full max-w-sm mx-auto">
    <Input
      placeholder="filename.csv"
      className=""
    />

    <Image
      src="/delete.png"
      alt="delete"
      width={15}
      height={15}
      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer opacity-70 hover:opacity-100"
    />
  </div>
</div>
        )}

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={!selectedFile}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        >
          Import
        </button>
      </div>
    </div>
  )
}
