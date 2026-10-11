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
import MobileTabBar from "@/components/MobileTabBar"
import { BrandMark, Wordmark } from "@/components/BrandMark"
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <BrandMark className="w-14 h-14 animate-pulse-slow" />
          <div className="space-y-3 w-64">
            <div className="skeleton rounded-full h-3 w-40 mx-auto" />
            <div className="skeleton rounded-full h-3 w-28 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex">
        <div className="h-screen w-full overflow-y-auto">
          <header className="relative z-[160]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16 sm:h-20">
                <div className="flex items-center gap-2.5">
                  <BrandMark className="w-9 h-9" />
                  <h1><Wordmark className="text-xl" /></h1>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="px-4 sm:px-6 lg:px-8 pb-12">
            <div className="max-w-6xl mx-auto min-h-[calc(100vh-8rem)] grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
              <section className="pt-4 lg:pt-0 animate-slide-in-down">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-6 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-volt-500 dark:bg-volt animate-glow" />
                  Welcome to TodoFlow
                </span>
                <h2 className="text-[2.75rem] leading-[0.95] sm:text-6xl lg:text-7xl font-extrabold text-black dark:text-white mb-5">
                  Get it done.<br />
                  Keep it{" "}
                  <span className="relative inline-block -rotate-1 px-2 sm:px-3 rounded-2xl bg-volt text-black shadow-lg shadow-volt/30">flowing</span>
                </h2>
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-md mb-7">Organize your tasks with style and efficiency</p>
                <div className="hidden sm:flex flex-wrap gap-2">
                  {["Todos", "Expenses", "Debts & lending", "Shopping list", "Stats"].map(f => (
                    <span key={f} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-gray-700 dark:text-gray-300">{f}</span>
                  ))}
                </div>
              </section>
              <section className="w-full max-w-md lg:justify-self-end animate-slide-in-up">
                <LoginForm />
              </section>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <CurrencyProvider userId={user.id}>
      <div className="min-h-screen flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userId={user.id} />

        <div className="h-screen w-full overflow-y-auto">
          <header className="sticky top-0 z-[160]">
            {/* Frosted layer kept off the ancestor chain so fixed overlays (search) stay viewport-bound */}
            <div aria-hidden className="absolute inset-0 -z-10 chrome border-b border-black/[0.06] dark:border-white/[0.06]" />
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16 lg:h-[4.5rem]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden rounded-[32%] focus-ring transition-transform duration-200"
                    aria-label="Open menu"
                  >
                    <BrandMark className="w-9 h-9" />
                  </button>
                  <h1 className="lg:hidden"><Wordmark className="text-xl" /></h1>
                  <p className="hidden lg:block font-display text-lg font-bold tracking-tight text-black dark:text-white">
                    {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <GlobalSearch userId={user.id} />
                  <ThemeToggle />
                  <SignOutButton user={user} />
                </div>
              </div>
            </div>
          </header>

          <div className="pb-28 lg:pb-0">
            {children}
          </div>
        </div>
      </div>

      <MobileTabBar onMenu={() => setSidebarOpen(true)} />
      <UndoToast />
      <QuickAddFAB />
    </CurrencyProvider>
  )
}
