"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface UndoState {
  id: number
  message: string
  onUndo: () => void
}

export default function UndoToast() {
  const [toast, setToast] = useState<UndoState | null>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef    = useRef<number | null>(null)
  const [progress, setProgress] = useState(100)
  const counterRef = useRef(0)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current)   cancelAnimationFrame(rafRef.current)
    setToast(null)
    setProgress(100)
  }, [])

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      dismiss()

      const id = ++counterRef.current
      setToast({ id, message: e.detail.message, onUndo: e.detail.onUndo })
      setProgress(100)

      const start = Date.now()
      const DURATION = 5000

      const tick = () => {
        const elapsed = Date.now() - start
        const pct = Math.max(0, 100 - (elapsed / DURATION) * 100)
        setProgress(pct)
        if (pct > 0) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      timerRef.current = setTimeout(() => {
        setToast(null)
        setProgress(100)
      }, DURATION)
    }

    window.addEventListener("undo-action", handler as EventListener)
    return () => {
      window.removeEventListener("undo-action", handler as EventListener)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current)   cancelAnimationFrame(rafRef.current)
    }
  }, [dismiss])

  if (!toast) return null

  const handleUndo = () => {
    toast.onUndo()
    dismiss()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-slide-in-up pointer-events-auto">
      <div className="bg-black dark:bg-white rounded-2xl shadow-2xl overflow-hidden min-w-[280px] max-w-sm">
        <div className="px-5 py-4 flex items-center gap-4">
          <span className="flex-1 text-sm font-medium text-white dark:text-black">{toast.message}</span>
          <button
            onClick={handleUndo}
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-black dark:text-white bg-white dark:bg-black rounded-xl hover:opacity-80 transition-all"
          >
            Undo
          </button>
          <button
            onClick={dismiss}
            className="shrink-0 text-gray-400 dark:text-gray-600 hover:text-white dark:hover:text-black transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="h-1 bg-gray-800 dark:bg-gray-200">
          <div
            className="h-full bg-white dark:bg-black"
            style={{ width: `${progress}%`, transition: "width 100ms linear" }}
          />
        </div>
      </div>
    </div>
  )
}
