"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { type PeriodKey, isPeriodKey, resolvePeriod } from "@/lib/analytics"
import { PeriodPicker } from "@/components/stats/ui"
import MoneyTab from "@/components/stats/MoneyTab"
import TodosTab from "@/components/stats/TodosTab"
import ShoppingTab from "@/components/stats/ShoppingTab"

type Tab = "money" | "todos" | "shopping"

const TABS: { key: Tab; label: string }[] = [
  { key: "money",    label: "Money" },
  { key: "todos",    label: "Todos" },
  { key: "shopping", label: "Shopping" },
]

// Old tab names still deep-link to the right place
const LEGACY_TABS: Record<string, Tab> = { expenses: "money", debts: "money", lending: "money", todo: "todos", "to-buy": "shopping" }

const toTab = (v: string | null): Tab =>
  TABS.some(t => t.key === v) ? v as Tab : (v && LEGACY_TABS[v]) || "money"

// useSearchParams needs a Suspense boundary for the static build
export default function StatsPageWrapper() {
  return <Suspense><StatsPage /></Suspense>
}

/** /stats?tab=money&period=3m — tab and period live in the URL so other pages can link here */
function StatsPage() {
  const params = useSearchParams()
  const router = useRouter()
  const tab = toTab(params.get("tab"))
  const periodParam = params.get("period")
  const periodKey: PeriodKey = isPeriodKey(periodParam) ? periodParam : "month"
  const period = useMemo(() => resolvePeriod(periodKey), [periodKey])

  const [userId, setUserId] = useState<string | null>(null)
  // Tabs stay mounted once opened, so switching back is instant
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]))
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [supabase])

  useEffect(() => {
    setVisited(v => v.has(tab) ? v : new Set(v).add(tab))
  }, [tab])

  const update = (next: { tab?: Tab; period?: PeriodKey }) => {
    const q = new URLSearchParams(params.toString())
    q.set("tab", next.tab ?? tab)
    q.set("period", next.period ?? periodKey)
    router.replace(`/stats?${q}`, { scroll: false })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
      <div className="animate-slide-in-down">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-black dark:bg-volt rounded-2xl flex items-center justify-center shrink-0 -rotate-3 shadow-lg shadow-black/15 dark:shadow-volt/20">
            <svg className="w-6 h-6 text-volt dark:text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-1.5">How you&apos;re doing</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-none text-black dark:text-white">Insights</h1>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Insights" className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-full p-1 mb-3">
          {TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => update({ tab: t.key })}
              className={`flex-1 h-10 rounded-full text-sm font-bold transition-all duration-150 ${tab === t.key ? "bg-black dark:bg-volt text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* One period for everything below — sticky under the app header */}
        <div className="sticky top-16 lg:top-[4.5rem] z-[40] -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-2 mb-5 chrome">
          <PeriodPicker value={periodKey} onChange={p => update({ period: p })} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
            <span className="font-semibold text-black dark:text-white">{period.label}</span> · changes shown {period.compareLabel}
          </p>
        </div>

        {!userId ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton rounded-3xl h-32" />)}</div>
        ) : (
          <>
            {visited.has("money")    && <div hidden={tab !== "money"}><MoneyTab userId={userId} period={period} /></div>}
            {visited.has("todos")    && <div hidden={tab !== "todos"}><TodosTab userId={userId} period={period} /></div>}
            {visited.has("shopping") && <div hidden={tab !== "shopping"}><ShoppingTab userId={userId} period={period} /></div>}
          </>
        )}
      </div>
    </div>
  )
}
