"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { PERIODS, type PeriodKey, type Insight, type Delta, type Tone } from "@/lib/analytics"

// Shared building blocks for the Stats tabs.
//
// Chart colors (validated for CVD separation on both the white and black
// card surfaces): money in = emerald-600, money out = rose-500. Everything
// that isn't a data mark uses text tokens, never a series color.

export const IN_BAR  = "bg-emerald-600"
export const OUT_BAR = "bg-rose-500"
export const DIM_BAR = "bg-gray-300 dark:bg-gray-600"

export const CARD = "bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm"

export const compact = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`
  return `${s}${Math.round(a)}`
}

const TONE_TEXT: Record<Tone | "neutral", string> = {
  good:    "text-emerald-700 dark:text-emerald-400",
  bad:     "text-rose-600 dark:text-rose-400",
  warn:    "text-amber-700 dark:text-amber-400",
  info:    "text-gray-500 dark:text-gray-400",
  neutral: "text-gray-500 dark:text-gray-400",
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 px-1">
      <h2 className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em]">{children}</h2>
      {action}
    </div>
  )
}

export function PeriodPicker({ value, onChange }: { value: PeriodKey; onChange: (p: PeriodKey) => void }) {
  return (
    // Two rows of three on phones so every option stays visible; one row from sm up
    <div role="radiogroup" aria-label="Period" className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-[1.25rem] sm:rounded-full p-1">
      {PERIODS.map(p => (
        <button key={p.key} role="radio" aria-checked={value === p.key} onClick={() => onChange(p.key)}
          className={`h-9 px-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 ${value === p.key ? "bg-black dark:bg-volt text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

/** The one number a tab leads with */
export function Hero({ label, value, valueTone, delta, children }: {
  label: string; value: string; valueTone?: "bad"; delta?: Delta; children?: ReactNode
}) {
  return (
    <div className="hero-card rounded-3xl p-6 shadow-xl" data-stat={label}>
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/60 dark:text-black/60 mb-2">{label}</p>
      <p data-value className={`font-sans text-5xl font-extrabold tracking-tight leading-none ${valueTone === "bad" ? "text-rose-400 dark:text-rose-700" : "text-white dark:text-black"}`}>{value}</p>
      {delta && (
        <p className={`text-xs font-bold mt-2 ${delta.tone === "good" ? "text-volt dark:text-emerald-800" : delta.tone === "bad" ? "text-rose-400 dark:text-rose-700" : "text-white/60 dark:text-black/60"}`}>{delta.text}</p>
      )}
      {children}
    </div>
  )
}

export function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0" data-stat={label}>
      <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1">{label}</p>
      <p data-value className="font-sans text-base sm:text-lg font-extrabold tracking-tight leading-tight text-white dark:text-black break-words">{value}</p>
    </div>
  )
}

export function StatTile({ label, value, sub, delta, href }: {
  label: string; value: string; sub?: string; delta?: Delta; href?: string
}) {
  const body = (
    <>
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <p data-value className="font-sans text-xl sm:text-2xl font-extrabold tracking-tight leading-tight break-words text-black dark:text-white">{value}</p>
      {delta && <p data-delta className={`text-xs font-bold mt-1.5 ${TONE_TEXT[delta.tone]}`}>{delta.text}</p>}
      {sub && <p data-sub className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </>
  )
  const cls = `${CARD} p-4 sm:p-5 block`
  return href
    ? <Link href={href} data-stat={label} className={`${cls} hover:border-black/15 dark:hover:border-white/15 transition-colors`}>{body}</Link>
    : <div data-stat={label} className={cls}>{body}</div>
}

const TONE_ICON: Record<Tone, { label: string; path: string }> = {
  bad:  { label: "Alert",   path: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" },
  warn: { label: "Heads up", path: "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" },
  good: { label: "Nice",    path: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" },
  info: { label: "Tip",     path: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" },
}

/** Up to three plain-language insights; each carries an icon + label, never color alone */
export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <div className={`${CARD} divide-y divide-black/[0.05] dark:divide-white/[0.05] overflow-hidden`}>
      {insights.map((ins, i) => {
        const icon = TONE_ICON[ins.tone]
        const body = (
          <>
            <svg className={`w-5 h-5 shrink-0 mt-px ${TONE_TEXT[ins.tone]}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden><path fillRule="evenodd" d={icon.path} clipRule="evenodd" /></svg>
            <p className="flex-1 text-sm text-black dark:text-white">
              <span className={`font-bold ${TONE_TEXT[ins.tone]}`}>{icon.label}: </span>{ins.text}
            </p>
            {ins.href && <svg className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>}
          </>
        )
        return ins.href
          ? <Link key={i} href={ins.href} className="flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">{body}</Link>
          : <div key={i} className="flex items-start gap-3 px-4 sm:px-5 py-3.5">{body}</div>
      })}
    </div>
  )
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${CARD} p-8 text-center`}>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-xs mx-auto">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Ask the quick-add menu to open a form (see QuickAddFAB) */
export function QuickAddButton({ type, children }: { type: string; children: ReactNode }) {
  return (
    <button onClick={() => window.dispatchEvent(new CustomEvent("quick-add", { detail: { type } }))}
      className="h-10 px-5 rounded-full text-sm font-bold bg-black dark:bg-volt text-white dark:text-black hover:opacity-90 transition-opacity">
      {children}
    </button>
  )
}

// ─── Column chart ────────────────────────────────────────────────────

interface Series { name: string; bar: string }

// Round the axis top up to a clean number whose half is also clean (0 / 15K / 30K)
const niceMax = (v: number) => {
  if (v <= 0) return 2
  if (v <= 10) return Math.ceil(v / 2) * 2   // small counts: even top so the midline is a whole number
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p
  return ([1, 2, 3, 4, 5, 6, 8, 10].find(s => n <= s) ?? 10) * p
}

/**
 * Columns for 1–2 series over time. Each column slot is the hover/focus target
 * (bigger than the marks), with one tooltip listing every series. A table view
 * carries the same values without hovering.
 */
export function ColumnChart({ title, series, data, format, height = 176 }: {
  title: string
  series: Series[]
  data: { label: string; values: number[]; dim?: boolean; note?: string }[]
  format: (v: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const max = niceMax(Math.max(0, ...data.flatMap(d => d.values)))
  const ticks = [max, max / 2, 0]
  // Dense charts label every few columns (always the last) so labels never truncate
  const labelEvery = Math.ceil(data.length / 7)
  const showLabel = (i: number) => i === data.length - 1 || (data.length - 1 - i) % labelEvery === 0

  return (
    <div className={`${CARD} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          {series.length > 1
            ? series.map(s => <span key={s.name} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-[3px] ${s.bar}`} aria-hidden />{s.name}</span>)
            : <span>{title}</span>}
        </div>
        <button onClick={() => setTable(t => !t)} aria-pressed={table}
          className="h-8 px-3 shrink-0 rounded-full text-xs font-bold bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">
          {table ? "Chart" : "Table"}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[0.6875rem] uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                <th className="font-bold py-2 px-1">{title}</th>
                {series.map(s => <th key={s.name} className="font-bold py-2 px-1 text-right">{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {data.map((d, i) => (
                <tr key={i} className={d.dim ? "text-gray-400 dark:text-gray-500" : "text-black dark:text-white"}>
                  <td className="py-2 px-1 font-semibold">{d.label}</td>
                  {d.values.map((v, j) => <td key={j} className="py-2 px-1 text-right">{format(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2" role="group" aria-label={title}>
          {/* Y axis */}
          <div className="flex flex-col justify-between text-[0.625rem] font-semibold tabular-nums text-gray-400 dark:text-gray-500 text-right shrink-0 pb-6" style={{ height }}>
            {ticks.map(t => <span key={t} className="leading-none -translate-y-1/2 first:translate-y-0 last:translate-y-0">{compact(t)}</span>)}
          </div>
          <div className="relative flex-1 min-w-0">
            {/* Hairline gridlines */}
            <div className="absolute inset-x-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height: height - 24 }} aria-hidden>
              {ticks.map(t => <div key={t} className="h-px bg-black/[0.06] dark:bg-white/[0.08]" />)}
            </div>
            <div className="relative flex" style={{ height }}>
              {data.map((d, i) => (
                <button key={i} type="button"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${d.label}: ${series.map((s, j) => `${s.name} ${format(d.values[j])}`).join(", ")}`}
                  className={`group flex-1 min-w-0 flex flex-col items-center focus:outline-none rounded-lg ${hover === i ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""}`}>
                  <div className={`flex-1 w-full flex items-end justify-center gap-[2px] px-0.5 ${d.dim ? "opacity-40" : ""}`}>
                    {d.values.map((v, j) => (
                      <div key={j} className={`w-full max-w-[24px] rounded-t-[4px] transition-[height] duration-500 ${series[j].bar}`}
                        style={{ height: v > 0 ? `${Math.max((v / max) * 100, 1.5)}%` : 0 }} />
                    ))}
                  </div>
                  <span className={`h-6 pt-1.5 text-[0.625rem] font-semibold leading-none whitespace-nowrap ${d.dim ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300"}`}>{showLabel(i) ? d.label : ""}</span>
                </button>
              ))}
            </div>
            {/* Tooltip: values lead, names follow, line keys */}
            {hover !== null && (
              <div className="absolute top-0 z-10 pointer-events-none whitespace-nowrap px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-black/[0.08] dark:border-white/[0.1] shadow-lg"
                style={{
                  left: `${((hover + 0.5) / data.length) * 100}%`,
                  transform: `translateX(${hover === 0 ? "-15%" : hover === data.length - 1 ? "-85%" : "-50%"})`,
                }}>
                <p className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 mb-1">{data[hover].label}</p>
                {series.map((s, j) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className={`w-3 h-[2px] rounded-full ${s.bar}`} aria-hidden />
                    <span className="font-bold tabular-nums text-black dark:text-white">{format(data[hover].values[j])}</span>
                    <span className="text-gray-500 dark:text-gray-400">{s.name}</span>
                  </div>
                ))}
                {data[hover].note && <p className="text-[0.6875rem] text-gray-500 dark:text-gray-400 mt-1">{data[hover].note}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Horizontal bar list ─────────────────────────────────────────────

/** Ranked magnitudes in one hue; the value is labeled at each bar's end */
export function BarList({ rows, bar, max }: {
  rows: { key: string; label: string; value: number; valueText: string; note?: ReactNode; href?: string }[]
  bar: string
  max?: number
}) {
  const top = max ?? Math.max(0, ...rows.map(r => r.value))
  return (
    <div className="space-y-3.5">
      {rows.map(r => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-sm font-semibold text-black dark:text-white truncate">{r.label}</span>
              <span className="shrink-0 text-right">
                <span className="text-sm font-bold text-black dark:text-white">{r.valueText}</span>
                {r.note && <span className="text-xs ml-2">{r.note}</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
              <div className={`h-full rounded-full transition-[width] duration-500 ${bar}`} style={{ width: `${top > 0 ? (r.value / top) * 100 : 0}%` }} />
            </div>
          </>
        )
        return r.href
          ? <Link key={r.key} href={r.href} className="block rounded-xl -mx-2 px-2 py-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">{inner}</Link>
          : <div key={r.key}>{inner}</div>
      })}
    </div>
  )
}

/** Change chip for a list row, colored by whether the move is good */
export function ChangeNote({ pct, upIsGood }: { pct: number | null; upIsGood: boolean }) {
  if (pct === null) return <span className="text-gray-400 dark:text-gray-500">new</span>
  const r = Math.round(pct)
  if (r === 0) return <span className="text-gray-400 dark:text-gray-500">±0%</span>
  return <span className={`font-semibold ${(r > 0) === upIsGood ? TONE_TEXT.good : TONE_TEXT.bad}`}>{r > 0 ? "▲" : "▼"}{Math.abs(r)}%</span>
}

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={CARD}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em]">{title}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-5">{children}</div>}
    </div>
  )
}
