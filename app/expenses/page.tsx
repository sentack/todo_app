"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
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

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"
type TimeFilter = "all" | "today" | "7d" | "30d"

const PAGE_SIZE = 15

const CATEGORIES = [
  "Food & Drinks",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Bills",
  "Other",
]

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drinks": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Transport":     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Shopping":      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Entertainment": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Health":        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Bills":         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Other":         "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function dateOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split("T")[0]
}

function formatDateLabel(dateStr: string) {
  const today = todayStr()
  const yesterday = dateOffset(1)
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export default function ExpensesPage() {
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [loading, setLoading]         = useState(true)
  const [formOpen, setFormOpen]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // form fields
  const [amount, setAmount]           = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory]       = useState("Food & Drinks")
  const [date, setDate]               = useState(todayStr())

  // filter / sort
  const [search, setSearch]               = useState("")
  const [timeFilter, setTimeFilter]       = useState<TimeFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortKey, setSortKey]             = useState<SortKey>("date-desc")
  const [page, setPage]                   = useState(1)

  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    fetchExpenses()
  }, [])

  // reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [search, timeFilter, categoryFilter, sortKey])

  const fetchExpenses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
    if (data) setExpenses(data)
    setLoading(false)
  }

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }
    const { data, error } = await supabase
      .from("expenses")
      .insert({ user_id: user.id, amount: parsed, description: description.trim() || null, category, date })
      .select()
      .single()
    if (!error && data) {
      setExpenses(prev => [data, ...prev])
      setAmount("")
      setDescription("")
      setDate(todayStr())
      setFormOpen(false)
      setPage(1)
    }
    setSubmitting(false)
  }

  const deleteExpense = useCallback(async (id: string) => {
    setDeletingId(id)
    await supabase.from("expenses").delete().eq("id", id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }, [])

  // ── derived state ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = expenses

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      )
    }

    if (categoryFilter !== "all") {
      result = result.filter(e => e.category === categoryFilter)
    }

    const today = todayStr()
    if (timeFilter === "today") {
      result = result.filter(e => e.date === today)
    } else if (timeFilter === "7d") {
      const cutoff = dateOffset(7)
      result = result.filter(e => e.date >= cutoff)
    } else if (timeFilter === "30d") {
      const cutoff = dateOffset(30)
      result = result.filter(e => e.date >= cutoff)
    }

    return [...result].sort((a, b) => {
      switch (sortKey) {
        case "date-desc":   return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
        case "date-asc":    return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
        case "amount-desc": return Number(b.amount) - Number(a.amount)
        case "amount-asc":  return Number(a.amount) - Number(b.amount)
      }
    })
  }, [expenses, search, categoryFilter, timeFilter, sortKey])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const todayTotal  = expenses.filter(e => e.date === todayStr()).reduce((s, e) => s + Number(e.amount), 0)

  const isDateSorted = sortKey === "date-desc" || sortKey === "date-asc"

  // group only the current page's items
  const grouped = useMemo(() => {
    if (!isDateSorted) return null
    const g: Record<string, Expense[]> = {}
    for (const exp of paginated) {
      if (!g[exp.date]) g[exp.date] = []
      g[exp.date].push(exp)
    }
    return g
  }, [paginated, isDateSorted])

  const hasActiveFilters = search || categoryFilter !== "all" || timeFilter !== "all"

  // ── render ───────────────────────────────────────────────────────────────────

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
              <h1 className="text-3xl font-bold text-black dark:text-white">Expenses</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormOpen(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  formOpen
                    ? "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                    : "bg-black dark:bg-white text-white dark:text-black hover:opacity-80"
                }`}
              >
                <svg className={`w-4 h-4 transition-transform duration-200 ${formOpen ? "rotate-45" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                {formOpen ? "Cancel" : "Add Expense"}
              </button>
              <Link
                href="/expenses/stats"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Stats
              </Link>
            </div>
          </div>

          {/* Today's total banner — hidden when filters are active */}
          {!hasActiveFilters && (
            <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
              <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Today&apos;s Total</p>
              <p className="text-3xl font-bold text-white dark:text-black">ETB {todayTotal.toFixed(2)}</p>
            </div>
          )}

          {/* Collapsible add form */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${formOpen ? "max-h-[560px] opacity-100 mb-6" : "max-h-0 opacity-0"}`}>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-black dark:text-white mb-4">New Expense</h2>
              <form onSubmit={addExpense} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">ETB</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-11 pr-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="py-2.5 px-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What did you spend on?"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all duration-200"
                >
                  {submitting ? "Adding..." : "Add Expense"}
                </button>
              </form>
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="space-y-3 mb-6">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search expenses..."
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter + sort row */}
            <div className="flex flex-wrap gap-2">
              {/* Time filter pills */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
                {(["all", "today", "7d", "30d"] as TimeFilter[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      timeFilter === t
                        ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                    }`}
                  >
                    {t === "all" ? "All time" : t === "today" ? "Today" : t === "7d" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Sort */}
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all ml-auto"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="amount-desc">Amount: high to low</option>
                <option value="amount-asc">Amount: low to high</option>
              </select>
            </div>
          </div>

          {/* Results summary */}
          {!loading && (
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filtered.length === 0
                  ? "No results"
                  : `${filtered.length} expense${filtered.length !== 1 ? "s" : ""}${hasActiveFilters ? " found" : ""}`}
              </span>
              {filtered.length > 0 && (
                <span className="text-sm font-semibold text-black dark:text-white">
                  Total: ETB {filteredTotal.toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Expenses list */}
          <div className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-2xl h-16" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  {hasActiveFilters ? "No expenses match your filters." : "No expenses yet. Add your first one above."}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearch(""); setCategoryFilter("all"); setTimeFilter("all") }}
                    className="mt-3 text-sm font-semibold text-black dark:text-white underline underline-offset-2"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : isDateSorted && grouped ? (
              // Grouped by date view
              Object.keys(grouped)
                .sort((a, b) => sortKey === "date-asc" ? a.localeCompare(b) : b.localeCompare(a))
                .map(dateKey => {
                  const dayExpenses = grouped[dateKey]
                  const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0)
                  return (
                    <div key={dateKey}>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                          {formatDateLabel(dateKey)}
                        </span>
                        <span className="text-sm font-bold text-black dark:text-white">
                          ETB {dayTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        {dayExpenses.map((exp, idx) => (
                          <ExpenseRow
                            key={exp.id}
                            exp={exp}
                            isLast={idx === dayExpenses.length - 1}
                            deletingId={deletingId}
                            onDelete={deleteExpense}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })
            ) : (
              // Flat list (amount sort)
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                {paginated.map((exp, idx) => (
                  <ExpenseRow
                    key={exp.id}
                    exp={exp}
                    isLast={idx === paginated.length - 1}
                    deletingId={deletingId}
                    onDelete={deleteExpense}
                    showDate
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && !loading && filtered.length > 0 && (
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Prev
              </button>

              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
                <span className="ml-2 text-gray-400 dark:text-gray-600">
                  ({(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length})
                </span>
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

        </div>
      </div>
    </AuthenticatedLayout>
  )
}

// ── sub-component ─────────────────────────────────────────────────────────────

function ExpenseRow({
  exp,
  isLast,
  deletingId,
  onDelete,
  showDate = false,
}: {
  exp: Expense
  isLast: boolean
  deletingId: string | null
  onDelete: (id: string) => void
  showDate?: boolean
}) {
  const CATEGORY_COLORS: Record<string, string> = {
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
        <p className="font-medium text-black dark:text-white truncate">
          {exp.description || exp.category}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {exp.description && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS["Other"]}`}>
              {exp.category}
            </span>
          )}
          {showDate && (
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {formatDateLabel(exp.date)}
            </span>
          )}
        </div>
      </div>
      <span className="text-lg font-bold text-black dark:text-white shrink-0">
        ETB {Number(exp.amount).toFixed(2)}
      </span>
      <button
        onClick={() => onDelete(exp.id)}
        disabled={deletingId === exp.id}
        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-200 disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
