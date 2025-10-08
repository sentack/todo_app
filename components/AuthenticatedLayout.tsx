"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import Sidebar from "./Sidebar"
import ThemeToggle from "./ThemeToggle"
import SignOutButton from "./SignOutButton"
import type { User } from "@supabase/supabase-js"

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser()

      if (error) throw error
      if (!authUser) {
        router.push("/")
        return
      }

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
          <div className="skeleton rounded-2xl h-8 w-48"></div>
          <div className="skeleton rounded-2xl h-64"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="h-screen w-full overflow-y-auto">
        <header className="bg-white dark:bg-black shadow-lg border-b border-gray-200 dark:border-gray-800 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 focus-ring transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                    
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-black dark:text-white">TodoFlow</h1>
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <SignOutButton user={user} />
              </div>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
