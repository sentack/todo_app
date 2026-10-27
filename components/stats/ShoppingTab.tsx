"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useCurrency } from "@/contexts/CurrencyContext"
import { formatMoney } from "@/lib/formatMoney"
import { currentMonth, monthRange, effectiveLimits, spentByCategory } from "@/lib/budget"
import { fetchAll } from "@/lib/fetchAll"
import { dayKey } from "@/lib/dates"
import { type Period, type ToBuyRow, type Urgency, shoppingAnalytics, shoppingInsights, deltaOf, periodForData } from "@/lib/analytics"
import { CARD, SectionTitle, Hero, HeroStat, StatTile, InsightList, BarList, EmptyState, QuickAddButton } from "./ui"

const URGENCY: Record<Urgency, { label: string; dot: string }> = {
  critical: { label: "Critical", dot: "bg-rose-500" },
  high:     { label: "High",     dot: "bg-orange-400" },
  medium:   { label: "Medium",   dot: "bg-amber-400" },
  low:      { label: "Low",      dot: "bg-gray-400" },
}

const INK_BAR = "bg-gray-800 dark:bg-gray-300"

export default function ShoppingTab({ userId, period }: { userId: string; period: Period }) {
  const [items, setItems]           = useState<ToBuyRow[] | null>(null)
  const [budgetLeft, setBudgetLeft] = useState<number | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { currency } = useCurrency()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const cols = "id, name, quantity, price, urgency, bought, created_at"
      // Columns are a runtime string, so Supabase can't infer the row type — the cast supplies it
      const loadItems = (c: string) => fetchAll<ToBuyRow>((from, to) =>
        supabase.from("to_buy_items").select(c, { count: "exact" }).eq("user_id", userId).order("created_at").order("id").range(from, to) as never)
      const [start, end] = monthRange(currentMonth())
      const [firstTry, exp, def, ovr] = await Promise.all([
        loadItems(`${cols}, bought_at, expense_id`),
        fetchAll<{ amount: number; category: string }>((from, to) =>
          supabase.from("expenses").select("amount, category", { count: "exact" }).eq("user_id", userId)
            .gte("date", start).lt("date", end).order("date").order("id").range(from, to)),
        supabase.from("expense_budgets").select("category, monthly_limit").eq("user_id", userId),
        supabase.from("month_budgets").select("category, amount").eq("user_id", userId).eq("month", start),
      ])
      // bought_at / expense_id not migrated yet
      const itemsRes = firstTry.error ? await loadItems(cols) : firstTry
      if (cancelled) return

      const limits = effectiveLimits(def.data ?? [], ovr.data ?? [])
      const spent = spentByCategory(exp.data)
      const cats = Object.keys(limits)
      setBudgetLeft(cats.length ? cats.reduce((s, c) => s + limits[c] - (spent[c] ?? 0), 0) : null)
      setItems(itemsRes.data)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent).detail?.type
      if (t === "to-buy" || t === "expense") setRefreshKey(k => k + 1)
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, [])

  if (!items) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton rounded-3xl h-32" />)}</div>
  return <ShoppingView items={items} budgetLeft={budgetLeft} period={period} currency={currency} loading={loading} />
}

/** Renders the tab from loaded rows (no fetching — rendered directly in tests) */
export function ShoppingView({ items, budgetLeft, period: basePeriod, currency, loading = false }: {
  items: ToBuyRow[]; budgetLeft: number | null; period: Period; currency: string; loading?: boolean
}) {
  const money = (v: number) => `${currency} ${formatMoney(v)}`
  const period = useMemo(() => periodForData(basePeriod, items.map(i => dayKey(i.created_at))), [basePeriod, items])
  const a = useMemo(() => shoppingAnalytics(period, items), [items, period])
  const insights = useMemo(() => shoppingInsights(a, budgetLeft, money), [a, budgetLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) {
    return <EmptyState action={<QuickAddButton type="to-buy">Add an item</QuickAddButton>}>Your shopping list is empty. Add items to plan purchases against your budget.</EmptyState>
  }

  const afterList = budgetLeft !== null ? budgetLeft - a.pendingCost : null
  const noTimestamps = !a.hasTimestamps ? "available once purchase dates are tracked" : undefined

  return (
    <div className={`space-y-8 transition-opacity ${loading ? "opacity-60" : ""}`}>

      <Hero label="Your list costs" value={money(a.pendingCost)} valueTone={afterList !== null && afterList < 0 ? "bad" : undefined}>
        {afterList !== null && (
          <p className="text-xs font-semibold text-white/70 dark:text-black/70 mt-2">
            {money(Math.max(0, budgetLeft!))} left in this month&apos;s budget · {afterList < 0 ? `${money(-afterList)} short` : `${money(afterList)} to spare`} if you buy it all
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <HeroStat label="Pending" value={String(a.pendingCount)} />
          <HeroStat label="Urgent" value={String(a.urgentCount)} />
          <HeroStat label="Bought" value={a.hasTimestamps ? String(a.bought) : "—"} />
        </div>
      </Hero>

      <InsightList insights={insights} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile label="Urgent value" value={money(a.urgentCost)} sub={`${a.urgentCount} critical or high item${a.urgentCount === 1 ? "" : "s"}`} href="/to-buy" />
        <StatTile label="Bought" value={a.hasTimestamps ? String(a.bought) : "—"}
          delta={a.hasTimestamps ? deltaOf(a.bought, a.boughtPrev, true, period.compareLabel) : undefined}
          sub={noTimestamps ?? (a.boughtCost > 0 ? `${money(a.boughtCost)} estimated` : undefined)} />
        <StatTile label="Time to buy" value={a.avgDaysToBuy !== null ? `${a.avgDaysToBuy.toFixed(a.avgDaysToBuy < 10 ? 1 : 0)}d` : "—"} sub={noTimestamps ?? "average, added → bought"} />
        <StatTile label="Logged as expense" value={a.loggedRate !== null ? `${Math.round(a.loggedRate)}%` : "—"} sub={noTimestamps ?? "of priced items bought"} />
      </div>

      {a.pendingCount > 0 && (
        <div>
          <SectionTitle>Pending by urgency</SectionTitle>
          <div className={`${CARD} p-5 sm:p-6`}>
            <BarList bar={INK_BAR} rows={a.byUrgency.filter(u => u.count > 0).map(u => ({
              key: u.urgency,
              label: `${URGENCY[u.urgency].label} · ${u.count} item${u.count === 1 ? "" : "s"}`,
              value: u.cost, valueText: u.cost > 0 ? money(u.cost) : "no price",
              note: <span className={`inline-block w-2 h-2 rounded-full align-middle ${URGENCY[u.urgency].dot}`} aria-hidden />,
            }))} />
          </div>
        </div>
      )}

      {a.mostExpensive.some(i => i.cost > 0) && (
        <div>
          <SectionTitle action={<Link href="/to-buy" className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white">To Buy →</Link>}>Biggest pending items</SectionTitle>
          <div className={`${CARD} divide-y divide-black/[0.05] dark:divide-white/[0.05] overflow-hidden`}>
            {a.mostExpensive.filter(i => i.cost > 0).map(i => (
              <Link key={i.id} href="/to-buy" className="flex items-center gap-3 px-5 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${URGENCY[i.urgency].dot}`} aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-black dark:text-white truncate">{i.name}</span>
                  <span className="block text-[0.6875rem] text-gray-500 dark:text-gray-400">{URGENCY[i.urgency].label}</span>
                </span>
                <span className="text-sm font-bold text-black dark:text-white shrink-0">{money(i.cost)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
