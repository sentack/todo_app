"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useCurrency } from "@/contexts/CurrencyContext"
import { formatMoney } from "@/lib/formatMoney"

interface SearchResult {
  id: string
  label: string
  sub?: string
  section: string
  href: string
}

interface GlobalSearchProps {
  userId: string
}

export default function GlobalSearch({ userId }: GlobalSearchProps) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router                = useRouter()
  const supabase              = createBrowserSupabaseClient()
  const { currency }          = useCurrency()

  // Open on Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults([])
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !userId) { setResults([]); return }
    setLoading(true)

    const like = `%${q.trim()}%`

    const [
      { data: todos },
      { data: expenses },
      { data: toBuy },
      { data: debts },
      { data: lendings },
      { data: friends },
    ] = await Promise.all([
      supabase.from("todos").select("id, title, description, completed").eq("user_id", userId)
        .or(`title.ilike.${like},description.ilike.${like}`).limit(4),
      supabase.from("expenses").select("id, description, category, amount").eq("user_id", userId)
        .or(`description.ilike.${like},category.ilike.${like}`).limit(4),
      supabase.from("to_buy_items").select("id, name, urgency").eq("user_id", userId)
        .ilike("name", like).limit(4),
      supabase.from("debts").select("id, person, amount").eq("user_id", userId)
        .ilike("person", like).limit(4),
      supabase.from("lendings").select("id, person, amount").eq("user_id", userId)
        .ilike("person", like).limit(4),
      supabase.from("friends").select("id, name").eq("user_id", userId)
        .ilike("name", like).limit(4),
    ])

    const r: SearchResult[] = [
      ...(todos ?? []).map(t => ({
        id: t.id, section: "Todos", href: "/",
        label: t.title, sub: t.completed ? "Completed" : "Pending",
      })),
      ...(expenses ?? []).map(e => ({
        id: e.id, section: "Expenses", href: "/expenses",
        label: e.description || e.category, sub: e.category,
      })),
      ...(toBuy ?? []).map(i => ({
        id: i.id, section: "To Buy", href: "/to-buy",
        label: i.name, sub: i.urgency,
      })),
      ...(debts ?? []).map(d => ({
        id: d.id, section: "Debts", href: "/debts",
        label: d.person, sub: `${currency} ${formatMoney(Number(d.amount))}`,
      })),
      ...(lendings ?? []).map(l => ({
        id: l.id, section: "Lending", href: "/lending",
        label: l.person, sub: `${currency} ${formatMoney(Number(l.amount))}`,
      })),
      ...(friends ?? []).map(f => ({
        id: f.id, section: "Friends", href: "/friends",
        label: f.name,
      })),
    ]

    setResults(r)
    setLoading(false)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  // Group results
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.section]) acc[r.section] = []
    acc[r.section].push(r)
    return acc
  }, {} as Record<string, SearchResult[]>)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 grid place-items-center rounded-full bg-white/70 dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/10 shadow-sm focus-ring transition-all duration-200 lg:w-auto lg:px-3.5 lg:gap-2.5 lg:flex lg:items-center"
        aria-label="Search (Ctrl+K)"
        title="Search everything (Ctrl+K)"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <span className="hidden lg:inline text-sm font-medium text-gray-500 dark:text-gray-400 pr-6">Search…</span>
        <kbd className="hidden lg:inline text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-black/[0.05] dark:bg-white/[0.08] px-1.5 py-0.5 rounded-md">Ctrl K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[max(1rem,env(safe-area-inset-top))] sm:pt-24 px-3 sm:px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade-in" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-950 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden animate-pop-in">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 dark:border-white/[0.06]">
          <svg className="w-5 h-5 text-volt-700 dark:text-volt shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search everything..."
            className="flex-1 min-w-0 bg-transparent text-black dark:text-white placeholder-gray-400 focus:outline-none focus-visible:outline-none text-base font-medium"
          />
          {loading && (
            <svg className="w-4 h-4 animate-spin text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          <kbd className="shrink-0 text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-white/[0.08] px-2 py-1 rounded-lg">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[min(28rem,70dvh)] overflow-y-auto p-2">
          {query.trim() === "" && (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              Type to search across todos, expenses, friends, and more…
            </div>
          )}
          {query.trim() !== "" && results.length === 0 && !loading && (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section}>
              <div className="px-3 pt-3 pb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.14em]">
                {section}
              </div>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.href)}
                  className="group w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black dark:text-white truncate">{item.label}</p>
                    {item.sub && <p className="text-xs text-gray-400 capitalize">{item.sub}</p>}
                  </div>
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-black dark:group-hover:text-volt group-hover:translate-x-0.5 transition-all shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
