"use client"

import { useState, useEffect, useRef } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"

interface Friend { id: string; name: string }

interface FriendComboboxProps {
  value: string
  onChange: (name: string) => void
  userId: string
  label: string
  placeholder?: string
  required?: boolean
}

export default function FriendCombobox({
  value, onChange, userId, label, placeholder = "Name", required = false,
}: FriendComboboxProps) {
  const [friends, setFriends]     = useState<Friend[]>([])
  const [open, setOpen]           = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const supabase                  = createBrowserSupabaseClient()
  const containerRef              = useRef<HTMLDivElement>(null)

  // Load friends once
  useEffect(() => {
    if (!userId || loaded) return
    supabase
      .from("friends")
      .select("id, name")
      .eq("user_id", userId)
      .order("name")
      .then(({ data }) => {
        setFriends((data ?? []) as Friend[])
        setLoaded(true)
      })
  }, [userId, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = value.trim()
    ? friends.filter(f => f.name.toLowerCase().includes(value.trim().toLowerCase()))
    : friends

  const exactMatch = friends.some(f => f.name.toLowerCase() === value.trim().toLowerCase())

  const selectFriend = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
      />

      {open && (filtered.length > 0 || (value.trim() && !exactMatch)) && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(f => (
            <button
              key={f.id}
              type="button"
              onMouseDown={() => selectFriend(f.name)}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-950 flex items-center gap-2 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white dark:text-black">
                  {f.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-black dark:text-white">{f.name}</span>
            </button>
          ))}
          {value.trim() && !exactMatch && (
            <button
              type="button"
              onMouseDown={() => selectFriend(value.trim())}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-950 flex items-center gap-2 text-blue-600 dark:text-blue-400 transition-colors border-t border-gray-100 dark:border-gray-900"
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add &ldquo;{value.trim()}&rdquo; as new friend
            </button>
          )}
        </div>
      )}
    </div>
  )
}
