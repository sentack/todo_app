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
      <label className="block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-2xl text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-white/[0.06] focus:border-black dark:focus:border-volt focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 transition-all text-[0.9375rem]"
      />

      {open && (filtered.length > 0 || (value.trim() && !exactMatch)) && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 p-1.5 bg-white dark:bg-gray-900 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto animate-pop-in">
          {filtered.map(f => (
            <button
              key={f.id}
              type="button"
              onMouseDown={() => selectFriend(f.name)}
              className="w-full px-3 py-2.5 text-left text-sm font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
            >
              <div className="w-7 h-7 rounded-xl bg-black dark:bg-volt flex items-center justify-center shrink-0">
                <span className="text-xs font-extrabold text-volt dark:text-black">
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
              className="w-full px-3 py-2.5 mt-1 text-left text-sm font-bold rounded-xl hover:bg-volt/10 flex items-center gap-2.5 text-volt-800 dark:text-volt transition-colors"
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
