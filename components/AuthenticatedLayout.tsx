"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import Sidebar from "./Sidebar"
import ThemeToggle from "./ThemeToggle"
import SignOutButton from "./SignOutButton"
import UndoToast from "./UndoToast"
import QuickAddFAB from "./QuickAddFAB"
import GlobalSearch from "./GlobalSearch"
import { CurrencyProvider } from "@/contexts/CurrencyContext"
import type { User } from "@supabase/supabase-js"

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [user, setUser]           = useState<User | null>(null)
  const [loading, setLoading]     = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router  = useRouter()
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!authUser) { router.push("/"); return }
      setUser(authUser)
    } catch (error) {
      console.error("Error checking auth:", error)
      router.push("/")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="space-y-6">
          <div className="skeleton rounded-2xl h-8 w-48" />
          <div className="skeleton rounded-2xl h-64" />
        </div>
      </div>
    )
  }

  if (!user) return null

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
          <main>{children}</main>
        </div>
      </div>

      <UndoToast />
      <QuickAddFAB />
    </CurrencyProvider>
  )
}
