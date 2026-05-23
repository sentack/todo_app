/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodoPeriodStat {
  period: string; created: number; inProgress: number; completed: number
}

interface LongestTodo {
  id: string; title: string; days: number; status_name: string
}

interface TimedTodo {
  id: string; title: string; days: number; hours: number
}

interface Expense {
  id: string; amount: number; description: string | null; category: string; date: string
}

interface ToBuyItem {
  id: string; name: string; quantity: number; price: number
  urgency: "low" | "medium" | "high" | "critical"; bought: boolean
}

type Tab = "todo" | "expenses" | "to-buy"

// ─── Shared components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, delay }: { label: string; value: string; sub?: string; delay?: number }) {
  return (
    <div
      className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl animate-slide-in-up"
      style={{ animationDelay: `${(delay ?? 0) * 0.1}s` }}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-black dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-2xl h-24" />)}
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drinks": "bg-orange-400 dark:bg-orange-500",
  "Transport":     "bg-blue-400 dark:bg-blue-500",
  "Shopping":      "bg-pink-400 dark:bg-pink-500",
  "Entertainment": "bg-purple-400 dark:bg-purple-500",
  "Health":        "bg-green-400 dark:bg-green-500",
  "Bills":         "bg-red-400 dark:bg-red-500",
  "Other":         "bg-gray-400 dark:bg-gray-500",
}

const CATEGORY_TEXT: Record<string, string> = {
  "Food & Drinks": "text-orange-600 dark:text-orange-400",
  "Transport":     "text-blue-600 dark:text-blue-400",
  "Shopping":      "text-pink-600 dark:text-pink-400",
  "Entertainment": "text-purple-600 dark:text-purple-400",
  "Health":        "text-green-600 dark:text-green-400",
  "Bills":         "text-red-600 dark:text-red-400",
  "Other":         "text-gray-600 dark:text-gray-400",
}

const URGENCY_META = {
  critical: { label: "Critical", color: "bg-red-500",    text: "text-red-600 dark:text-red-400"       },
  high:     { label: "High",     color: "bg-orange-400", text: "text-orange-600 dark:text-orange-400" },
  medium:   { label: "Medium",   color: "bg-yellow-400", text: "text-yellow-600 dark:text-yellow-400" },
  low:      { label: "Low",      color: "bg-gray-400",   text: "text-gray-600 dark:text-gray-400"     },
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("todo")
  const [userId, setUserId] = useState<string | null>(null)

  const [todoLoading, setTodoLoading]       = useState(true)
  const [periodStats, setPeriodStats]       = useState<TodoPeriodStat[]>([])
  const [longestTodos, setLongestTodos]     = useState<LongestTodo[]>([])
  const [fastestTodos, setFastestTodos]     = useState<TimedTodo[]>([])
  const [longestCompleted, setLongestCompleted] = useState<TimedTodo[]>([])

  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expensesLoaded, setExpensesLoaded]   = useState(false)
  const [expenses, setExpenses]               = useState<Expense[]>([])

  const [toBuyLoading, setToBuyLoading] = useState(false)
  const [toBuyLoaded, setToBuyLoaded]   = useState(false)
  const [toBuyItems, setToBuyItems]     = useState<ToBuyItem[]>([])

  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setTodoLoading(false); return }
      setUserId(user.id)
      await loadTodoData(user.id)
      setTodoLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!userId) return
    if (activeTab === "expenses" && !expensesLoaded) loadExpensesData(userId)
    if (activeTab === "to-buy"   && !toBuyLoaded)   loadToBuyData(userId)
  }, [activeTab, userId])

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadTodoData = async (uid: string) => {
    const periods = [
      { name: "Past Day",     days: 1  },
      { name: "Past 7 Days",  days: 7  },
      { name: "Past 30 Days", days: 30 },
    ]
    const pStats: TodoPeriodStat[] = []
    for (const p of periods) {
      const start = new Date()
      start.setDate(start.getDate() - p.days)
      const { data } = await supabase.from("todos").select("status_id").eq("user_id", uid).gte("created_at", start.toISOString())
      pStats.push({
        period:     p.name,
        created:    data?.length ?? 0,
        inProgress: data?.filter(t => t.status_id === 2).length ?? 0,
        completed:  data?.filter(t => t.status_id === 3).length ?? 0,
      })
    }
    setPeriodStats(pStats)

    const { data: running } = await supabase
      .from("todos")
      .select("id, title, created_at, updated_at, status_id, todo_status!inner(name)")
      .eq("user_id", uid).neq("status_id", 3).order("created_at", { ascending: true }).limit(3)
    if (running) {
      setLongestTodos(running.map(t => {
        const diff = Math.abs(new Date(t.updated_at).getTime() - new Date(t.created_at).getTime())
        return { id: t.id, title: t.title, days: Math.ceil(diff / 86400000), status_name: (t.todo_status as any).name }
      }))
    }

    const { data: completed } = await supabase
      .from("todos").select("id, title, created_at, updated_at").eq("user_id", uid).eq("status_id", 3).order("created_at", { ascending: true })
    if (completed) {
      const mapped = completed.map(t => {
        const diff = Math.abs(new Date(t.updated_at).getTime() - new Date(t.created_at).getTime())
        return { id: t.id, title: t.title, days: Math.floor(diff / 86400000), hours: Math.round(diff / 3600000 * 10) / 10 }
      })
      setLongestCompleted([...mapped].sort((a, b) => b.hours - a.hours).slice(0, 3))
      setFastestTodos([...mapped].sort((a, b) => a.hours - b.hours).slice(0, 3))
    }
  }

  const loadExpensesData = async (uid: string) => {
    setExpensesLoading(true)
    const { data } = await supabase.from("expenses").select("id, amount, description, category, date").eq("user_id", uid).order("date", { ascending: false })
    if (data) setExpenses(data)
    setExpensesLoaded(true)
    setExpensesLoading(false)
  }

  const loadToBuyData = async (uid: string) => {
    setToBuyLoading(true)
    const { data } = await supabase.from("to_buy_items").select("id, name, quantity, price, urgency, bought").eq("user_id", uid)
    if (data) setToBuyItems(data as ToBuyItem[])
    setToBuyLoaded(true)
    setToBuyLoading(false)
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const expStats = useMemo(() => {
    if (expenses.length === 0) return null
    const today = new Date().toISOString().split("T")[0]
    const start = (daysAgo: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split("T")[0] }
    const sum = (list: Expense[]) => list.reduce((s, e) => s + Number(e.amount), 0)

    const monthExps = expenses.filter(e => e.date >= start(30))
    const monthTotal = sum(monthExps)
    const allTotal   = sum(expenses)
    const allDays    = [...new Set(expenses.map(e => e.date))]

    const catTotals: Record<string, number> = {}
    for (const exp of expenses) catTotals[exp.category] = (catTotals[exp.category] || 0) + Number(exp.amount)
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1])

    const byDay: Record<string, number> = {}
    for (const exp of expenses) byDay[exp.date] = (byDay[exp.date] || 0) + Number(exp.amount)
    const [bigDay, bigDayTotal] = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

    return {
      todayTotal:  sum(expenses.filter(e => e.date === today)),
      weekTotal:   sum(expenses.filter(e => e.date >= start(7))),
      monthTotal,
      allTotal,
      allDays,
      avgDaily:    allDays.length > 0 ? allTotal / allDays.length : 0,
      avg30:       monthTotal / 30,
      sortedCats,
      maxCat:      sortedCats[0]?.[1] ?? 1,
      biggest:     [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0],
      bigDay,
      bigDayTotal: bigDayTotal as number,
    }
  }, [expenses])

  const toBuyStats = useMemo(() => {
    const pending = toBuyItems.filter(i => !i.bought)
    const bought  = toBuyItems.filter(i =>  i.bought)
    const pendingTotal = pending.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)
    const urgencyCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const item of pending) urgencyCounts[item.urgency] = (urgencyCounts[item.urgency] || 0) + 1
    return { pending, bought, pendingTotal, urgencyCounts, maxCount: Math.max(...Object.values(urgencyCounts), 1) }
  }, [toBuyItems])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Statistics</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 mb-8">
            {([["todo", "Todo"], ["expenses", "Expenses"], ["to-buy", "To Buy"]] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  activeTab === t
                    ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Todo Tab ─────────────────────────────────────────────────── */}
          {activeTab === "todo" && (
            todoLoading ? <SectionSkeleton /> : (
              <div className="space-y-8">

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Activity</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {periodStats.map((stat, i) => (
                      <div
                        key={stat.period}
                        className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl animate-slide-in-up"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">{stat.period}</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-sm text-gray-600 dark:text-gray-400">Created</span></div>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{stat.created}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400" /><span className="text-sm text-gray-600 dark:text-gray-400">In Progress</span></div>
                            <span className="font-bold text-yellow-600 dark:text-yellow-400">{stat.inProgress}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400" /><span className="text-sm text-gray-600 dark:text-gray-400">Completed</span></div>
                            <span className="font-bold text-green-600 dark:text-green-400">{stat.completed}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Longest Running</h2>
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl">
                    {longestTodos.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-6">No active todos found</p>
                    ) : (
                      <div className="space-y-3">
                        {longestTodos.map((todo, i) => (
                          <div key={todo.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl animate-slide-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-black dark:text-white truncate">{todo.title}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{todo.status_name}</p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{todo.days}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">days</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Longest to Complete</h2>
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl">
                    {longestCompleted.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-6">No completed todos found</p>
                    ) : (
                      <div className="space-y-3">
                        {longestCompleted.map((todo, i) => (
                          <div key={todo.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl animate-slide-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-black dark:text-white truncate">{todo.title}</p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{todo.days > 0 ? `${todo.days}d` : `${todo.hours}h`}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{todo.days > 0 ? "days" : "hours"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Fastest Completed</h2>
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl">
                    {fastestTodos.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-6">No completed todos found</p>
                    ) : (
                      <div className="space-y-3">
                        {fastestTodos.map((todo, i) => (
                          <div key={todo.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl animate-slide-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-black dark:text-white truncate">{todo.title}</p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">{todo.hours}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">hours</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )
          )}

          {/* ── Expenses Tab ─────────────────────────────────────────────── */}
          {activeTab === "expenses" && (
            expensesLoading ? <SectionSkeleton /> :
            expensesLoaded && expenses.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 dark:text-gray-400">No expense data yet.</p>
              </div>
            ) : expensesLoaded && expStats ? (
              <div className="space-y-8">

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Totals</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Today"        value={`ETB ${expStats.todayTotal.toFixed(2)}`} delay={0} />
                    <StatCard label="Past 7 Days"  value={`ETB ${expStats.weekTotal.toFixed(2)}`}  delay={1} />
                    <StatCard label="Past 30 Days" value={`ETB ${expStats.monthTotal.toFixed(2)}`} delay={2} />
                    <StatCard label="All Time"     value={`ETB ${expStats.allTotal.toFixed(2)}`}   sub={`${expStats.allDays.length} day${expStats.allDays.length !== 1 ? "s" : ""} tracked`} delay={3} />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Averages</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Avg per spending day"   value={`ETB ${expStats.avgDaily.toFixed(2)}`} sub="Days with at least one expense" delay={0} />
                    <StatCard label="Avg per calendar day"   value={`ETB ${expStats.avg30.toFixed(2)}`}    sub="Based on last 30 days"          delay={1} />
                  </div>
                </div>

                {(expStats.biggest || expStats.bigDay) && (
                  <div>
                    <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Highlights</h2>
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                      {expStats.biggest && (
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-900">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Biggest Single Expense</p>
                            <p className="font-semibold text-black dark:text-white truncate">{expStats.biggest.description || expStats.biggest.category}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(expStats.biggest.date)}</p>
                          </div>
                          <span className="text-lg font-bold text-black dark:text-white ml-4 shrink-0">ETB {Number(expStats.biggest.amount).toFixed(2)}</span>
                        </div>
                      )}
                      {expStats.bigDay && (
                        <div className="flex items-center justify-between px-5 py-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Most Expensive Day</p>
                            <p className="font-semibold text-black dark:text-white">{fmtDate(expStats.bigDay)}</p>
                          </div>
                          <span className="text-lg font-bold text-black dark:text-white ml-4 shrink-0">ETB {expStats.bigDayTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {expStats.sortedCats.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-black dark:text-white mb-4">By Category</h2>
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
                      {expStats.sortedCats.map(([cat, total], idx) => {
                        const pct   = Math.round((total / expStats.maxCat) * 100)
                        const count = expenses.filter(e => e.category === cat).length
                        return (
                          <div key={cat} className="animate-slide-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-sm font-semibold ${CATEGORY_TEXT[cat] || CATEGORY_TEXT["Other"]}`}>{cat}</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-black dark:text-white">ETB {total.toFixed(2)}</span>
                                <span className="text-xs text-gray-400 ml-2">{count} item{count !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"]}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            ) : null
          )}

          {/* ── To Buy Tab ───────────────────────────────────────────────── */}
          {activeTab === "to-buy" && (
            toBuyLoading ? <SectionSkeleton /> :
            toBuyLoaded && toBuyItems.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 dark:text-gray-400">No items in your list yet.</p>
              </div>
            ) : toBuyLoaded ? (
              <div className="space-y-8">

                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Summary</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Pending"       value={String(toBuyStats.pending.length)} sub="items to buy"    delay={0} />
                    <StatCard label="Bought"        value={String(toBuyStats.bought.length)}  sub="items completed" delay={1} />
                    <StatCard
                      label="Pending Value"
                      value={toBuyStats.pendingTotal > 0 ? `ETB ${toBuyStats.pendingTotal.toFixed(2)}` : "–"}
                      sub={toBuyStats.pendingTotal > 0 ? "estimated total" : "no prices set"}
                      delay={2}
                    />
                    <StatCard
                      label="Total Items"
                      value={String(toBuyItems.length)}
                      sub={`${Math.round(toBuyStats.bought.length / Math.max(toBuyItems.length, 1) * 100)}% complete`}
                      delay={3}
                    />
                  </div>
                </div>

                {toBuyStats.pending.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Pending by Urgency</h2>
                    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
                      {(["critical", "high", "medium", "low"] as const).filter(u => toBuyStats.urgencyCounts[u] > 0).map((u, idx) => {
                        const count = toBuyStats.urgencyCounts[u]
                        const pct   = Math.round((count / toBuyStats.maxCount) * 100)
                        return (
                          <div key={u} className="animate-slide-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-sm font-semibold ${URGENCY_META[u].text}`}>{URGENCY_META[u].label}</span>
                              <span className="text-sm font-bold text-black dark:text-white">{count} item{count !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${URGENCY_META[u].color}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            ) : null
          )}

        </div>
      </div>
    </AuthenticatedLayout>
  )
}
