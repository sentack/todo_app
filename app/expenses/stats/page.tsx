/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"
import { useCurrency } from "@/contexts/CurrencyContext"
import { CATEGORY_COLORS, CATEGORY_TEXT } from "@/lib/constants"
import { formatMoney } from "@/lib/formatMoney"

interface Expense {
  id: string
  amount: number
  description: string | null
  category: string
  date: string
}


function StatCard({
  label,
  value,
  sub,
  delay,
}: {
  label: string
  value: string
  sub?: string
  delay?: number
}) {
  return (
    <div
      className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl animate-slide-in-up"
      style={{ animationDelay: `${(delay ?? 0) * 0.1}s` }}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-black dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

export default function ExpenseStatsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserSupabaseClient()
  const { currency } = useCurrency()

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("expenses")
        .select("id, amount, description, category, date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })

      if (data) setExpenses(data)
      setLoading(false)
    })()
  }, [])

  const today = new Date().toISOString().split("T")[0]

  const startOf = (daysAgo: number) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().split("T")[0]
  }

  const sum = (list: Expense[]) => list.reduce((s, e) => s + Number(e.amount), 0)

  const todayExpenses = expenses.filter(e => e.date === today)
  const weekExpenses = expenses.filter(e => e.date >= startOf(7))
  const monthExpenses = expenses.filter(e => e.date >= startOf(30))

  const todayTotal = sum(todayExpenses)
  const weekTotal = sum(weekExpenses)
  const monthTotal = sum(monthExpenses)
  const allTotal = sum(expenses)

  // Average daily spending — over distinct days that have any expense
  const allDays = [...new Set(expenses.map(e => e.date))]
  const avgDaily = allDays.length > 0 ? allTotal / allDays.length : 0

  // Average over past 30 calendar days
  const avg30 = monthTotal / 30

  // Category breakdown (all time)
  const categoryTotals: Record<string, number> = {}
  for (const exp of expenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount)
  }
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const maxCategoryTotal = sortedCategories[0]?.[1] ?? 1

  // Biggest single expense
  const biggest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0]

  // Most expensive day (all time)
  const byDay: Record<string, number> = {}
  for (const exp of expenses) {
    byDay[exp.date] = (byDay[exp.date] || 0) + Number(exp.amount)
  }
  const [mostExpensiveDay, mostExpensiveDayTotal] = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-black dark:text-white">Expense Stats</h1>
            </div>
            <Link
              href="/expenses"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton rounded-2xl h-24" />)}
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">No expense data yet.</p>
              <Link href="/expenses" className="text-sm font-semibold text-black dark:text-white underline underline-offset-2">
                Add your first expense
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary cards */}
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-4">Totals</h2>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Today" value={`${currency} ${formatMoney(todayTotal)}`} delay={0} />
                  <StatCard label="Past 7 Days" value={`${currency} ${formatMoney(weekTotal)}`} delay={1} />
                  <StatCard label="Past 30 Days" value={`${currency} ${formatMoney(monthTotal)}`} delay={2} />
                  <StatCard label="All Time" value={`${currency} ${formatMoney(allTotal)}`} sub={`${allDays.length} day${allDays.length !== 1 ? "s" : ""} tracked`} delay={3} />
                </div>
              </div>

              {/* Averages */}
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-4">Averages</h2>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="Avg per spending day"
                    value={`${currency} ${formatMoney(avgDaily)}`}
                    sub="Days with at least one expense"
                    delay={0}
                  />
                  <StatCard
                    label="Avg per calendar day"
                    value={`${currency} ${formatMoney(avg30)}`}
                    sub="Based on last 30 days"
                    delay={1}
                  />
                </div>
              </div>

              {/* Highlights */}
              {(biggest || mostExpensiveDay) && (
                <div>
                  <h2 className="text-xl font-semibold text-black dark:text-white mb-4">Highlights</h2>
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    {biggest && (
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-900">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Biggest Single Expense</p>
                          <p className="font-semibold text-black dark:text-white">
                            {biggest.description || biggest.category}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateLabel(biggest.date)}</p>
                        </div>
                        <span className="text-xl font-bold text-black dark:text-white">{currency} {formatMoney(Number(biggest.amount))}</span>
                      </div>
                    )}
                    {mostExpensiveDay && (
                      <div className="flex items-center justify-between px-5 py-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Most Expensive Day</p>
                          <p className="font-semibold text-black dark:text-white">{formatDateLabel(mostExpensiveDay)}</p>
                        </div>
                        <span className="text-xl font-bold text-black dark:text-white">{currency} {formatMoney(mostExpensiveDayTotal as number)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              {sortedCategories.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-black dark:text-white mb-4">By Category</h2>
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                    {sortedCategories.map(([cat, total], idx) => {
                      const pct = Math.round((total / maxCategoryTotal) * 100)
                      const count = expenses.filter(e => e.category === cat).length
                      return (
                        <div key={cat} className="animate-slide-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-semibold ${CATEGORY_TEXT[cat] || CATEGORY_TEXT["Other"]}`}>{cat}</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-black dark:text-white">{currency} {formatMoney(total)}</span>
                              <span className="text-xs text-gray-400 ml-2">{count} item{count !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
