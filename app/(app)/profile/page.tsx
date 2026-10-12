/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */

"use client"

import { useState, useEffect } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface UserProfile {
  id: string
  email: string
  username: string | null
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  
  const supabase = createBrowserSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!authUser) {
        router.push("/")
        return
      }

      // Try to get user profile from users table
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("username")
        .eq("id", authUser.id)
        .single()

      const userProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email || "",
        username: profileData?.username || null,
      }

      setUser(userProfile)
      setEmail(userProfile.email)
      setUsername(userProfile.username || "")
    } catch (error) {
      console.error("Error fetching user:", error)
      setError("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      // Update email in auth
      if (email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        })
        if (emailError) throw emailError
      }

      // Update or insert username in users table
      const { error: profileError } = await supabase
        .from("users")
        .upsert({
          id: user?.id,
          username: username || null,
        })

      if (profileError) throw profileError

      setSuccess("Profile updated successfully!")
      fetchUser() // Refresh user data
    } catch (error) {
      console.error("Error updating profile:", error)
      setError(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
          <div className="space-y-6">
            <div className="skeleton rounded-2xl h-8 w-48"></div>
            <div className="skeleton rounded-2xl h-64"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
        <div className="animate-slide-in-down">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-black dark:bg-volt rounded-2xl flex items-center justify-center shrink-0 -rotate-3 shadow-lg shadow-black/15 dark:shadow-volt/20">
              <svg className="w-6 h-6 text-volt dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-none text-black dark:text-white">Profile</h1>
          </div>

          <Link  href="/" className="mb-8 h-10 px-4 inline-flex items-center rounded-full bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-sm font-bold text-black dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
            Back
          </Link>
          </div>

          <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-8 shadow-sm">
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Username
                  </div>
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt bg-gray-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.06] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    Email Address
                  </div>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt bg-gray-50 dark:bg-white/[0.04] focus:bg-white dark:focus:bg-white/[0.06] text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
                  placeholder="Enter your email"
                />
              </div>

              {error && (
                <div className="text-sm font-medium p-4 rounded-2xl text-rose-800 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 animate-slide-in-down">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              {success && (
                <div className="text-sm font-medium p-4 rounded-2xl text-volt-900 bg-volt-100 dark:text-volt-200 dark:bg-volt/10 border border-volt-300/70 dark:border-volt/20 animate-slide-in-down">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {success}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 px-6 text-sm font-bold text-white dark:text-black bg-black dark:bg-volt rounded-2xl hover:bg-gray-800 dark:hover:bg-volt-300 shadow-lg shadow-black/10 dark:shadow-volt/10 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-volt focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200    flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
