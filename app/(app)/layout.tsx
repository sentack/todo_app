"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import Sidebar from "@/components/Sidebar"
import ThemeToggle from "@/components/ThemeToggle"
import SignOutButton from "@/components/SignOutButton"
import UndoToast from "@/components/UndoToast"
import QuickAddFAB from "@/components/QuickAddFAB"
import GlobalSearch from "@/components/GlobalSearch"
import LoginForm from "@/components/LoginForm"
import { CurrencyProvider } from "@/contexts/CurrencyContext"
import type { User } from "@supabase/supabase-js"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null)
  const [loading, setLoading]         = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="space-y-6 w-64">
          <div className="skeleton rounded-2xl h-8 w-48" />
          <div className="skeleton rounded-2xl h-64" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-white dark:bg-black flex">
        <div className="h-screen w-full overflow-y-auto">
          <header className="relative z-[160] bg-white dark:bg-black shadow-lg border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center">
                    <img className="w-full" src="/favicon.ico" alt="" />
                  </div>
                  <h1 className="text-2xl font-bold text-black dark:text-white">TodoFlow</h1>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
              <div className="w-full max-w-md animate-slide-in-up">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-black dark:bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                    <img className="w-20 h-20" src="/favicon.ico" alt="" />
                  </div>
                  <h2 className="text-3xl font-bold text-black dark:text-white mb-3">Welcome to TodoFlow</h2>
                  <p className="text-gray-600 dark:text-gray-400">Organize your tasks with style and efficiency</p>
                </div>
                <LoginForm />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <CurrencyProvider userId={user.id}>
      <div className="min-h-screen bg-white dark:bg-black flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userId={user.id} />

        <div className="h-screen w-full overflow-y-auto">
          <header className="relative z-[160] bg-white dark:bg-black shadow-lg border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center lg:hidden">
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="rounded-full focus:outline-none transition-all duration-200"
                      aria-label="Open menu"
                    >
                      <img className="w-full" src="/favicon.ico" alt="" />
                    </button>
                  </div>
                  <h1 className="text-2xl font-bold text-black dark:text-white">TodoFlow</h1>
                </div>
                <div className="flex items-center gap-2">
                  <GlobalSearch userId={user.id} />
                  <ThemeToggle />
                  <SignOutButton user={user} />
                </div>
              </div>
            </div>
          </header>

          {children}
        </div>
      </div>

      <UndoToast />
      <QuickAddFAB />
    </CurrencyProvider>
  )
}
