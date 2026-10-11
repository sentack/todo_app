"use client"

import { useEffect } from "react"

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg flex flex-col bg-white dark:bg-gray-950 rounded-t-[2rem] sm:rounded-[2rem] border-t sm:border border-black/[0.06] dark:border-white/[0.08] shadow-2xl animate-sheet pb-[env(safe-area-inset-bottom)]"
        style={{ maxHeight: "min(88dvh, 46rem)" }}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 shrink-0">
          <div className="w-10 h-1.5 bg-gray-200 dark:bg-white/15 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-4 sm:pt-6 pb-4 shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-1">
          {children}
        </div>
      </div>
    </div>
  )
}
