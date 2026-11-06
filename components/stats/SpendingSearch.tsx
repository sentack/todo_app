"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { CATEGORIES } from "@/lib/constants"
import { formatMoney } from "@/lib/formatMoney"
import { todayStr } from "@/lib/dates"
import { type Period, type ExpenseRow, searchExpenses, filterActive, deltaOf, fmtPct, daysBetween } from "@/lib/analytics"
import { CARD, OUT_BAR, SectionTitle, StatTile, ColumnChart, BarList } from "./ui"

const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
const PAGE = 10

/** Search expenses by reason/description (and category) and show stats for what matches */
export default function SpendingSearch({ expenses, period, currency, initialQuery = "", initialCategory = null }: {
  expenses: ExpenseRow[]; period: Period; currency: string
  initialQuery?: string; initialCategory?: string | null
}) {
  const [query, setQuery]       = useState(initialQuery)
  const [category, setCategory] = useState<string | null>(initialCategory)
  const [shown, setShown]       = useState(PAGE)
  const money = (v: number) => `${currency} ${formatMoney(v)}`

  const active = filterActive({ query, category })
  const r = useMemo(() => active ? searchExpenses(period, expenses, { query, category }) : null, [active, period, expenses, query, category])
  const clear = () => { setQuery(""); setCategory(null); setShown(PAGE) }
  const what = [query.trim() && `“${query.trim()}”`, category].filter(Boolean).join(" in ")

  return (
    <div>
      <SectionTitle action={active && (
        <button onClick={clear} className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white">Clear search</button>
      )}>Search spending</SectionTitle>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input type="search" value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }}
            placeholder="Search reasons, e.g. lunch, taxi…" aria-label="Search expense reasons"
            className="w-full pl-11 pr-10 h-12 bg-white dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-sm text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt transition-all text-sm [&::-webkit-search-cancel-button]:hidden" />
          {query && (
            <button onClick={() => { setQuery(""); setShown(PAGE) }} aria-label="Clear search text" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          )}
        </div>
        <select value={category ?? ""} onChange={e => { setCategory(e.target.value || null); setShown(PAGE) }} aria-label="Filter by category"
          className="sm:w-48 h-12 pl-4 pr-8 bg-white dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-sm text-sm font-semibold text-black dark:text-white focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 focus:border-black dark:focus:border-volt transition-all">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {r && (r.count === 0 ? (
        <div className={`${CARD} p-6 mt-3 text-center`}>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            No expenses match {what} in {period.key === "all" ? "your history" : period.label}.
            {r.elsewhere > 0 && ` ${r.elsewhere} match${r.elsewhere === 1 ? "" : "es"} in other periods — choose All time above.`}
          </p>
          <button onClick={clear} className="mt-4 h-10 px-5 rounded-full text-sm font-bold bg-black dark:bg-volt text-white dark:text-black">Clear search</button>
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {/* Summary */}
          <div className={`${CARD} p-5 sm:p-6`} data-stat="Search total">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">
              {what} · {period.key === "all" ? "all time" : period.label}
            </p>
            <p data-value className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-black dark:text-white">{money(r.total)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {r.count} expense{r.count === 1 ? "" : "s"}{r.share !== null && ` · ${fmtPct(r.share)} of your spending`}
            </p>
            {period.hasComparison && (() => {
              const d = deltaOf(r.total, r.prevTotal, false, period.compareLabel)
              const text = d?.text ?? (r.prevTotal === 0 ? "No matches in the period before" : null)
              return text && <p className={`text-xs font-bold mt-2 ${d?.tone === "bad" ? "text-rose-600 dark:text-rose-400" : d?.tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}>{text}</p>
            })()}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Average" value={money(r.avg)} sub={`typical ${money(r.median)}`} />
            <StatTile label="Range" value={r.min === r.max ? money(r.min) : `${formatMoney(r.min)} – ${formatMoney(r.max)}`} sub={r.min === r.max ? "every time" : `${currency}, smallest to largest`} />
            <StatTile label="How often" value={r.everyDays === null ? "Once" : `Every ${r.everyDays < 1.5 ? "day" : `${Math.round(r.everyDays)} days`}`}
              sub={r.first && r.last && r.first !== r.last ? `${fmtDay(r.first)} → ${fmtDay(r.last)}` : r.first ? fmtDay(r.first) : undefined} />
            <StatTile label="Last time" value={r.last ? fmtDay(r.last) : "—"}
              sub={r.last ? (() => { const n = daysBetween(r.last, todayStr()); return n <= 0 ? "today" : `${n} day${n === 1 ? "" : "s"} ago` })() : undefined} />
          </div>

          {r.byMonth.filter(m => m.total > 0).length >= 2 && (
            <ColumnChart title="By month" series={[{ name: "Spent", bar: OUT_BAR }]} height={140}
              data={r.byMonth.map(m => ({ label: m.label, values: [m.total] }))} format={money} />
          )}

          {r.byCategory.length >= 2 && (
            <div className={`${CARD} p-5 sm:p-6`}>
              <p className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3">By category</p>
              <BarList bar={OUT_BAR} rows={r.byCategory.map(c => ({
                key: c.category, label: c.category, value: c.total, valueText: money(c.total),
                href: `/expenses?category=${encodeURIComponent(c.category)}`,
              }))} />
            </div>
          )}

          {/* The matching expenses */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between">
              <p className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em]">Matching expenses</p>
              <Link href="/expenses" className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white">Expenses →</Link>
            </div>
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {r.matches.slice(0, shown).map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black dark:text-white truncate">{e.description || e.category}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{e.category} · {fmtDay(e.date)}</p>
                  </div>
                  <span className="text-sm font-bold text-black dark:text-white shrink-0 tabular-nums">{money(Number(e.amount))}</span>
                </li>
              ))}
            </ul>
            {shown < r.count && (
              <button onClick={() => setShown(n => n + PAGE)}
                className="w-full py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.05] transition-colors">
                Show more ({r.count - shown} left)
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
