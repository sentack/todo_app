/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
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
  "Transport": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Shopping": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Entertainment": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Health": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Bills": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Other": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

function formatDate(dateStr: string) {
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Food & Drinks")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100)

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
      .insert({
        user_id: user.id,
        amount: parsed,
        description: description.trim() || null,
        category,
        date,
      })
      .select()
      .single()

    if (!error && data) {
      setExpenses(prev => {
        const next = [data, ...prev]
        return next.sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date)
          return b.created_at.localeCompare(a.created_at)
        })
      })
      setAmount("")
      setDescription("")
    }
    setSubmitting(false)
  }

  const deleteExpense = async (id: string) => {
    setDeletingId(id)
    await supabase.from("expenses").delete().eq("id", id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  const today = new Date().toISOString().split("T")[0]
  const todayTotal = expenses
    .filter(e => e.date === today)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const grouped: Record<string, Expense[]> = {}
  for (const exp of expenses) {
    if (!grouped[exp.date]) grouped[exp.date] = []
    grouped[exp.date].push(exp)
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-black dark:text-white">Expenses</h1>
            </div>
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

          {/* Today's total banner */}
          <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
            <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Today's Total</p>
            <p className="text-3xl font-bold text-white dark:text-black">
              ${todayTotal.toFixed(2)}
            </p>
          </div>

          {/* Add expense form */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl mb-8">
            <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Add Expense</h2>
            <form onSubmit={addExpense} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full pl-7 pr-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
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
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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

          {/* Expenses list */}
          <div className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton rounded-2xl h-16" />
                ))}
              </div>
            ) : sortedDates.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No expenses yet. Add your first one above.</p>
              </div>
            ) : (
              sortedDates.map(dateKey => {
                const dayExpenses = grouped[dateKey]
                const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0)
                return (
                  <div key={dateKey}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        {formatDate(dateKey)}
                      </span>
                      <span className="text-sm font-bold text-black dark:text-white">
                        ${dayTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                      {dayExpenses.map((exp, idx) => (
                        <div
                          key={exp.id}
                          className={`flex items-center gap-4 px-5 py-4 ${
                            idx !== dayExpenses.length - 1 ? "border-b border-gray-100 dark:border-gray-900" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-black dark:text-white truncate">
                              {exp.description || exp.category}
                            </p>
                            {exp.description && (
                              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS["Other"]}`}>
                                {exp.category}
                              </span>
                            )}
                          </div>
                          <span className="text-lg font-bold text-black dark:text-white shrink-0">
                            ${Number(exp.amount).toFixed(2)}
                          </span>
                          <button
                            onClick={() => deleteExpense(exp.id)}
                            disabled={deletingId === exp.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-200 disabled:opacity-40"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
