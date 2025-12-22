"use client"

import { LogOut } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface ProfileDropdownProps {
  userEmail?: string
  userAvatar?: string | null
  onLogout: () => void
}

export function ProfileDropdown({ userEmail, userAvatar, onLogout }: ProfileDropdownProps) {
  const avatarToShow = userAvatar ?? "/profileimg.png"
  const isExternal = typeof avatarToShow === "string" && avatarToShow.startsWith("http")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2  rounded-full py-1.5 pl-6 pr-1.5 hover:bg-green-600  transition-colors cursor-pointer">
          <span className="text-sm text-[#53F870]">{userEmail}</span>
          {isExternal ? (
            <img
              src={avatarToShow}
              alt="Profile"
              width={50}
              height={50}
              className="rounded-full object-cover"
            />
          ) : (
            <Image
              src={avatarToShow}
              alt="Profile"
              width={50}
              height={50}
              className="rounded-full object-cover"
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div>
            {isExternal ? (
              <img
                src={avatarToShow}
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <Image
                src={avatarToShow}
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{userEmail}</p>
            <p className="text-xs text-muted-foreground">Account</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
