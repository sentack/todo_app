"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { triggerUndo } from "@/lib/undoToast"

interface Friend {
  id: string
  name: string
  created_at: string
}

export default function FriendsPage() {
  const [friends, setFriends]     = useState<Friend[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState("")
  const [saving, setSaving]       = useState(false)

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)

  const loadFriends = async () => {
    if (!userIdRef.current) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      userIdRef.current = user.id
    }
    const { data } = await supabase
      .from("friends")
      .select("id, name, created_at")
      .eq("user_id", userIdRef.current!)
      .order("name")
    setFriends((data ?? []) as Friend[])
    setLoading(false)
  }

  useEffect(() => { loadFriends() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === "friend") loadFriends()
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return friends
    const s = search.trim().toLowerCase()
    return friends.filter(f => f.name.toLowerCase().includes(s))
  }, [friends, search])

  const startEdit = (friend: Friend) => {
    setEditingId(friend.id)
    setEditName(friend.name)
  }

  const cancelEdit = () => { setEditingId(null); setEditName("") }

  const saveEdit = async (e: React.FormEvent, friend: Friend) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name || name === friend.name) { cancelEdit(); return }
    setSaving(true)
    const { error } = await supabase.from("friends").update({ name }).eq("id", friend.id)
    if (!error) {
      setFriends(prev => prev.map(f => f.id === friend.id ? { ...f, name } : f).sort((a, b) => a.name.localeCompare(b.name)))
      cancelEdit()
    }
    setSaving(false)
  }

  const deleteFriend = (friend: Friend) => {
    setFriends(prev => prev.filter(f => f.id !== friend.id))
    let undone = false
    triggerUndo(`Removed friend "${friend.name}"`, () => {
      undone = true
      setFriends(prev => [...prev, friend].sort((a, b) => a.name.localeCompare(b.name)))
    })
    setTimeout(async () => {
      if (!undone) await supabase.from("friends").delete().eq("id", friend.id)
    }, 5100)
  }

  return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center gap-4 mb-7">
            <div className="w-12 h-12 bg-black dark:bg-volt rounded-2xl flex items-center justify-center shrink-0 -rotate-3 shadow-lg shadow-black/15 dark:shadow-volt/20">
              <svg className="w-6 h-6 text-volt dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-none text-black dark:text-white">Friends</h1>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1.5">Used for debts &amp; lending</p>
            </div>
          </div>

          {/* Search (only show if there are friends) */}
          {friends.length > 3 && (
            <div className="relative mb-4">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search friends…"
                className="w-full pl-11 pr-10 h-12 bg-white dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              )}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton rounded-2xl h-16" />)}</div>
          ) : friends.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-white dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] shadow-sm rounded-3xl flex items-center justify-center mx-auto mb-5 rotate-3">
                <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <p className="font-display text-xl font-bold tracking-tight text-black dark:text-white mb-1.5">No friends yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">Use the + button to add one — they&apos;ll autocomplete in Debts &amp; Lending</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-medium text-gray-500 dark:text-gray-400">No friends match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
              {filtered.map((friend, idx) => (
                <div
                  key={friend.id}
                  className={`flex items-center gap-3 sm:gap-4 pl-4 sm:pl-5 pr-2 sm:pr-3 py-3.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors ${idx < filtered.length - 1 ? "border-b border-black/[0.05] dark:border-white/[0.05]" : ""}`}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-2xl bg-black dark:bg-volt flex items-center justify-center shrink-0">
                    <span className="font-display text-base font-extrabold text-volt dark:text-black">
                      {friend.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Name or edit form */}
                  {editingId === friend.id ? (
                    <form onSubmit={e => saveEdit(e, friend)} className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 min-w-0 px-4 h-10 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-full text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-volt focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 transition-all text-[15px]"
                      />
                      <button type="submit" disabled={saving} className="h-10 px-4 bg-black dark:bg-volt text-white dark:text-black text-xs font-bold rounded-full hover:opacity-90 disabled:opacity-40 transition-all">
                        {saving ? "…" : "Save"}
                      </button>
                      <button type="button" onClick={cancelEdit} className="h-10 px-4 bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 text-xs font-bold rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <span className="flex-1 min-w-0 truncate font-semibold text-black dark:text-white">{friend.name}</span>
                  )}

                  {/* Actions (hidden while editing) */}
                  {editingId !== friend.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(friend)}
                        className="w-9 h-9 shrink-0 grid place-items-center text-gray-400 hover:text-black dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                      </button>
                      <button
                        onClick={() => deleteFriend(friend)}
                        className="w-9 h-9 shrink-0 grid place-items-center text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Count footer */}
          {!loading && friends.length > 0 && (
            <p className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 mt-5">
              {friends.length} friend{friends.length !== 1 ? "s" : ""}
            </p>
          )}

        </div>
      </div>
  )
}
