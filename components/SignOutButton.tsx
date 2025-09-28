"use client"

import type React from "react"

import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useRouter } from "next/navigation"
import { useState } from "react"

import type { User } from "@supabase/supabase-js"

interface SignOutButtonProps {
  user: User | null
}


export default function SignOutButton({ user }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const handleSignOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <button
        onClick={handleSignOut}
        disabled={loading}
        className="px-4 py-2 text-sm inline-flex gap-2 items-center font-semibold rounded-lg bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 focus-ring transition-all duration-200   "
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Signing out...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Sign out
          </>
        )}
      </button>
    )
  }
}
