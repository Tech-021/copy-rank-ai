"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface KeywordActionDropdownProps {
  onDelete?: () => void
}

export function KeywordActionDropdown({ onDelete }: KeywordActionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="border border-l-0 rounded-l-none bg-transparent border-gray-200 rounded-r-md w-8 h-8 p-0 flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronDown className="w-4 h-4 text-gray-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem 
          className="text-red-600 cursor-pointer"
          onClick={onDelete}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}