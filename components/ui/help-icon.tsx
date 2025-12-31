"use client"
import React from 'react'

export function HelpIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 1 1 5.82 1c-.2.64-.96 1.14-1.5 1.5C12.9 12.2 12 13 12 15" />
      <circle cx="12" cy="18" r="0.5" />
    </svg>
  )
}
