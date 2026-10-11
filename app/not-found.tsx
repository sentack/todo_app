"use client"

import { useState, useEffect } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import Link from "next/link"
import Sidebar from "@/components/Sidebar"
import ThemeToggle from "@/components/ThemeToggle"
import SignOutButton from "@/components/SignOutButton"
import { BrandMark, Wordmark } from "@/components/BrandMark"
import type { User } from "@supabase/supabase-js"

export default function NotFound() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      setUser(authUser)
    } catch (error) {
      console.error("Error checking auth:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="skeleton rounded-2xl h-20 w-20"></div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userId={user.id} />

        <div className="h-screen w-full overflow-y-auto">
          <header className="sticky top-0 z-[160]">
            <div aria-hidden className="absolute inset-0 -z-10 chrome border-b border-black/[0.06] dark:border-white/[0.06]" />
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16 lg:h-[4.5rem]">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open menu"
                    className="lg:hidden rounded-[32%] focus-ring transition-all duration-200"
                  >
                    <BrandMark className="w-9 h-9" />
                  </button>
                  <h1><Wordmark className="text-xl" /></h1>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <SignOutButton user={user} />
                </div>
              </div>
            </div>
          </header>

          <main className="flex items-center justify-center px-4 min-h-[calc(100dvh-4.5rem)]">
            <div className="text-center animate-slide-in-up">
              <div className="w-20 h-20 bg-white dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] shadow-lg rounded-[1.75rem] flex items-center justify-center mx-auto mb-6 -rotate-6">
                <svg className="w-10 h-10 text-volt-600 dark:text-volt" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h1 className="text-[7rem] sm:text-[9rem] leading-none font-extrabold text-black dark:text-white mb-2">4<span className="text-volt-600 dark:text-volt">0</span>4</h1>
              <p className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-8">Page not found</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 h-12 px-7 text-sm font-bold text-white dark:text-black bg-black dark:bg-volt rounded-full hover:bg-gray-800 dark:hover:bg-volt-300 shadow-lg shadow-black/10 dark:shadow-volt/10 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-volt focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Go Home
              </Link>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center animate-slide-in-up">
        <div className="w-20 h-20 bg-white dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] shadow-lg rounded-[1.75rem] flex items-center justify-center mx-auto mb-6 -rotate-6">
          <svg className="w-10 h-10 text-volt-600 dark:text-volt" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="text-[7rem] sm:text-[9rem] leading-none font-extrabold text-black dark:text-white mb-2">4<span className="text-volt-600 dark:text-volt">0</span>4</h1>
        <p className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-8">Page not found</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-12 px-7 text-sm font-bold text-white dark:text-black bg-black dark:bg-volt rounded-full hover:bg-gray-800 dark:hover:bg-volt-300 shadow-lg shadow-black/10 dark:shadow-volt/10 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-volt focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Go Home
        </Link>
      </div>
    </div>
  )
}
