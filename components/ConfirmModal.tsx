"use client"

import { useEffect, useState } from "react"

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  confirmationText?: string
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  isLoading = false,
  confirmationText,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState("")
  const [canConfirm, setCanConfirm] = useState(!confirmationText)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    if (confirmationText) {
      setCanConfirm(inputValue === confirmationText)
    }
  }, [inputValue, confirmationText])

  useEffect(() => {
    if (isOpen) {
      setInputValue("")
      setCanConfirm(!confirmationText)
    }
  }, [isOpen, confirmationText])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (confirmationText && inputValue !== confirmationText) {
      return
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-950 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl sm:max-w-md w-full p-6 sm:p-8 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-8 border-t sm:border border-black/[0.06] dark:border-white/[0.08] animate-sheet">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-500/15 rounded-2xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-black dark:text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-500 hover:text-black dark:hover:text-white focus-ring transition-colors duration-200"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-300 mb-7 text-[15px] leading-relaxed">{message}</p>

        {confirmationText && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              Type <span className="font-mono bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg text-rose-600 dark:text-rose-400">{confirmationText}</span> to confirm:
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-500/15 focus:border-rose-500 bg-gray-50 dark:bg-white/[0.04] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
              placeholder={`Type "${confirmationText}" here`}
              disabled={isLoading}
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="h-12 px-6 text-sm font-bold text-black dark:text-white bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl focus-ring disabled:opacity-50 transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !canConfirm}
            className="h-12 px-6 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 rounded-2xl shadow-lg shadow-rose-600/25 focus-ring disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 transition-all duration-200"
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
