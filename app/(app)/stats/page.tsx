/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useCurrency } from "@/contexts/CurrencyContext"
import { CATEGORY_COLORS, CATEGORY_TEXT } from "@/lib/constants"
import { formatMoney } from "@/lib/formatMoney"

// ─── Types ───────────────────────────────────────────────────────────

interface TodoPeriodStat {
  period: string; created: number; inProgress: number; completed: number
}
interface LongestTodo  { id: string; title: string; days: number; status_name: string }
interface TimedTodo    { id: string; title: string; days: number; hours: number }
interface Expense      { id: string; amount: number; description: string | null; category: string; date: string }
interface ToBuyItem    { id: string; name: string; quantity: number; price: number; urgency: "low"|"medium"|"high"|"critical"; bought: boolean }
interface FinanceItem  {
  id: string; amount: number; amount_paid: number; date: string; deadline: string | null
  person: string; paid_history: { amount: number; date: string }[]
}

type Tab        = "todo" | "expenses" | "to-buy" | "debts" | "lending"
type ExpPeriod  = "all" | "30d" | "7d"

// ─── Shared UI ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, delay, accent }: {
  label: string; value: string; sub?: string; delay?: number; accent?: string
}) {
  return (
    <div
      className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm animate-slide-in-up"
      style={{ animationDelay: `${(delay ?? 0) * 0.07}s` }}
    >
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <p className={`font-display text-xl sm:text-2xl font-extrabold tracking-tight leading-tight break-words ${accent ?? "text-black dark:text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton rounded-2xl h-24" />)}</div>
  )
}

function RankBar({
  label, labelRight, value, max, barClass, sub,
}: { label: string; labelRight: string; value: number; max: number; barClass: string; sub?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-semibold text-black dark:text-white truncate max-w-[60%]">{label}</span>
        <div className="text-right shrink-0 ml-2">
          <span className="text-sm font-bold text-black dark:text-white">{labelRight}</span>
          {sub && <span className="text-xs text-gray-400 ml-1.5">{sub}</span>}
        </div>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── SVG Charts ──────────────────────────────────────────────────────

function SpendingLineChart({ expenses, currency }: { expenses: Expense[]; currency: string }) {
  const today = new Date()
  const days  = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split("T")[0]
  })
  const byDay  = new Map<string, number>()
  for (const exp of expenses) byDay.set(exp.date, (byDay.get(exp.date) ?? 0) + Number(exp.amount))
  const values = days.map(d => byDay.get(d) ?? 0)
  const maxVal = Math.max(...values, 1)

  const W = 400, H = 130, padT = 14, padB = 24, padL = 4, padR = 4
  const chartW = W - padL - padR, chartH = H - padT - padB
  const pts  = values.map((v, i) => [padL + (i / (days.length - 1)) * chartW, padT + chartH - (v / maxVal) * chartH] as [number, number])
  const poly = pts.map(([x, y]) => `${x},${y}`).join(" ")
  const area = [`${padL},${padT + chartH}`, ...pts.map(([x, y]) => `${x},${y}`), `${padL + chartW},${padT + chartH}`].join(" ")
  const activeDays = days.filter(d => (byDay.get(d) ?? 0) > 0).length

  return (
    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm">
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-4">30-Day Spending</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sf-grad)" className="text-volt-500 dark:text-volt" />
        <polyline points={poly} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="stroke-black dark:stroke-volt" />
        {days.map((d, i) => {
          if (i % 7 !== 0 && i !== 29) return null
          const x = padL + (i / (days.length - 1)) * chartW
          const lbl = new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
          return <text key={d} x={x} y={H - 5} textAnchor={i === 0 ? "start" : i === 29 ? "end" : "middle"} className="fill-gray-400 dark:fill-gray-600" fontSize="9">{lbl}</text>
        })}
        <text x={padL} y={padT + 3} textAnchor="start" className="fill-gray-400 dark:fill-gray-600" fontSize="9">{currency} {maxVal.toFixed(0)}</text>
      </svg>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2 text-center">{activeDays} active days · avg {currency} {formatMoney(values.reduce((a, b) => a + b, 0) / 30)}/day</p>
    </div>
  )
}

function CompletionBarChart({ completions }: { completions: { date: string; count: number }[] }) {
  const maxCount = Math.max(...completions.map(c => c.count), 1)
  const W = 300, H = 90, padB = 20, chartH = H - padB
  const barW = W / completions.length

  return (
    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm">
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-4">7-Day Completions</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {completions.map((c, i) => {
          const bw = barW * 0.65, x = i * barW + (barW - bw) / 2
          const barH = Math.max(c.count > 0 ? 3 : 0, (c.count / maxCount) * chartH), y = chartH - barH
          const label = new Date(c.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })
          return (
            <g key={c.date}>
              <rect x={x} y={y} width={bw} height={barH} rx="5" className={c.count > 0 ? "fill-volt-500 dark:fill-volt" : "fill-black dark:fill-white"} opacity={c.count > 0 ? 1 : 0.06} />
              {c.count > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="9" className="fill-black dark:fill-white font-bold">{c.count}</text>}
              <text x={x + bw / 2} y={H - 5} textAnchor="middle" fontSize="9" className="fill-gray-400 dark:fill-gray-600">{label}</text>
            </g>
          )
        })}
      </svg>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2 text-center">{completions.reduce((s, c) => s + c.count, 0)} todos completed this week</p>
    </div>
  )
}

// ─── Insight helpers ─────────────────────────────────────────────────

const DAY_MS = 86400000
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parseDay = (s: string) => new Date(s + "T00:00:00")
const fmtDay = (s: string) => parseDay(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
const fmtCompact = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(Math.round(v))
const lastMonths = (n: number) => {
  const now = new Date()
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - k), 1)
    return { key: ymd(d).slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short" }) }
  })
}

function ColumnChart({ data, format }: {
  data: { label: string; value: number; current?: boolean }[]; format: (v: number) => string
}) {
  const max = Math.max(...data.map(d => d.value), 0)
  const maxIdx = max > 0 ? data.findIndex(d => d.value === max) : -1
  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2 h-44">
      {data.map((d, i) => {
        const hot = i === maxIdx
        return (
          <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
            <span className={`text-[0.625rem] font-bold tabular-nums truncate max-w-full ${hot ? "text-black dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
              {d.value > 0 ? format(d.value) : "–"}
            </span>
            <div className="flex-1 w-full flex items-end">
              <div
                className={`w-full rounded-xl transition-all duration-700 ease-out ${hot ? "bg-volt-500 dark:bg-volt shadow-md shadow-volt/30" : d.current ? "bg-black dark:bg-white" : "bg-black/[0.08] dark:bg-white/[0.1]"}`}
                style={{ height: `${max > 0 ? Math.max((d.value / max) * 100, d.value > 0 ? 5 : 2) : 2}%` }}
              />
            </div>
            <span className={`text-[0.6875rem] font-semibold ${d.current ? "text-black dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Extra debt / lending insights
function financeInsights(items: FinanceItem[]) {
  const today = parseDay(ymd(new Date()))
  const in7 = new Date(today.getTime() + 7 * DAY_MS)
  const outOf = (i: FinanceItem) => Math.max(0, Number(i.amount) - Number(i.amount_paid))
  const open = items.filter(i => outOf(i) > 0)
  const sum = (l: FinanceItem[], f: (i: FinanceItem) => number) => l.reduce((s, i) => s + f(i), 0)

  const overdue = open.filter(i => i.deadline && parseDay(i.deadline) < today)
  const dueSoon = open.filter(i => i.deadline && parseDay(i.deadline) >= today && parseDay(i.deadline) <= in7)
  const nextDue = open.filter(i => i.deadline && parseDay(i.deadline) >= today).sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0] ?? null
  const oldestOpen = [...open].filter(i => i.date).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

  const settleDays = items
    .filter(i => outOf(i) === 0 && i.date && (i.paid_history ?? []).length > 0)
    .map(i => {
      const last = [...i.paid_history].map(p => p.date).sort()[i.paid_history.length - 1]
      return Math.max(0, (parseDay(last).getTime() - parseDay(i.date).getTime()) / DAY_MS)
    })

  const payments = items
    .flatMap(i => (i.paid_history ?? []).map(p => ({ amount: Number(p.amount), date: p.date, person: i.person })))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))

  const months = lastMonths(6).map(m => ({ ...m, out: 0, back: 0 }))
  const idx = new Map(months.map((m, i) => [m.key, i]))
  for (const i of items) { const k = idx.get(i.date?.slice(0, 7)); if (k !== undefined) months[k].out += Number(i.amount) }
  for (const p of payments) { const k = idx.get(p.date?.slice(0, 7)); if (k !== undefined) months[k].back += p.amount }

  const totalAmount = sum(items, i => Number(i.amount))
  const totalPaid = sum(items, i => Math.min(Number(i.amount_paid), Number(i.amount)))
  return {
    rate:          totalAmount > 0 ? totalPaid / totalAmount : 0,
    totalAmount,   totalPaid,
    overdueAmount: sum(overdue, outOf), overdueCount: overdue.length,
    dueSoonAmount: sum(dueSoon, outOf), dueSoonCount: dueSoon.length,
    nextDue,       nextDueAmount: nextDue ? outOf(nextDue) : 0,
    oldestOpen,    oldestOpenDays: oldestOpen ? Math.floor((today.getTime() - parseDay(oldestOpen.date).getTime()) / DAY_MS) : 0,
    avgAmount:     items.length ? totalAmount / items.length : 0,
    people:        new Set(items.map(i => (i.person || "Unknown").trim().toLowerCase())).size,
    avgSettleDays: settleDays.length ? settleDays.reduce((a, b) => a + b, 0) / settleDays.length : null,
    settledCount:  settleDays.length,
    largest:       [...items].sort((a, b) => Number(b.amount) - Number(a.amount))[0] ?? null,
    payments,      lastPayment: payments[0] ?? null,
    months,        monthMax: Math.max(...months.map(m => Math.max(m.out, m.back)), 0),
  }
}

function FinanceInsights({ items, currency, kind }: { items: FinanceItem[]; currency: string; kind: "debt" | "lending" }) {
  const f = financeInsights(items)
  const L = kind === "debt"
    ? { item: "debt", out: "Borrowed", back: "Repaid", rate: "Repaid", pay: "Payments Made", outBar: "bg-rose-400 dark:bg-rose-500", accent: "text-rose-600 dark:text-rose-400" }
    : { item: "lending", out: "Lent", back: "Received", rate: "Returned", pay: "Payments Received", outBar: "bg-emerald-400 dark:bg-emerald-500", accent: "text-emerald-600 dark:text-emerald-400" }
  const money = (v: number) => `${currency} ${formatMoney(v)}`
  const plural = (n: number, w: string) => `${n} ${w}${n !== 1 ? "s" : ""}`

  return (
    <>
      {/* Repayment progress */}
      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">{L.rate} so far</p>
            <p className="font-display text-4xl font-extrabold tracking-tight leading-none text-black dark:text-white">{Math.round(f.rate * 100)}%</p>
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 text-right">{money(f.totalPaid)}<br />of {money(f.totalAmount)}</p>
        </div>
        <div className="h-3 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-volt-500 dark:bg-volt transition-all duration-700 ease-out" style={{ width: `${Math.min(f.rate * 100, 100)}%` }} />
        </div>
      </div>

      {/* Insight cards */}
      <div>
        <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">Insights</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Overdue Amount" value={money(f.overdueAmount)} sub={f.overdueCount > 0 ? plural(f.overdueCount, kind) : "nothing overdue"} accent={f.overdueAmount > 0 ? "text-rose-600 dark:text-rose-400" : undefined} delay={0} />
          <StatCard label="Due in 7 Days" value={money(f.dueSoonAmount)} sub={f.dueSoonCount > 0 ? plural(f.dueSoonCount, kind) : "none due soon"} accent={f.dueSoonAmount > 0 ? "text-amber-600 dark:text-amber-400" : undefined} delay={1} />
          <StatCard label={`Avg per ${L.item}`} value={money(f.avgAmount)} sub={plural(f.people, "person").replace("persons", "people")} delay={2} />
          <StatCard label="Avg Time to Settle" value={f.avgSettleDays !== null ? `${Math.round(f.avgSettleDays)}d` : "—"} sub={f.settledCount > 0 ? `${f.settledCount} settled with payments` : "no settled history"} delay={3} />
          <StatCard label="Oldest Open" value={f.oldestOpen ? `${f.oldestOpenDays}d` : "—"} sub={f.oldestOpen ? f.oldestOpen.person : "all settled"} delay={4} />
          <StatCard label={L.pay} value={String(f.payments.length)} sub={f.lastPayment ? `last ${fmtDay(f.lastPayment.date)}` : "none yet"} delay={5} />
        </div>
      </div>

      {/* Highlights */}
      {(f.nextDue || f.largest || f.lastPayment) && (
        <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {f.nextDue && (
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">Next Deadline</p>
                <p className="font-semibold text-black dark:text-white truncate">{f.nextDue.person}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDay(f.nextDue.deadline!)}</p>
              </div>
              <span className={`font-display text-lg font-bold tracking-tight shrink-0 ${L.accent}`}>{money(f.nextDueAmount)}</span>
            </div>
          )}
          {f.largest && (
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">Largest {L.item}</p>
                <p className="font-semibold text-black dark:text-white truncate">{f.largest.person}</p>
                {f.largest.date && <p className="text-xs text-gray-400 mt-0.5">{fmtDay(f.largest.date)}</p>}
              </div>
              <span className="font-display text-lg font-bold tracking-tight shrink-0 text-black dark:text-white">{money(Number(f.largest.amount))}</span>
            </div>
          )}
          {f.lastPayment && (
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">Latest Payment</p>
                <p className="font-semibold text-black dark:text-white truncate">{f.lastPayment.person}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDay(f.lastPayment.date)}</p>
              </div>
              <span className="font-display text-lg font-bold tracking-tight shrink-0 text-black dark:text-white">{money(f.lastPayment.amount)}</span>
            </div>
          )}
        </div>
      )}

      {/* 6-month flow */}
      <div>
        <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">Last 6 Months</h2>
        <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm p-5 sm:p-6">
          <div className="flex items-center gap-4 mb-5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${L.outBar}`} />{L.out}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-volt-500 dark:bg-volt" />{L.back}</span>
          </div>
          <div className="flex items-stretch gap-2 sm:gap-3 h-44">
            {f.months.map((m, i) => (
              <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                <div className="flex-1 w-full flex items-end justify-center gap-1">
                  {[[m.out, L.outBar], [m.back, "bg-volt-500 dark:bg-volt"]].map(([v, cls], j) => (
                    <div key={j} title={money(v as number)} className={`flex-1 max-w-4 rounded-full transition-all duration-700 ease-out ${(v as number) > 0 ? cls : "bg-black/[0.06] dark:bg-white/[0.08]"}`}
                      style={{ height: `${f.monthMax > 0 ? Math.max(((v as number) / f.monthMax) * 100, (v as number) > 0 ? 5 : 2) : 2}%` }} />
                  ))}
                </div>
                <span className={`text-[0.6875rem] font-semibold ${i === f.months.length - 1 ? "text-black dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>{m.label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.05]">
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1">{L.out} · 6 mo</p>
              <p className="font-display text-base font-bold tracking-tight text-black dark:text-white">{money(f.months.reduce((s, m) => s + m.out, 0))}</p>
            </div>
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1">{L.back} · 6 mo</p>
              <p className="font-display text-base font-bold tracking-tight text-black dark:text-white">{money(f.months.reduce((s, m) => s + m.back, 0))}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Constants ───────────────────────────────────────────────────────

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const URGENCY_META = {
  critical: { label: "Critical", color: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400"       },
  high:     { label: "High",     color: "bg-orange-400", text: "text-orange-600 dark:text-orange-400" },
  medium:   { label: "Medium",   color: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
  low:      { label: "Low",      color: "bg-gray-400",   text: "text-gray-600 dark:text-gray-400"     },
}

// ─── Page ────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("todo")
  const [userId,    setUserId]    = useState<string | null>(null)
  const { currency } = useCurrency()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  // Todo
  const [todoLoading,     setTodoLoading]     = useState(true)
  const [periodStats,     setPeriodStats]     = useState<TodoPeriodStat[]>([])
  const [longestTodos,    setLongestTodos]    = useState<LongestTodo[]>([])
  const [fastestTodos,    setFastestTodos]    = useState<TimedTodo[]>([])
  const [longestCompleted, setLongestCompleted] = useState<TimedTodo[]>([])
  const [completionsByDay, setCompletionsByDay] = useState<{ date: string; count: number }[]>([])

  // Expenses
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expensesLoaded,  setExpensesLoaded]  = useState(false)
  const [expenses,        setExpenses]        = useState<Expense[]>([])
  const [expPeriod,       setExpPeriod]       = useState<ExpPeriod>("all")
  const [descRaw,         setDescRaw]         = useState("")
  const [descQuery,       setDescQuery]       = useState("")
  const [showAllDesc,     setShowAllDesc]     = useState(false)
  const [showAllCat,      setShowAllCat]      = useState(false)
  const [showAllDays,     setShowAllDays]     = useState(false)
  const [searchListPage,  setSearchListPage]  = useState(1)
  const SEARCH_PER_PAGE = 10

  // To-Buy
  const [toBuyLoading, setToBuyLoading] = useState(false)
  const [toBuyLoaded,  setToBuyLoaded]  = useState(false)
  const [toBuyItems,   setToBuyItems]   = useState<ToBuyItem[]>([])

  // Debts / Lending
  const [debtsLoading,   setDebtsLoading]   = useState(false)
  const [debtsLoaded,    setDebtsLoaded]    = useState(false)
  const [debts,          setDebts]          = useState<FinanceItem[]>([])
  const [lendingLoading, setLendingLoading] = useState(false)
  const [lendingLoaded,  setLendingLoaded]  = useState(false)
  const [lendings,       setLendings]       = useState<FinanceItem[]>([])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDescQuery(descRaw); setSearchListPage(1) }, 300)
    return () => clearTimeout(t)
  }, [descRaw])

  // Auth
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setTodoLoading(false); return }
      setUserId(user.id)
      await loadTodoData(user.id)
      setTodoLoading(false)
    })()
  }, [])

  // Lazy load per tab
  useEffect(() => {
    if (!userId) return
    if (activeTab === "expenses" && !expensesLoaded) loadExpensesData(userId)
    if (activeTab === "to-buy"   && !toBuyLoaded)   loadToBuyData(userId)
    if (activeTab === "debts"    && !debtsLoaded)   loadDebtsData(userId)
    if (activeTab === "lending"  && !lendingLoaded) loadLendingData(userId)
  }, [activeTab, userId])

  // ── Loaders ──────────────────────────────────────────────────────

  const loadTodoData = async (uid: string) => {
    const periods = [{ name: "Past Day", days: 1 }, { name: "Past 7 Days", days: 7 }, { name: "Past 30 Days", days: 30 }]
    const pStats: TodoPeriodStat[] = []
    for (const p of periods) {
      const start = new Date(); start.setDate(start.getDate() - p.days)
      const { data } = await supabase.from("todos").select("status_id").eq("user_id", uid).gte("created_at", start.toISOString())
      pStats.push({ period: p.name, created: data?.length ?? 0, inProgress: data?.filter(t => t.status_id === 2).length ?? 0, completed: data?.filter(t => t.status_id === 3).length ?? 0 })
    }
    setPeriodStats(pStats)

    const { data: running } = await supabase.from("todos").select("id, title, created_at, updated_at, status_id, todo_status!inner(name)").eq("user_id", uid).neq("status_id", 3).order("created_at", { ascending: true }).limit(3)
    if (running) setLongestTodos(running.map(t => { const diff = Math.abs(new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()); return { id: t.id, title: t.title, days: Math.ceil(diff / 86400000), status_name: (t.todo_status as any).name } }))

    const { data: completed } = await supabase.from("todos").select("id, title, created_at, updated_at").eq("user_id", uid).eq("status_id", 3).order("created_at", { ascending: true })
    if (completed) {
      const mapped = completed.map(t => { const diff = Math.abs(new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()); return { id: t.id, title: t.title, days: Math.floor(diff / 86400000), hours: Math.round(diff / 3600000 * 10) / 10 } })
      setLongestCompleted([...mapped].sort((a, b) => b.hours - a.hours).slice(0, 3))
      setFastestTodos([...mapped].sort((a, b) => a.hours - b.hours).slice(0, 3))
    }

    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6); sevenAgo.setHours(0, 0, 0, 0)
    const { data: recentDone } = await supabase.from("todos").select("updated_at").eq("user_id", uid).eq("status_id", 3).gte("updated_at", sevenAgo.toISOString())
    const cmap: Record<string, number> = {}
    for (const t of (recentDone ?? [])) { const d = t.updated_at.split("T")[0]; cmap[d] = (cmap[d] ?? 0) + 1 }
    setCompletionsByDay(Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = d.toISOString().split("T")[0]; return { date: k, count: cmap[k] ?? 0 } }))
  }

  const loadExpensesData = async (uid: string) => {
    setExpensesLoading(true)
    const { data } = await supabase.from("expenses").select("id, amount, description, category, date").eq("user_id", uid).order("date", { ascending: false })
    if (data) setExpenses(data)
    setExpensesLoaded(true); setExpensesLoading(false)
  }

  const loadToBuyData = async (uid: string) => {
    setToBuyLoading(true)
    const { data } = await supabase.from("to_buy_items").select("id, name, quantity, price, urgency, bought").eq("user_id", uid)
    if (data) setToBuyItems(data as ToBuyItem[])
    setToBuyLoaded(true); setToBuyLoading(false)
  }

  const loadDebtsData = async (uid: string) => {
    setDebtsLoading(true)
    const { data } = await supabase.from("debts").select("id, amount, amount_paid, date, deadline, person, paid_history").eq("user_id", uid)
    if (data) setDebts(data as FinanceItem[])
    setDebtsLoaded(true); setDebtsLoading(false)
  }

  const loadLendingData = async (uid: string) => {
    setLendingLoading(true)
    const { data } = await supabase.from("lendings").select("id, amount, amount_paid, date, deadline, person, paid_history").eq("user_id", uid)
    if (data) setLendings(data as FinanceItem[])
    setLendingLoaded(true); setLendingLoading(false)
  }

  // ── Computed ─────────────────────────────────────────────────────

  const periodStart = useMemo(() => {
    if (expPeriod === "7d")  { const d = new Date(); d.setDate(d.getDate() - 7);  return d.toISOString().split("T")[0] }
    if (expPeriod === "30d") { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0] }
    return null
  }, [expPeriod])

  const periodExpenses = useMemo(() =>
    periodStart ? expenses.filter(e => e.date >= periodStart) : expenses
  , [expenses, periodStart])

  const expStats = useMemo(() => {
    const list = periodExpenses
    if (list.length === 0) return null
    const today = new Date().toISOString().split("T")[0]
    const sum = (l: Expense[]) => l.reduce((s, e) => s + Number(e.amount), 0)
    const start = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0] }

    const allTotal   = sum(list)
    const allDays    = [...new Set(list.map(e => e.date))]
    const byDay: Record<string, number> = {}
    for (const exp of list) byDay[exp.date] = (byDay[exp.date] || 0) + Number(exp.amount)
    const sortedDays = Object.entries(byDay).sort((a, b) => b[1] - a[1])

    const catTotals: Record<string, { total: number; count: number }> = {}
    for (const exp of list) {
      if (!catTotals[exp.category]) catTotals[exp.category] = { total: 0, count: 0 }
      catTotals[exp.category].total += Number(exp.amount)
      catTotals[exp.category].count++
    }
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1].total - a[1].total)

    // Transaction size
    const amounts  = list.map(e => Number(e.amount)).sort((a, b) => a - b)
    const mid      = Math.floor(amounts.length / 2)
    const avgTx    = allTotal / list.length
    const medianTx = amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2

    // Calendar coverage + streaks
    const todayKey  = ymd(new Date())
    const ascDays   = [...allDays].sort()
    const calendarSpan = expPeriod === "7d" ? 7 : expPeriod === "30d" ? 30
      : Math.max(1, Math.round((parseDay(todayKey).getTime() - parseDay(ascDays[0]).getTime()) / DAY_MS) + 1)
    let longestStreak = 0, run = 0
    for (let i = 0; i < ascDays.length; i++) {
      run = i > 0 && Math.round((parseDay(ascDays[i]).getTime() - parseDay(ascDays[i - 1]).getTime()) / DAY_MS) === 1 ? run + 1 : 1
      longestStreak = Math.max(longestStreak, run)
    }
    const daySet = new Set(allDays)
    let currentStreak = 0
    const cursor = parseDay(todayKey)
    if (!daySet.has(todayKey)) cursor.setDate(cursor.getDate() - 1)
    while (daySet.has(ymd(cursor))) { currentStreak++; cursor.setDate(cursor.getDate() - 1) }

    // Weekday pattern (Mon → Sun)
    const weekdays = WEEKDAYS.map(label => ({ label, value: 0 }))
    for (const exp of list) weekdays[(parseDay(exp.date).getDay() + 6) % 7].value += Number(exp.amount)
    const weekdayMax = Math.max(...weekdays.map(w => w.value), 0)

    return {
      todayTotal:  sum(expenses.filter(e => e.date === today)),
      weekTotal:   sum(expenses.filter(e => e.date >= start(7))),
      monthTotal:  sum(expenses.filter(e => e.date >= start(30))),
      allTotal,
      allDays,
      avgDaily:    allDays.length > 0 ? allTotal / allDays.length : 0,
      avgCalendar: allTotal / Math.max(expPeriod === "7d" ? 7 : expPeriod === "30d" ? 30 : allDays.length, 1),
      sortedCats,
      maxCat:      sortedCats[0]?.[1].total ?? 1,
      biggest:     [...list].sort((a, b) => Number(b.amount) - Number(a.amount))[0],
      sortedDays,
      bigDay:      sortedDays[0]?.[0] ?? null,
      bigDayTotal: (sortedDays[0]?.[1] ?? 0) as number,
      avgTx,       medianTx,
      calendarSpan, noSpendDays: Math.max(0, calendarSpan - allDays.length),
      longestStreak, currentStreak,
      topCatShare: allTotal > 0 ? (sortedCats[0]?.[1].total ?? 0) / allTotal : 0,
      weekdays,
      topWeekday:  weekdayMax > 0 ? WEEKDAYS[weekdays.findIndex(w => w.value === weekdayMax)] : null,
    }
  }, [periodExpenses, expenses, expPeriod])

  // Last 6 months — always from all expenses
  const expMonthly = useMemo(() => {
    if (expenses.length === 0) return null
    const now = new Date()
    const months = lastMonths(6).map((m, i, arr) => ({ ...m, value: 0, current: i === arr.length - 1 }))
    const idx = new Map(months.map((m, i) => [m.key, i]))
    for (const e of expenses) { const k = idx.get(e.date.slice(0, 7)); if (k !== undefined) months[k].value += Number(e.amount) }
    const thisMonth = months[5].value
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const lastSamePoint = expenses
      .filter(e => e.date.slice(0, 7) === months[4].key && Number(e.date.slice(8, 10)) <= dayOfMonth)
      .reduce((s, e) => s + Number(e.amount), 0)
    return {
      months,
      thisMonth,
      projected: (thisMonth / dayOfMonth) * daysInMonth,
      change:    lastSamePoint > 0 ? ((thisMonth - lastSamePoint) / lastSamePoint) * 100 : null,
      avg:       months.reduce((s, m) => s + m.value, 0) / months.length,
    }
  }, [expenses])

  // Description search aggregate — always searches ALL time
  const descAggregate = useMemo(() => {
    const q = descQuery.trim().toLowerCase()
    if (!q) return null
    const matches = expenses
      .filter(e => (e.description?.toLowerCase().includes(q)) || e.category.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (matches.length === 0) return null
    const amounts = matches.map(e => Number(e.amount))
    const total   = amounts.reduce((s, a) => s + a, 0)
    const catBrk: Record<string, number> = {}
    for (const m of matches) catBrk[m.category] = (catBrk[m.category] ?? 0) + Number(m.amount)
    return {
      matches,
      count:     matches.length,
      total,
      avg:       total / matches.length,
      min:       Math.min(...amounts),
      max:       Math.max(...amounts),
      firstDate: matches[matches.length - 1]?.date ?? "",
      lastDate:  matches[0]?.date ?? "",
      catBreakdown: Object.entries(catBrk).sort((a, b) => b[1] - a[1]),
    }
  }, [expenses, descQuery])

  // Description ranking — from filtered period
  const descRanking = useMemo(() => {
    const map = new Map<string, { display: string; total: number; count: number; category: string }>()
    for (const exp of periodExpenses) {
      const key     = (exp.description?.trim() || "").toLowerCase() || exp.category.toLowerCase()
      const display = exp.description?.trim() || exp.category
      const existing = map.get(key)
      if (existing) { existing.total += Number(exp.amount); existing.count++ }
      else map.set(key, { display, total: Number(exp.amount), count: 1, category: exp.category })
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [periodExpenses])

  const financeStats = (items: FinanceItem[]) => {
    const gs = (i: FinanceItem) => Number(i.amount_paid) >= Number(i.amount) ? "paid" : Number(i.amount_paid) > 0 ? "partial" : "unpaid"
    const now = new Date()
    // Group by person
    const personMap = new Map<string, { total: number; outstanding: number; count: number }>()
    for (const i of items) {
      const k = (i.person || "Unknown").trim()
      const out = Math.max(0, Number(i.amount) - Number(i.amount_paid))
      const e = personMap.get(k)
      if (e) { e.total += Number(i.amount); e.outstanding += out; e.count++ }
      else personMap.set(k, { total: Number(i.amount), outstanding: out, count: 1 })
    }
    return {
      total:        items.length,
      paid:         items.filter(i => gs(i) === "paid").length,
      partial:      items.filter(i => gs(i) === "partial").length,
      unpaid:       items.filter(i => gs(i) === "unpaid").length,
      totalAmount:  items.reduce((s, i) => s + Number(i.amount), 0),
      totalPaid:    items.reduce((s, i) => s + Number(i.amount_paid), 0),
      outstanding:  items.filter(i => gs(i) !== "paid").reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0),
      overdue:      items.filter(i => i.deadline && new Date(i.deadline + "T00:00:00") < now && gs(i) !== "paid").length,
      personRanking: [...personMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.outstanding - a.outstanding),
    }
  }

  const toBuyStats = useMemo(() => {
    const pending = toBuyItems.filter(i => !i.bought)
    const bought  = toBuyItems.filter(i =>  i.bought)
    const pendingTotal = pending.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)
    const uc: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const item of pending) uc[item.urgency] = (uc[item.urgency] || 0) + 1
    const expensive = [...pending].sort((a, b) => (Number(b.price) * Number(b.quantity)) - (Number(a.price) * Number(a.quantity))).slice(0, 5)
    return { pending, bought, pendingTotal, urgencyCounts: uc, maxCount: Math.max(...Object.values(uc), 1), expensive }
  }, [toBuyItems])

  // ── Helpers ──────────────────────────────────────────────────────

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const fmtShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  const PERIOD_LABELS: Record<ExpPeriod, string> = { all: "All Time", "30d": "30 Days", "7d": "7 Days" }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
      <div className="animate-slide-in-down">

        {/* Header */}
        <div className="flex items-center gap-4 mb-7">
          <div className="w-12 h-12 bg-black dark:bg-volt rounded-2xl flex items-center justify-center shrink-0 -rotate-3 shadow-lg shadow-black/15 dark:shadow-volt/20">
            <svg className="w-6 h-6 text-volt dark:text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-1.5">Insights</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-none text-black dark:text-white">Statistics</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-full p-1 mb-8 overflow-x-auto scrollbar-hide">
          {([["todo", "Todo"], ["expenses", "Expenses"], ["to-buy", "To Buy"], ["debts", "Debts"], ["lending", "Lending"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`shrink-0 flex-1 px-4 h-10 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-150 ${activeTab === t ? "bg-black dark:bg-volt text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Todo Tab ─────────────────────────────────────────────── */}
        {activeTab === "todo" && (
          todoLoading ? <SectionSkeleton /> : (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-black dark:text-white mb-3 px-1">Activity</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {periodStats.map((stat, i) => (
                    <div key={stat.period} className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm animate-slide-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-4">{stat.period}</h3>
                      <div className="space-y-2">
                        {[["Created", stat.created, "bg-sky-400", "text-sky-600 dark:text-sky-400"], ["In Progress", stat.inProgress, "bg-amber-400", "text-amber-600 dark:text-amber-400"], ["Completed", stat.completed, "bg-green-400", "text-emerald-600 dark:text-emerald-400"]].map(([label, val, dot, tc]) => (
                          <div key={label as string} className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${dot}`} /><span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span></div>
                            <span className={`font-bold ${tc}`}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {completionsByDay.length > 0 && <CompletionBarChart completions={completionsByDay} />}

              {[["Longest Running", longestTodos, "orange"] as const, ["Longest to Complete", longestCompleted, "purple"] as const, ["Fastest Completed", fastestTodos, "green"] as const].map(([title, list, color]) => (
                <div key={title}>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-black dark:text-white mb-3 px-1">{title}</h2>
                  <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm">
                    {list.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-6">No data yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {(list as any[]).map((todo, i) => (
                          <div key={todo.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.03] rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-black dark:text-white truncate">{todo.title}</p>
                              {todo.status_name && <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{todo.status_name}</p>}
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className={`text-lg font-bold text-${color}-600 dark:text-${color}-400`}>{todo.days > 0 ? todo.days : todo.hours}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{todo.days > 0 ? "days" : "hours"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Expenses Tab ─────────────────────────────────────────── */}
        {activeTab === "expenses" && (
          expensesLoading ? <SectionSkeleton /> :
          expensesLoaded && expenses.length === 0 ? (
            <div className="text-center py-16 sm:py-20"><p className="font-medium text-gray-500 dark:text-gray-400">No expense data yet.</p></div>
          ) : expensesLoaded ? (
            <div className="space-y-6">

              {/* Period filter */}
              <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-full p-1">
                {(["all", "30d", "7d"] as ExpPeriod[]).map(p => (
                  <button key={p} onClick={() => { setExpPeriod(p); setShowAllDesc(false); setShowAllCat(false); setShowAllDays(false) }}
                    className={`flex-1 h-9 rounded-full text-xs font-bold transition-all ${expPeriod === p ? "bg-black dark:bg-volt text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Description / reason search */}
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input type="text" value={descRaw} onChange={e => setDescRaw(e.target.value)} placeholder="Search description or category…"
                  className="w-full pl-11 pr-10 h-12 bg-white dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt transition-all text-sm" />
                {descRaw && (
                  <button onClick={() => { setDescRaw(""); setDescQuery("") }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                )}
              </div>

              {/* Search results */}
              {descQuery.trim() && (
                descAggregate ? (
                  <div className="space-y-4">

                    {/* Aggregate card */}
                    <div className="hero-card rounded-3xl p-6 shadow-xl">
                      <p className="text-xs font-semibold text-white/60 dark:text-black/60 mb-4">Results for &ldquo;{descQuery}&rdquo; — all time</p>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div>
                          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1.5">Total Spent</p>
                          <p className="font-display text-lg sm:text-xl font-extrabold tracking-tight leading-tight text-white dark:text-black break-words">{currency} {formatMoney(descAggregate.total)}</p>
                        </div>
                        <div>
                          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1.5">Occurrences</p>
                          <p className="font-display text-lg sm:text-xl font-extrabold tracking-tight leading-tight text-white dark:text-black break-words">{descAggregate.count}</p>
                        </div>
                        <div>
                          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1.5">Average</p>
                          <p className="font-display text-lg sm:text-xl font-extrabold tracking-tight leading-tight text-white dark:text-black break-words">{currency} {formatMoney(descAggregate.avg)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 border-t border-white/10 dark:border-black/10 pt-4">
                        <div>
                          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1.5">Min</p>
                          <p className="text-sm font-bold text-white dark:text-black">{currency} {formatMoney(descAggregate.min)}</p>
                        </div>
                        <div>
                          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1.5">Max</p>
                          <p className="text-sm font-bold text-white dark:text-black">{currency} {formatMoney(descAggregate.max)}</p>
                        </div>
                        <div>
                          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1.5">Since</p>
                          <p className="text-sm font-bold text-white dark:text-black">{fmtDate(descAggregate.firstDate)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Category breakdown for this search */}
                    {descAggregate.catBreakdown.length > 1 && (
                      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
                        <p className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em]">By Category</p>
                        {descAggregate.catBreakdown.map(([cat, tot]) => (
                          <RankBar key={cat} label={cat} labelRight={`${currency} ${formatMoney(tot)}`} value={tot} max={descAggregate.catBreakdown[0][1]} barClass={CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"]} />
                        ))}
                      </div>
                    )}

                    {/* Matching expense list */}
                    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between">
                        <p className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em]">Matching Expenses</p>
                        <span className="text-xs text-gray-400">{descAggregate.count} found</span>
                      </div>
                      <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        {descAggregate.matches.slice(0, searchListPage * SEARCH_PER_PAGE).map(exp => (
                          <div key={exp.id} className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-black dark:text-white truncate">{exp.description || "—"}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs font-semibold ${CATEGORY_TEXT[exp.category] || CATEGORY_TEXT["Other"]}`}>{exp.category}</span>
                                <span className="text-xs text-gray-400">{fmtShort(exp.date)}</span>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-black dark:text-white shrink-0">{currency} {formatMoney(Number(exp.amount))}</span>
                          </div>
                        ))}
                      </div>
                      {searchListPage * SEARCH_PER_PAGE < descAggregate.count && (
                        <button onClick={() => setSearchListPage(p => p + 1)}
                          className="w-full py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.05] transition-colors">
                          Show more ({descAggregate.count - searchListPage * SEARCH_PER_PAGE} remaining)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl">
                    <p className="text-gray-500 dark:text-gray-400">No expenses match &ldquo;{descQuery}&rdquo;</p>
                  </div>
                )
              )}

              {/* Normal stats (hidden while searching) */}
              {!descQuery.trim() && expStats && (
                <>
                  {/* Summary cards */}
                  <div>
                    <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">{PERIOD_LABELS[expPeriod]} — Summary</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {expPeriod === "all" ? (
                        <>
                          <StatCard label="Today"        value={`${currency} ${formatMoney(expStats.todayTotal)}`} delay={0} />
                          <StatCard label="Past 7 Days"  value={`${currency} ${formatMoney(expStats.weekTotal)}`}  delay={1} />
                          <StatCard label="Past 30 Days" value={`${currency} ${formatMoney(expStats.monthTotal)}`} delay={2} />
                          <StatCard label="All Time"     value={`${currency} ${formatMoney(expStats.allTotal)}`}   sub={`${expStats.allDays.length} days tracked`} delay={3} />
                        </>
                      ) : (
                        <>
                          <StatCard label="Total Spent"      value={`${currency} ${formatMoney(expStats.allTotal)}`}       sub={`${expStats.allDays.length} spending days`} delay={0} />
                          <StatCard label="Avg / Spend Day"  value={`${currency} ${formatMoney(expStats.avgDaily)}`}       sub="Active days only" delay={1} />
                          <StatCard label="Avg / Calendar"   value={`${currency} ${formatMoney(expStats.avgCalendar)}`}    sub={`Per day in ${PERIOD_LABELS[expPeriod].toLowerCase()}`} delay={2} />
                          <StatCard label="Transactions"     value={String(periodExpenses.length)} sub="within period" delay={3} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Insights */}
                  <div>
                    <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">Insights</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      <StatCard label="Avg / Transaction" value={`${currency} ${formatMoney(expStats.avgTx)}`} sub={`median ${currency} ${formatMoney(expStats.medianTx)}`} delay={0} />
                      <StatCard label="No-Spend Days" value={String(expStats.noSpendDays)} sub={`of ${expStats.calendarSpan} days`} delay={1} />
                      <StatCard label="Longest Streak" value={`${expStats.longestStreak}d`} sub={expStats.currentStreak > 0 ? `current ${expStats.currentStreak}d` : "no active streak"} delay={2} />
                      <StatCard label="Top Category" value={`${Math.round(expStats.topCatShare * 100)}%`} sub={expStats.sortedCats[0]?.[0] ?? "—"} delay={3} />
                      <StatCard label="Tx / Active Day" value={(periodExpenses.length / Math.max(expStats.allDays.length, 1)).toFixed(1)} sub={`${periodExpenses.length} transactions`} delay={4} />
                      <StatCard label="Categories Used" value={String(expStats.sortedCats.length)} sub="in this period" delay={5} />
                    </div>
                  </div>

                  {/* Biggest / best day */}
                  {(expStats.biggest || expStats.bigDay) && (
                    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                      {expStats.biggest && (
                        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.05]">
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">Biggest Single Expense</p>
                            <p className="font-semibold text-black dark:text-white truncate">{expStats.biggest.description || expStats.biggest.category}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtShort(expStats.biggest.date)} · {expStats.biggest.category}</p>
                          </div>
                          <span className="text-lg font-bold text-black dark:text-white ml-4 shrink-0">{currency} {formatMoney(Number(expStats.biggest.amount))}</span>
                        </div>
                      )}
                      {expStats.bigDay && (
                        <div className="flex items-center justify-between px-5 py-4">
                          <div>
                            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">Busiest Day</p>
                            <p className="font-semibold text-black dark:text-white">{fmtShort(expStats.bigDay)}</p>
                          </div>
                          <span className="text-lg font-bold text-black dark:text-white ml-4 shrink-0">{currency} {formatMoney(expStats.bigDayTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Line chart */}
                  <SpendingLineChart expenses={expenses} currency={currency} />

                  {/* Monthly trend */}
                  {expMonthly && (
                    <div>
                      <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">Monthly Trend</h2>
                      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm p-5 sm:p-6">
                        <div className="grid grid-cols-3 gap-3 mb-6">
                          <div className="min-w-0">
                            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1">This month</p>
                            <p className="font-display text-base sm:text-lg font-bold tracking-tight text-black dark:text-white break-words">{currency} {formatMoney(expMonthly.thisMonth)}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1">Projected</p>
                            <p className="font-display text-base sm:text-lg font-bold tracking-tight text-black dark:text-white break-words">{currency} {formatMoney(expMonthly.projected)}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400 mb-1">vs last month</p>
                            {expMonthly.change === null ? (
                              <p className="font-display text-base sm:text-lg font-bold text-gray-400">—</p>
                            ) : (
                              <p className={`font-display text-base sm:text-lg font-bold tracking-tight ${expMonthly.change > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {expMonthly.change > 0 ? "▲" : "▼"} {Math.abs(Math.round(expMonthly.change))}%
                              </p>
                            )}
                          </div>
                        </div>
                        <ColumnChart data={expMonthly.months} format={fmtCompact} />
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-4 text-center">
                          6-month avg {currency} {formatMoney(expMonthly.avg)} · compared to same point last month
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Weekday pattern */}
                  <div>
                    <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Weekday</h2>
                    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm p-5 sm:p-6">
                      <ColumnChart data={expStats.weekdays} format={fmtCompact} />
                      {expStats.topWeekday && (
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-4 text-center">
                          You spend most on <span className="font-bold text-black dark:text-white">{expStats.topWeekday}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* By Category */}
                  {expStats.sortedCats.length > 0 && (
                    <div>
                      <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Category</h2>
                      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                        {(showAllCat ? expStats.sortedCats : expStats.sortedCats.slice(0, 6)).map(([cat, { total, count }]) => (
                          <RankBar
                            key={cat}
                            label={cat}
                            labelRight={`${currency} ${formatMoney(total)}`}
                            value={total}
                            max={expStats.maxCat}
                            barClass={CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"]}
                            sub={`${count} tx · ${Math.round((total / expStats.allTotal) * 100)}%`}
                          />
                        ))}
                        {expStats.sortedCats.length > 6 && (
                          <button onClick={() => setShowAllCat(v => !v)} className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                            {showAllCat ? "Show less" : `Show ${expStats.sortedCats.length - 6} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* By Description / Reason */}
                  {descRanking.length > 0 && (
                    <div>
                      <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Description / Reason</h2>
                      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                        {(showAllDesc ? descRanking : descRanking.slice(0, 8)).map((item, idx) => (
                          <RankBar
                            key={item.display + idx}
                            label={item.display}
                            labelRight={`${currency} ${formatMoney(item.total)}`}
                            value={item.total}
                            max={descRanking[0].total}
                            barClass={CATEGORY_COLORS[item.category] || CATEGORY_COLORS["Other"]}
                            sub={`${item.count}×`}
                          />
                        ))}
                        {descRanking.length > 8 && (
                          <button onClick={() => setShowAllDesc(v => !v)} className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                            {showAllDesc ? "Show less" : `Show ${descRanking.length - 8} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Top spending days */}
                  {expStats.sortedDays.length > 0 && (
                    <div>
                      <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">Top Spending Days</h2>
                      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                        <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                          {(showAllDays ? expStats.sortedDays : expStats.sortedDays.slice(0, 5)).map(([day, total], idx) => {
                            const dayExps = periodExpenses.filter(e => e.date === day)
                            return (
                              <div key={day} className="flex items-center justify-between px-4 py-3 gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-black dark:text-white">{fmtShort(day)}</p>
                                  <p className="text-xs text-gray-400">{dayExps.length} expense{dayExps.length !== 1 ? "s" : ""}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-black dark:text-white">{currency} {formatMoney(total as number)}</p>
                                  {idx === 0 && <p className="text-xs text-orange-500">highest</p>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {expStats.sortedDays.length > 5 && (
                          <button onClick={() => setShowAllDays(v => !v)}
                            className="w-full py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.05] transition-colors">
                            {showAllDays ? "Show less" : `Show ${expStats.sortedDays.length - 5} more days`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null
        )}

        {/* ── To-Buy Tab ───────────────────────────────────────────── */}
        {activeTab === "to-buy" && (
          toBuyLoading ? <SectionSkeleton /> :
          toBuyLoaded && toBuyItems.length === 0 ? (
            <div className="text-center py-16 sm:py-20"><p className="text-gray-500 dark:text-gray-400">No items yet.</p></div>
          ) : toBuyLoaded ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Pending"       value={String(toBuyStats.pending.length)} sub="items to buy"    delay={0} />
                <StatCard label="Bought"        value={String(toBuyStats.bought.length)}  sub="completed"       delay={1} />
                <StatCard label="Pending Value" value={toBuyStats.pendingTotal > 0 ? `${currency} ${formatMoney(toBuyStats.pendingTotal)}` : "—"} sub="estimated" delay={2} />
                <StatCard label="Completion"    value={`${Math.round(toBuyStats.bought.length / Math.max(toBuyItems.length, 1) * 100)}%`} sub={`${toBuyItems.length} total items`} delay={3} />
              </div>

              {toBuyStats.pending.length > 0 && (
                <>
                  <div>
                    <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Urgency</h2>
                    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                      {(["critical", "high", "medium", "low"] as const).filter(u => toBuyStats.urgencyCounts[u] > 0).map((u, idx) => {
                        const count = toBuyStats.urgencyCounts[u]
                        return (
                          <RankBar key={u} label={URGENCY_META[u].label} labelRight={`${count} item${count !== 1 ? "s" : ""}`} value={count} max={toBuyStats.maxCount} barClass={URGENCY_META[u].color} />
                        )
                      })}
                    </div>
                  </div>

                  {toBuyStats.expensive.some(i => i.price > 0) && (
                    <div>
                      <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">Most Expensive Pending</h2>
                      <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                        <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                          {toBuyStats.expensive.filter(i => i.price > 0).map((item, i) => (
                            <div key={item.id} className="flex items-center justify-between px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-black dark:text-white truncate">{item.name}</p>
                                <p className={`text-xs ${URGENCY_META[item.urgency].text}`}>{URGENCY_META[item.urgency].label} · qty {item.quantity}</p>
                              </div>
                              <span className="text-sm font-bold text-black dark:text-white shrink-0 ml-3">{currency} {formatMoney(Number(item.price) * Number(item.quantity))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null
        )}

        {/* ── Debts Tab ────────────────────────────────────────────── */}
        {activeTab === "debts" && (
          debtsLoading ? <SectionSkeleton /> :
          debtsLoaded && debts.length === 0 ? (
            <div className="text-center py-16 sm:py-20"><p className="font-medium text-gray-500 dark:text-gray-400">No debts recorded yet.</p></div>
          ) : debtsLoaded ? (() => {
            const s = financeStats(debts)
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Total Debts"  value={String(s.total)}                                sub={`${s.paid} paid off`}        delay={0} />
                  <StatCard label="Total Owed"   value={`${currency} ${formatMoney(s.totalAmount)}`}   sub="all time"                    delay={1} />
                  <StatCard label="Total Paid"   value={`${currency} ${formatMoney(s.totalPaid)}`}     sub="amount repaid"               delay={2} />
                  <StatCard label="Outstanding"  value={`${currency} ${formatMoney(s.outstanding)}`}   sub={s.overdue > 0 ? `${s.overdue} overdue` : "remaining"} accent={s.outstanding > 0 ? "text-rose-600 dark:text-rose-400" : undefined} delay={3} />
                </div>

                <FinanceInsights items={debts} currency={currency} kind="debt" />

                <div>
                  <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Status</h2>
                  <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                    {([["Unpaid", s.unpaid, "bg-rose-500", "text-rose-600 dark:text-rose-400"], ["Partial", s.partial, "bg-amber-400", "text-amber-600 dark:text-amber-400"], ["Paid", s.paid, "bg-emerald-500", "text-emerald-600 dark:text-emerald-400"]] as [string, number, string, string][]).map(([label, count, bar, text], idx, arr) => (
                      <div key={label} className={`px-5 py-4 ${idx < arr.length - 1 ? "border-b border-black/[0.05] dark:border-white/[0.05]" : ""}`}>
                        <RankBar label={label} labelRight={`${count} item${count !== 1 ? "s" : ""}`} value={count} max={Math.max(s.total, 1)} barClass={bar} />
                      </div>
                    ))}
                  </div>
                </div>

                {s.personRanking.length > 0 && (
                  <div>
                    <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Person (Outstanding)</h2>
                    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                      <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        {s.personRanking.filter(p => p.outstanding > 0).map(p => (
                          <div key={p.name} className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="w-8 h-8 rounded-full bg-black dark:bg-volt flex items-center justify-center shrink-0">
                              <span className="text-white dark:text-black font-bold text-sm leading-none">{p.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-black dark:text-white truncate">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.count} debt{p.count !== 1 ? "s" : ""} · total {currency} {formatMoney(p.total)}</p>
                            </div>
                            <span className="font-display text-sm sm:text-base font-bold tracking-tight text-rose-600 dark:text-rose-400 shrink-0">{currency} {formatMoney(p.outstanding)}</span>
                          </div>
                        ))}
                        {s.personRanking.filter(p => p.outstanding === 0).map(p => (
                          <div key={p.name} className="flex items-center justify-between px-4 py-3 gap-3 opacity-50">
                            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center shrink-0">
                              <span className="text-white font-bold text-sm leading-none">{p.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-black dark:text-white truncate">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.count} debt{p.count !== 1 ? "s" : ""}</p>
                            </div>
                            <span className="text-[0.6875rem] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-400/10 px-2.5 py-1 rounded-full">Settled</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })() : null
        )}

        {/* ── Lending Tab ──────────────────────────────────────────── */}
        {activeTab === "lending" && (
          lendingLoading ? <SectionSkeleton /> :
          lendingLoaded && lendings.length === 0 ? (
            <div className="text-center py-16 sm:py-20"><p className="font-medium text-gray-500 dark:text-gray-400">No lendings recorded yet.</p></div>
          ) : lendingLoaded ? (() => {
            const s = financeStats(lendings)
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Total Lendings" value={String(s.total)}                               sub={`${s.paid} returned fully`}  delay={0} />
                  <StatCard label="Total Lent"      value={`${currency} ${formatMoney(s.totalAmount)}`}  sub="all time"                    delay={1} />
                  <StatCard label="Total Received"  value={`${currency} ${formatMoney(s.totalPaid)}`}    sub="amount returned"             delay={2} />
                  <StatCard label="Outstanding"     value={`${currency} ${formatMoney(s.outstanding)}`}  sub={s.overdue > 0 ? `${s.overdue} overdue` : "remaining"} accent={s.outstanding > 0 ? "text-emerald-600 dark:text-emerald-400" : undefined} delay={3} />
                </div>

                <FinanceInsights items={lendings} currency={currency} kind="lending" />

                <div>
                  <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Status</h2>
                  <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                    {([["Not Returned", s.unpaid, "bg-sky-400", "text-sky-600 dark:text-sky-400"], ["Partial", s.partial, "bg-amber-400", "text-amber-600 dark:text-amber-400"], ["Returned", s.paid, "bg-emerald-500", "text-emerald-600 dark:text-emerald-400"]] as [string, number, string, string][]).map(([label, count, bar, text], idx, arr) => (
                      <div key={label} className={`px-5 py-4 ${idx < arr.length - 1 ? "border-b border-black/[0.05] dark:border-white/[0.05]" : ""}`}>
                        <RankBar label={label} labelRight={`${count} item${count !== 1 ? "s" : ""}`} value={count} max={Math.max(s.total, 1)} barClass={bar} />
                      </div>
                    ))}
                  </div>
                </div>

                {s.personRanking.length > 0 && (
                  <div>
                    <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1">By Person (Outstanding)</h2>
                    <div className="bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
                      <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                        {s.personRanking.filter(p => p.outstanding > 0).map(p => (
                          <div key={p.name} className="flex items-center justify-between px-4 py-3 gap-3">
                            <div className="w-8 h-8 rounded-full bg-black dark:bg-volt flex items-center justify-center shrink-0">
                              <span className="text-white dark:text-black font-bold text-sm leading-none">{p.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-black dark:text-white truncate">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.count} lending{p.count !== 1 ? "s" : ""} · total {currency} {formatMoney(p.total)}</p>
                            </div>
                            <span className="font-display text-sm sm:text-base font-bold tracking-tight text-emerald-600 dark:text-emerald-400 shrink-0">{currency} {formatMoney(p.outstanding)}</span>
                          </div>
                        ))}
                        {s.personRanking.filter(p => p.outstanding === 0).map(p => (
                          <div key={p.name} className="flex items-center justify-between px-4 py-3 gap-3 opacity-50">
                            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center shrink-0">
                              <span className="text-white font-bold text-sm leading-none">{p.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-black dark:text-white truncate">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.count} lending{p.count !== 1 ? "s" : ""}</p>
                            </div>
                            <span className="text-[0.6875rem] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-400/10 px-2.5 py-1 rounded-full">Returned</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })() : null
        )}

      </div>
    </div>
  )
}
