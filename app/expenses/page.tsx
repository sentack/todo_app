"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"
import { CATEGORIES, CATEGORY_BADGE } from "@/lib/constants"
import { useCurrency } from "@/contexts/CurrencyContext"
import { triggerUndo } from "@/lib/undoToast"
import { formatMoney } from "@/lib/formatMoney"

interface Expense {
  id: string
  amount: number
  description: string | null
  category: string
  date: string
  created_at: string
}

type SortKey    = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"
type TimeFilter = "all" | "today" | "7d" | "30d"

const PAGE_SIZE = 15

function todayStr() { return new Date().toISOString().split("T")[0] }
function dateOffset(days: number) { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split("T")[0] }

function formatDateLabel(dateStr: string) {
  const today     = todayStr()
  const yesterday = dateOffset(1)
  if (dateStr === today)     return "Today"
  if (dateStr === yesterday) return "Yesterday"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function ExpensesPage() {
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshKey, setRefreshKey]   = useState(0)
  const [page, setPage]               = useState(1)

  // filters
  const [search, setSearch]                   = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [timeFilter, setTimeFilter]           = useState<TimeFilter>("all")
  const [categoryFilter, setCategoryFilter]   = useState("all")
  const [sortKey, setSortKey]                 = useState<SortKey>("date-desc")

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)
  const { currency } = useCurrency()

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Load all expenses on mount and after mutations
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      if (!userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        userIdRef.current = user.id
      }
      if (cancelled) return
      const uid = userIdRef.current!

      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })

      if (!cancelled) {
        setAllExpenses((data ?? []) as Expense[])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1) }, [debouncedSearch, categoryFilter, timeFilter, sortKey])

  // ── client-side filter + sort ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...allExpenses]

    if (debouncedSearch.trim()) {
      const s = debouncedSearch.trim().toLowerCase()
      result = result.filter(e =>
        (e.description ?? "").toLowerCase().includes(s) ||
        e.category.toLowerCase().includes(s)
      )
    }

    if (categoryFilter !== "all") result = result.filter(e => e.category === categoryFilter)

    if      (timeFilter === "today") result = result.filter(e => e.date === todayStr())
    else if (timeFilter === "7d")    result = result.filter(e => e.date >= dateOffset(7))
    else if (timeFilter === "30d")   result = result.filter(e => e.date >= dateOffset(30))

    switch (sortKey) {
      case "date-desc":   result.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)); break
      case "date-asc":    result.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)); break
      case "amount-desc": result.sort((a, b) => Number(b.amount) - Number(a.amount)); break
      case "amount-asc":  result.sort((a, b) => Number(a.amount) - Number(b.amount)); break
    }

    return result
  }, [allExpenses, debouncedSearch, categoryFilter, timeFilter, sortKey])

  const todayTotal  = useMemo(() => allExpenses.filter(e => e.date === todayStr()).reduce((s, e) => s + Number(e.amount), 0), [allExpenses])
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)
  const paged       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isDateSorted     = sortKey === "date-desc" || sortKey === "date-asc"
  const hasActiveFilters = debouncedSearch || categoryFilter !== "all" || timeFilter !== "all"

  const grouped = isDateSorted ? paged.reduce((g, exp) => {
    if (!g[exp.date]) g[exp.date] = []
    g[exp.date].push(exp)
    return g
  }, {} as Record<string, Expense[]>) : null

  const groupedDates = grouped
    ? Object.keys(grouped).sort((a, b) => sortKey === "date-asc" ? a.localeCompare(b) : b.localeCompare(a))
    : []

  // ── mutations ─────────────────────────────────────────────────────────────

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === "expense") { setPage(1); refresh() }
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteExpense = (id: string) => {
    const item = allExpenses.find(e => e.id === id)
    if (!item) return
    setAllExpenses(prev => prev.filter(e => e.id !== id))
    let undone = false
    triggerUndo(`Deleted expense: ${item.description || item.category}`, () => {
      undone = true
      setAllExpenses(prev => [...prev, item].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)))
    })
    setTimeout(() => {
      if (!undone) supabase.from("expenses").delete().eq("id", id)
    }, 5100)
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Expenses</h1>
          </div>

          {/* Today's total banner */}
          {!hasActiveFilters && (
            <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
              <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Today&apos;s Total</p>
              <p className="text-3xl font-bold text-white dark:text-black">{currency} {formatMoney(todayTotal)}</p>
            </div>
          )}

          {/* Search + filter bar */}
          <div className="space-y-3 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              )}
            </div>
            {/* Time filter — single scrollable row */}
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit min-w-full">
                {(["all", "today", "7d", "30d"] as TimeFilter[]).map(t => (
                  <button key={t} onClick={() => setTimeFilter(t)} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${timeFilter === t ? "bg-black dark:bg-white text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
                    {t === "all" ? "All time" : t === "today" ? "Today" : t === "7d" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>
            </div>
            {/* Category + sort — one row, each takes half */}
            <div className="flex gap-2">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex-1 px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all">
                <option value="all">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="flex-1 px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all">
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="amount-desc">High → low</option>
                <option value="amount-asc">Low → high</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          {!loading && (
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filtered.length === 0
                  ? "No results"
                  : `${filtered.length} expense${filtered.length !== 1 ? "s" : ""}${hasActiveFilters ? " found" : ""}`}
              </span>
            </div>
          )}

          {/* List */}
          <div className="space-y-6">
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton rounded-2xl h-16" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">{hasActiveFilters ? "No expenses match your filters." : "No expenses yet. Use the + button to add one."}</p>
                {hasActiveFilters && (
                  <button onClick={() => { setSearch(""); setCategoryFilter("all"); setTimeFilter("all") }} className="mt-3 text-sm font-semibold text-black dark:text-white underline underline-offset-2">Clear filters</button>
                )}
              </div>
            ) : isDateSorted && grouped ? (
              groupedDates.map(dateKey => {
                const dayExpenses = grouped[dateKey]
                const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0)
                return (
                  <div key={dateKey}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{formatDateLabel(dateKey)}</span>
                      <span className="text-sm font-bold text-black dark:text-white">{currency} {formatMoney(dayTotal)}</span>
                    </div>
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                      {dayExpenses.map((exp, idx) => (
                        <ExpenseRow key={exp.id} exp={exp} isLast={idx === dayExpenses.length - 1} onDelete={deleteExpense} onUpdated={updated => setAllExpenses(prev => prev.map(e => e.id === updated.id ? updated : e))} currency={currency} />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                {paged.map((exp, idx) => (
                  <ExpenseRow key={exp.id} exp={exp} isLast={idx === paged.length - 1} onDelete={deleteExpense} onUpdated={updated => setAllExpenses(prev => prev.map(e => e.id === updated.id ? updated : e))} showDate currency={currency} />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                Next →
              </button>
            </div>
          )}

        </div>
      </div>
    </AuthenticatedLayout>
  )
}

// ── ExpenseRow ────────────────────────────────────────────────────────────────

const ROW_INPUT = "w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"

function ExpenseRow({ exp, isLast, onDelete, onUpdated, showDate = false, currency }: {
  exp: Expense; isLast: boolean; currency: string; showDate?: boolean
  onDelete: (id: string) => void; onUpdated: (updated: Expense) => void
}) {
  const [isEditing, setIsEditing]   = useState(false)
  const [amount, setAmount]         = useState(String(exp.amount))
  const [description, setDesc]      = useState(exp.description ?? "")
  const [category, setCategory]     = useState(exp.category)
  const [date, setDate]             = useState(exp.date)
  const [saving, setSaving]         = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const startEdit = () => {
    setAmount(String(exp.amount)); setDesc(exp.description ?? "")
    setCategory(exp.category); setDate(exp.date); setIsEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setSaving(true)
    const { data, error } = await supabase.from("expenses")
      .update({ amount: parsed, description: description.trim() || null, category, date })
      .eq("id", exp.id).select().single()
    setSaving(false)
    if (!error && data) { setIsEditing(false); onUpdated(data) }
  }

  const borderCls = !isLast ? "border-b border-gray-100 dark:border-gray-900" : ""

  if (isEditing) {
    return (
      <div className={`px-5 py-4 ${borderCls}`}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{currency} Amount *</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus className={ROW_INPUT} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={ROW_INPUT} />
            </div>
          </div>
          <input type="text" value={description} onChange={e => setDesc(e.target.value)} placeholder="Description" className={ROW_INPUT} />
          <select value={category} onChange={e => setCategory(e.target.value)} className={ROW_INPUT}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-900 text-black dark:text-white text-sm font-semibold rounded-xl hover:opacity-80 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${borderCls}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-black dark:text-white truncate">{exp.description || exp.category}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {exp.description && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_BADGE[exp.category] || CATEGORY_BADGE["Other"]}`}>{exp.category}</span>}
          {showDate && <span className="text-xs text-gray-400 dark:text-gray-600">{formatDateLabel(exp.date)}</span>}
        </div>
      </div>
      <span className="text-lg font-bold text-black dark:text-white shrink-0">{currency} {formatMoney(Number(exp.amount))}</span>
      <button onClick={startEdit} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors duration-200">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
      </button>
      <button onClick={() => onDelete(exp.id)} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-200">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      </button>
    </div>
  )
}
