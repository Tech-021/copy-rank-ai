"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type ToastType = "success" | "error" | "info"

type Toast = {
  id: string
  title?: string
  description?: string
  type?: ToastType
}

type ToastContext = {
  showToast: (toast: Omit<Toast, "id"> & { duration?: number }) => void
}

const Context = createContext<ToastContext | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = ({ title, description, type = "info", duration = 4000 }: Omit<Toast, "id"> & { duration?: number }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const t: Toast = { id, title, description, type }
    setToasts((s) => [...s, t])

    // auto remove
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id))
    }, duration)
  }

  const remove = (id: string) => setToasts((s) => s.filter((t) => t.id !== id))

  return (
    <Context.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="pointer-events-none fixed top-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm w-full rounded-lg px-4 py-3 shadow-lg border flex items-start gap-3 ${
              t.type === "success"
                ? "bg-green-600/95 border-green-700"
                : t.type === "error"
                ? "bg-red-600/95 border-red-700"
                : "bg-slate-800/95 border-slate-700"
            } text-white`}
          >
            <div className="flex-1">
              {t.title && <div className="font-semibold text-sm">{t.title}</div>}
              {t.description && <div className="text-xs opacity-90">{t.description}</div>}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="text-white/80 hover:text-white text-xs ml-2"
              aria-label="Close toast"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
