"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useCurrency } from "@/contexts/CurrencyContext"
import { formatMoney } from "@/lib/formatMoney"
import { currentMonth, shiftMonth } from "@/lib/budget"
import {
  type Period, type MoneyInput, type Delta,
  moneyAnalytics, moneyInsights, deltaOf,
} from "@/lib/analytics"
import {
  CARD, IN_BAR, OUT_BAR, SectionTitle, Hero, HeroStat, StatTile, InsightList, ColumnChart,
  BarList, ChangeNote, Collapsible, EmptyState, QuickAddButton,
} from "./ui"

const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

export default function MoneyTab({ userId, period }: { userId: string; period: Period }) {
  const [data, setData]       = useState<MoneyInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAllCats, setShowAllCats] = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { currency } = useCurrency()
  const money = (v: number) => `${currency} ${formatMoney(v)}`
  const signed = (v: number) => `${v < 0 ? "−" : "+"}${money(Math.abs(v))}`

  // 24 months covers the longest period (12M) plus its comparison period
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const since = `${shiftMonth(currentMonth(), -23)}-01`
      const [exp, inc, def, ovr, pln, dbt, lnd] = await Promise.all([
        supabase.from("expenses").select("amount, category, date, description").eq("user_id", userId).gte("date", since),
        supabase.from("incomes").select("amount, source, date").eq("user_id", userId).gte("date", since),
        supabase.from("expense_budgets").select("category, monthly_limit").eq("user_id", userId),
        supabase.from("month_budgets").select("month, category, amount").eq("user_id", userId).gte("month", since),
        supabase.from("month_plans").select("month, expected_income").eq("user_id", userId).gte("month", since),
        supabase.from("debts").select("amount, amount_paid, date, deadline, person, paid_history").eq("user_id", userId),
        supabase.from("lendings").select("amount, amount_paid, date, deadline, person, paid_history").eq("user_id", userId),
      ])
      if (cancelled) return
      setData({
        expenses: exp.data ?? [], incomes: inc.data ?? [], defaults: def.data ?? [],
        overrides: ovr.data ?? [], plans: pln.data ?? [],
        debts: (dbt.data ?? []) as MoneyInput["debts"], lendings: (lnd.data ?? []) as MoneyInput["lendings"],
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent).detail?.type
      if (t === "expense" || t === "income" || t === "debt" || t === "lending") setRefreshKey(k => k + 1)
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, [])

  const a = useMemo(() => data ? moneyAnalytics(period, data) : null, [data, period])
  const insights = useMemo(() => a ? moneyInsights(a, period, money) : [], [a, period]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton rounded-3xl h-32" />)}</div>

  if (a.spent === 0 && a.earned === 0 && a.loans.owedToYou === 0 && a.loans.youOwe === 0) {
    return (
      <EmptyState action={<div className="flex gap-2 justify-center"><QuickAddButton type="expense">Add expense</QuickAddButton><QuickAddButton type="income">Add income</QuickAddButton></div>}>
        No money activity in {period.label.toLowerCase().startsWith("last") ? `the ${period.label.toLowerCase()}` : period.label}. Add an expense or income to start seeing insights.
      </EmptyState>
    )
  }

  const savingsDelta: Delta | undefined = a.savingsRate !== null && a.savingsRatePrev !== null
    ? (() => {
        const pts = Math.round(a.savingsRate - a.savingsRatePrev)
        return pts === 0
          ? { text: `No change ${period.compareLabel}`, tone: "neutral" as const }
          : { text: `${pts > 0 ? "▲" : "▼"} ${Math.abs(pts)} pts ${period.compareLabel}`, tone: pts > 0 ? "good" as const : "bad" as const }
      })()
    : undefined

  const cats = showAllCats ? a.categories : a.categories.slice(0, 6)

  return (
    // Refetch keeps the previous render, dimmed, instead of flashing a skeleton
    <div className={`space-y-8 transition-opacity ${loading ? "opacity-60" : ""}`}>

      {/* Hero: savings rate, or net when there's no income */}
      <Hero
        label={a.savingsRate !== null ? "Savings rate" : "Net cash flow"}
        value={a.savingsRate !== null ? `${Math.round(a.savingsRate)}%` : signed(a.net)}
        valueTone={(a.savingsRate ?? a.net) < 0 ? "bad" : undefined}
        delta={savingsDelta}>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <HeroStat label="Earned" value={money(a.earned)} />
          <HeroStat label="Spent" value={money(a.spent)} />
          <HeroStat label="Net" value={signed(a.net)} />
        </div>
      </Hero>

      <InsightList insights={insights} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile label="Spending" value={money(a.spent)} delta={deltaOf(a.spent, a.spentPrev, false, period.compareLabel)} />
        {a.projected !== null
          ? <StatTile label="Projected month-end" value={money(a.projected)} sub={`${money(a.avgPerDay)}/day so far`} />
          : <StatTile label="Average per day" value={money(a.avgPerDay)} sub={`over ${period.days} days`} />}
        <StatTile label="Budgets kept" href="/budget"
          value={a.budget.total > 0 ? `${a.budget.kept}/${a.budget.total}` : "—"}
          sub={a.budget.total > 0 ? (period.months.length > 1 ? "category-months within limit" : "categories within limit") : "No budgets set yet"} />
        <StatTile label="Net loans" href="/debts" value={signed(a.loans.net)}
          sub={`${money(a.loans.owedToYou)} owed to you · ${money(a.loans.youOwe)} you owe`} />
      </div>

      {/* Cash flow */}
      <div>
        <SectionTitle>Cash flow</SectionTitle>
        <ColumnChart
          title="Month"
          series={[{ name: "Income", bar: IN_BAR }, { name: "Spending", bar: OUT_BAR }]}
          data={a.cashflow.map(m => ({ label: m.label, values: [m.income, m.spending], dim: !m.inPeriod, note: `Net ${signed(m.net)}` }))}
          format={money}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">Faded months are outside the selected period. Loans aren&apos;t counted here.</p>
      </div>

      {/* Where it went */}
      <div>
        <SectionTitle action={a.categories.length > 6 && (
          <button onClick={() => setShowAllCats(v => !v)} className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white">
            {showAllCats ? "Show less" : `All ${a.categories.length}`}
          </button>
        )}>Where it went</SectionTitle>
        {a.categories.length === 0 ? (
          <EmptyState>No spending in this period.</EmptyState>
        ) : (
          <div className={`${CARD} p-5 sm:p-6`}>
            <BarList bar={OUT_BAR} rows={cats.map(c => ({
              key: c.cat, label: c.cat, value: c.total, valueText: money(c.total),
              note: <ChangeNote pct={c.change} upIsGood={false} />,
              href: `/expenses?category=${encodeURIComponent(c.cat)}`,
            }))} />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Change is {period.compareLabel}. Tap a category to see its expenses.</p>
          </div>
        )}
      </div>

      {/* Where it came from */}
      <div>
        <SectionTitle>Where it came from</SectionTitle>
        {a.sources.length === 0 ? (
          <EmptyState action={<QuickAddButton type="income">Add income</QuickAddButton>}>
            No income recorded in this period. Add it to see your savings rate.
          </EmptyState>
        ) : (
          <div className={`${CARD} p-5 sm:p-6`}>
            {a.expected > 0 && (
              <div className="mb-5 pb-5 border-b border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-sm font-semibold text-black dark:text-white">Received vs plan</span>
                  <span className="text-sm font-bold text-black dark:text-white">{Math.round((a.earned / a.expected) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                  <div className={`h-full rounded-full ${IN_BAR}`} style={{ width: `${Math.min(100, (a.earned / a.expected) * 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{money(a.earned)} of {money(a.expected)} planned</p>
              </div>
            )}
            <BarList bar={IN_BAR} rows={a.sources.map(s => ({
              key: s.source, label: s.source, value: s.total, valueText: money(s.total),
              note: <span className="text-gray-500 dark:text-gray-400">{Math.round((s.total / a.earned) * 100)}%</span>,
            }))} />
          </div>
        )}
      </div>

      {/* Loans & people */}
      {(a.loans.owedToYou > 0 || a.loans.youOwe > 0 || a.loans.flowIn > 0 || a.loans.flowOut > 0) && (
        <div>
          <SectionTitle action={<Link href="/debts" className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white">Finances →</Link>}>Loans &amp; people</SectionTitle>
          <div className={`${CARD} overflow-hidden`}>
            <div className="grid grid-cols-3 divide-x divide-black/[0.05] dark:divide-white/[0.05] border-b border-black/[0.05] dark:border-white/[0.05]">
              {[["Owed to you", money(a.loans.owedToYou)], ["You owe", money(a.loans.youOwe)], ["Net", signed(a.loans.net)]].map(([l, v]) => (
                <div key={l} className="p-4 min-w-0">
                  <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">{l}</p>
                  <p className="font-sans text-sm sm:text-base font-extrabold tracking-tight text-black dark:text-white break-words">{v}</p>
                </div>
              ))}
            </div>
            {a.loans.people.length > 0 && (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {a.loans.people.slice(0, 5).map(p => (
                  <Link key={p.name} href="/debts" className="flex items-center gap-3 px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                    <span className="w-9 h-9 rounded-xl bg-black dark:bg-volt grid place-items-center text-volt dark:text-black text-sm font-extrabold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-black dark:text-white truncate">{p.name}</span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold text-black dark:text-white">{money(Math.abs(p.net))}</span>
                      <span className={`block text-[0.6875rem] font-semibold ${p.net > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{p.net > 0 ? "owes you" : "you owe"}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4 bg-black/[0.015] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.05] text-xs">
              <MiniStat label="Paid back to you" value={a.loans.repaymentRate !== null ? `${Math.round(a.loans.repaymentRate)}%` : "—"} />
              <MiniStat label="Avg days to settle" value={a.loans.avgSettleDays !== null ? `${Math.round(a.loans.avgSettleDays)}d` : "—"} />
              <MiniStat label="Written off" value={a.loans.lossRate !== null ? `${Math.round(a.loans.lossRate)}% of lent` : "—"} />
              <MiniStat label="This period" value={`+${formatMoney(a.loans.flowIn)} / −${formatMoney(a.loans.flowOut)}`} />
            </div>
          </div>
        </div>
      )}

      {/* Habits — detail for those who want it */}
      {a.habits.txCount > 0 && (
        <Collapsible title="Spending habits">
          <ColumnChart title="Spending by weekday" series={[{ name: "Spending", bar: OUT_BAR }]} height={140}
            data={a.habits.weekdays.map(w => ({ label: w.label, values: [w.value] }))} format={money} />
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="No-spend days" value={String(a.habits.noSpendDays)} sub={`of ${period.days} days`} />
            <StatTile label="Since last expense" value={a.habits.daysSinceSpend === null ? "—" : a.habits.daysSinceSpend === 0 ? "Today" : `${a.habits.daysSinceSpend}d`} />
            <StatTile label="Typical expense" value={money(a.habits.medianTx)} sub={`median · avg ${money(a.habits.avgTx)}`} />
            <StatTile label="Expenses logged" value={String(a.habits.txCount)} sub="in this period" />
          </div>
          {(a.habits.biggest || a.habits.biggestDay) && (
            <div className={`${CARD} divide-y divide-black/[0.05] dark:divide-white/[0.05] overflow-hidden`}>
              {a.habits.biggest && (
                <Highlight label="Biggest expense" title={a.habits.biggest.description || a.habits.biggest.category} sub={fmtDay(a.habits.biggest.date)} value={money(Number(a.habits.biggest.amount))} />
              )}
              {a.habits.biggestDay && (
                <Highlight label="Biggest day" title={fmtDay(a.habits.biggestDay.date)} value={money(a.habits.biggestDay.total)} />
              )}
            </div>
          )}
          <div>
            <p className="text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3">Top reasons</p>
            <BarList bar={OUT_BAR} rows={a.habits.topDescriptions.map(t => ({
              key: t.label, label: t.label, value: t.total, valueText: money(t.total),
              note: <span className="text-gray-500 dark:text-gray-400">{t.count}×</span>,
            }))} />
          </div>
        </Collapsible>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="font-bold text-black dark:text-white break-words">{value}</p>
    </div>
  )
}

function Highlight({ label, title, sub, value }: { label: string; title: string; sub?: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="font-semibold text-black dark:text-white truncate">{title}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <span className="font-sans text-lg font-bold tracking-tight shrink-0 text-black dark:text-white">{value}</span>
    </div>
  )
}
