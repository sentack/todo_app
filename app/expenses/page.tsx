"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"

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

const CATEGORIES = ["Food & Drinks","Transport","Shopping","Entertainment","Health","Bills","Other"]

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
  const [formOpen, setFormOpen]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // form fields
  const [amount, setAmount]           = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory]       = useState("Food & Drinks")
  const [date, setDate]               = useState(todayStr())

  // filters
  const [search, setSearch]                   = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [timeFilter, setTimeFilter]           = useState<TimeFilter>("all")
  const [categoryFilter, setCategoryFilter]   = useState("all")
  const [sortKey, setSortKey]                 = useState<SortKey>("date-desc")

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)

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

  const closeForm = () => {
    setFormOpen(false)
    setEditingExpense(null)
    setAmount("")
    setDescription("")
    setCategory("Food & Drinks")
    setDate(todayStr())
  }

  const startEdit = (exp: Expense) => {
    setEditingExpense(exp)
    setAmount(String(exp.amount))
    setDescription(exp.description ?? "")
    setCategory(exp.category)
    setDate(exp.date)
    setFormOpen(true)
  }

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setSubmitting(true)

    if (editingExpense) {
      const { data, error } = await supabase
        .from("expenses")
        .update({ amount: parsed, description: description.trim() || null, category, date })
        .eq("id", editingExpense.id)
        .select().single()
      if (!error && data) {
        setAllExpenses(prev => prev.map(e => e.id === data.id ? data : e))
        closeForm()
      }
    } else {
      if (!userIdRef.current) { setSubmitting(false); return }
      const { error } = await supabase.from("expenses").insert({
        user_id: userIdRef.current, amount: parsed,
        description: description.trim() || null, category, date,
      })
      if (!error) {
        closeForm()
        setPage(1)
        refresh()
      }
    }
    setSubmitting(false)
  }

  const deleteExpense = async (id: string) => {
    setDeletingId(id)
    await supabase.from("expenses").delete().eq("id", id)
    setAllExpenses(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Expenses</h1>
            </div>
            <button
              onClick={formOpen ? closeForm : () => setFormOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 ${formOpen ? "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300" : "bg-black dark:bg-white text-white dark:text-black hover:opacity-80"}`}
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${formOpen ? "rotate-45" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {formOpen ? "Cancel" : (editingExpense ? "Editing" : "Add Expense")}
            </button>
          </div>

          {/* Today's total banner */}
          {!hasActiveFilters && (
            <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
              <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Today&apos;s Total</p>
              <p className="text-3xl font-bold text-white dark:text-black">ETB {todayTotal.toFixed(2)}</p>
            </div>
          )}

          {/* Collapsible form */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${formOpen ? "max-h-[560px] opacity-100 mb-6" : "max-h-0 opacity-0"}`}>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
                {editingExpense ? "Edit Expense" : "New Expense"}
              </h2>
              <form onSubmit={submitExpense} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">ETB</span>
                      <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full pl-11 pr-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="py-2.5 px-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Description</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you spend on?" className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all duration-200">
                  {submitting ? "Saving..." : (editingExpense ? "Save Changes" : "Add Expense")}
                </button>
              </form>
            </div>
          </div>

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
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
                {(["all", "today", "7d", "30d"] as TimeFilter[]).map(t => (
                  <button key={t} onClick={() => setTimeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${timeFilter === t ? "bg-black dark:bg-white text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
                    {t === "all" ? "All time" : t === "today" ? "Today" : t === "7d" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all">
                <option value="all">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all ml-auto">
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="amount-desc">Amount: high to low</option>
                <option value="amount-asc">Amount: low to high</option>
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
                <p className="text-gray-500 dark:text-gray-400">{hasActiveFilters ? "No expenses match your filters." : "No expenses yet. Add your first one above."}</p>
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
                      <span className="text-sm font-bold text-black dark:text-white">ETB {dayTotal.toFixed(2)}</span>
                    </div>
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                      {dayExpenses.map((exp, idx) => (
                        <ExpenseRow key={exp.id} exp={exp} isLast={idx === dayExpenses.length - 1} deletingId={deletingId} onDelete={deleteExpense} onEdit={startEdit} />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                {paged.map((exp, idx) => (
                  <ExpenseRow key={exp.id} exp={exp} isLast={idx === paged.length - 1} deletingId={deletingId} onDelete={deleteExpense} onEdit={startEdit} showDate />
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

function ExpenseRow({ exp, isLast, deletingId, onDelete, onEdit, showDate = false }: {
  exp: Expense; isLast: boolean; deletingId: string | null
  onDelete: (id: string) => void; onEdit: (exp: Expense) => void; showDate?: boolean
}) {
  const COLORS: Record<string, string> = {
    "Food & Drinks": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "Transport":     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "Shopping":      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    "Entertainment": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "Health":        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Bills":         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "Other":         "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  }
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${!isLast ? "border-b border-gray-100 dark:border-gray-900" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-black dark:text-white truncate">{exp.description || exp.category}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {exp.description && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COLORS[exp.category] || COLORS["Other"]}`}>{exp.category}</span>}
          {showDate && <span className="text-xs text-gray-400 dark:text-gray-600">{formatDateLabel(exp.date)}</span>}
        </div>
      </div>
      <span className="text-lg font-bold text-black dark:text-white shrink-0">ETB {Number(exp.amount).toFixed(2)}</span>
      <button onClick={() => onEdit(exp)} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors duration-200">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
      </button>
      <button onClick={() => onDelete(exp.id)} disabled={deletingId === exp.id} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-200 disabled:opacity-40">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      </button>
    </div>
  )
}
