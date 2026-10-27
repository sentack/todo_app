"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { fetchAll } from "@/lib/fetchAll"
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_TEXT, INCOME_SOURCES, INCOME_SOURCE_BADGE } from "@/lib/constants"
import { useCurrency } from "@/contexts/CurrencyContext"
import { triggerUndo } from "@/lib/undoToast"
import { formatMoney } from "@/lib/formatMoney"
import {
  type LoanRecord, currentMonth, shiftMonth, monthRange, monthLabel, daysLeftInMonth,
  effectiveLimits, spentByCategory, loanFlows,
} from "@/lib/budget"

interface Income {
  id: string
  amount: number
  description: string | null
  source: string
  date: string
  created_at: string
}

interface ExpenseLite { amount: number; category: string }
interface Plan { month: string; expected_income: number; savings_goal: number }

const CARD     = "bg-white dark:bg-black border border-black/[0.06] dark:border-white/[0.07] rounded-3xl shadow-sm"
const SECTION  = "text-[0.6875rem] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] mb-3 px-1"
const INPUT    = "w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-2xl text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-white/[0.06] focus:border-black dark:focus:border-volt focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 transition-all text-[0.9375rem]"
const LABEL    = "block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5"
const BTN      = "h-11 px-5 bg-black dark:bg-volt text-white dark:text-black text-sm font-bold rounded-2xl shadow-md shadow-black/10 dark:shadow-volt/20 hover:opacity-90 disabled:opacity-40 transition-all"
const BTN_GHOST = "h-11 px-5 bg-gray-100 dark:bg-white/[0.06] text-black dark:text-white text-sm font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all"

function fmtDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

// useSearchParams needs a Suspense boundary for the static build
export default function BudgetPageWrapper() {
  return <Suspense><BudgetPage /></Suspense>
}

function BudgetPage() {
  const [month, setMonth]           = useState(currentMonth)
  const [loading, setLoading]       = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [expenses, setExpenses]   = useState<ExpenseLite[]>([])
  const [incomes, setIncomes]     = useState<Income[]>([])
  const [defaults, setDefaults]   = useState<{ category: string; monthly_limit: number }[]>([])
  const [overrides, setOverrides] = useState<{ category: string; amount: number }[]>([])
  const [plan, setPlan]           = useState<Plan | null>(null)
  const [debts, setDebts]         = useState<LoanRecord[]>([])
  const [lendings, setLendings]   = useState<LoanRecord[]>([])

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)
  const { currency } = useCurrency()
  const money = (v: number) => `${currency} ${formatMoney(v)}`

  // Deep link from search: /budget?month=YYYY-MM
  const monthParam = useSearchParams().get("month")
  useEffect(() => {
    if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) setMonth(monthParam)
  }, [monthParam])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      if (!userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        userIdRef.current = user.id
      }
      if (cancelled) return
      const uid = userIdRef.current!
      const [start, end] = monthRange(month)

      const [exp, inc, def, ovr, pln, dbt, lnd] = await Promise.all([
        fetchAll<ExpenseLite>((from, to) => supabase.from("expenses").select("amount, category", { count: "exact" })
          .eq("user_id", uid).gte("date", start).lt("date", end).order("id").range(from, to)),
        fetchAll<Income>((from, to) => supabase.from("incomes").select("*", { count: "exact" }).eq("user_id", uid).gte("date", start).lt("date", end)
          .order("date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to)),
        supabase.from("expense_budgets").select("category, monthly_limit").eq("user_id", uid),
        supabase.from("month_budgets").select("category, amount").eq("user_id", uid).eq("month", start),
        // This month's plan, or the latest earlier one to carry over
        supabase.from("month_plans").select("month, expected_income, savings_goal").eq("user_id", uid)
          .lte("month", start).order("month", { ascending: false }).limit(1).maybeSingle(),
        // Repayments made this month can belong to older loans, so load them all
        fetchAll<LoanRecord>((from, to) => supabase.from("debts").select("amount, date, paid_history", { count: "exact" }).eq("user_id", uid).order("id").range(from, to)),
        fetchAll<LoanRecord>((from, to) => supabase.from("lendings").select("amount, date, paid_history", { count: "exact" }).eq("user_id", uid).order("id").range(from, to)),
      ])

      if (cancelled) return
      setExpenses((exp.data ?? []) as ExpenseLite[])
      setIncomes((inc.data ?? []) as Income[])
      setDefaults(def.data ?? [])
      setOverrides(ovr.data ?? [])
      setPlan((pln.data as Plan | null) ?? null)
      setDebts((dbt.data ?? []) as LoanRecord[])
      setLendings((lnd.data ?? []) as LoanRecord[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [month, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent).detail?.type
      if (t === "expense" || t === "income" || t === "debt" || t === "lending") setRefreshKey(k => k + 1)
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, [])

  // ── derived ───────────────────────────────────────────────────────────────

  const [start] = monthRange(month)
  const isCurrent   = month === currentMonth()
  const planIsOwn   = plan?.month === start
  const expected    = Number(plan?.expected_income ?? 0)
  const savingsGoal = Number(plan?.savings_goal ?? 0)

  const limits  = useMemo(() => effectiveLimits(defaults, overrides), [defaults, overrides])
  const spent   = useMemo(() => spentByCategory(expenses), [expenses])
  const loans   = useMemo(() => loanFlows(debts, lendings, month), [debts, lendings, month])

  const earned      = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const spentTotal  = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const net         = earned - spentTotal
  const savedPct    = earned > 0 ? Math.round((net / earned) * 100) : null
  const cashChange  = net + loans.moneyIn - loans.moneyOut

  const budgetedCats = Object.keys(limits)
  const budgetTotal  = budgetedCats.reduce((s, c) => s + limits[c], 0)
  const budgetLeft   = budgetedCats.reduce((s, c) => s + limits[c] - (spent[c] ?? 0), 0)
  const unallocated  = expected - budgetTotal - savingsGoal

  const daysLeft      = daysLeftInMonth(month)
  const allowanceBase = budgetTotal > 0 ? budgetLeft : net
  const dailyAllow    = isCurrent && daysLeft > 0 && allowanceBase > 0 ? allowanceBase / daysLeft : null

  const categoryRows = CATEGORIES
    .filter(c => limits[c] !== undefined || (spent[c] ?? 0) > 0)
    .map(c => ({ cat: c, spent: spent[c] ?? 0, limit: limits[c] }))
    .sort((a, b) => {
      // Budgeted first (fullest on top), then unbudgeted by amount
      if ((a.limit === undefined) !== (b.limit === undefined)) return a.limit === undefined ? 1 : -1
      if (a.limit !== undefined && b.limit !== undefined) return b.spent / (b.limit || 1) - a.spent / (a.limit || 1)
      return b.spent - a.spent
    })

  // ── mutations ─────────────────────────────────────────────────────────────

  const savePlan = async (expected_income: number, savings_goal: number) => {
    if (!userIdRef.current) return false
    const { data, error } = await supabase.from("month_plans")
      .upsert({ user_id: userIdRef.current, month: start, expected_income, savings_goal }, { onConflict: "user_id,month" })
      .select("month, expected_income, savings_goal").single()
    if (!error && data) setPlan(data as Plan)
    return !error
  }

  const saveOverrides = async (draft: Record<string, string>) => {
    const uid = userIdRef.current
    if (!uid) return false
    const rows = CATEGORIES
      .filter(c => draft[c]?.trim() && !isNaN(parseFloat(draft[c])))
      .map(c => ({ user_id: uid, month: start, category: c, amount: parseFloat(draft[c]) }))
    const cleared = CATEGORIES.filter(c => !draft[c]?.trim())
    if (rows.length > 0) {
      const { error } = await supabase.from("month_budgets").upsert(rows, { onConflict: "user_id,month,category" })
      if (error) return false
    }
    if (cleared.length > 0) {
      await supabase.from("month_budgets").delete().eq("user_id", uid).eq("month", start).in("category", cleared)
    }
    setOverrides(rows.map(r => ({ category: r.category, amount: r.amount })))
    return true
  }

  const deleteIncome = (id: string) => {
    const item = incomes.find(i => i.id === id)
    if (!item) return
    setIncomes(prev => prev.filter(i => i.id !== id))
    let undone = false
    triggerUndo(`Deleted income: ${item.description || item.source}`, () => {
      undone = true
      setIncomes(prev => [...prev, item].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)))
    })
    setTimeout(async () => {
      if (!undone) await supabase.from("incomes").delete().eq("id", id)
    }, 5100)
  }

  const onIncomeUpdated = (u: Income) => {
    // An edited date may move it out of this month
    setIncomes(prev => u.date.slice(0, 7) === month ? prev.map(i => i.id === u.id ? u : i) : prev.filter(i => i.id !== u.id))
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
      <div className="animate-slide-in-down">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-black dark:bg-volt rounded-2xl flex items-center justify-center shrink-0 -rotate-3 shadow-lg shadow-black/15 dark:shadow-volt/20">
            <svg className="w-6 h-6 text-volt dark:text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-1.5">Monthly plan</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-none text-black dark:text-white">Budget</h1>
          </div>
        </div>

        {/* Month switcher */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month"
            className="w-11 h-11 shrink-0 grid place-items-center rounded-full bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <div className="flex-1 h-11 grid place-items-center rounded-full bg-black/[0.04] dark:bg-white/[0.05] font-display font-bold tracking-tight text-black dark:text-white">
            {monthLabel(month)}
          </div>
          <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month"
            className="w-11 h-11 shrink-0 grid place-items-center rounded-full bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
          {!isCurrent && (
            <button onClick={() => setMonth(currentMonth())} className="h-11 px-4 shrink-0 rounded-full text-xs font-bold bg-black dark:bg-volt text-white dark:text-black">This month</button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton rounded-3xl h-28" />)}</div>
        ) : (
          <div className="space-y-8">

            {/* Hero: earned vs spent */}
            <div className="hero-card rounded-3xl p-6 shadow-xl">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/60 dark:text-black/60 mb-2">Net this month</p>
              <p className={`font-display text-4xl sm:text-5xl font-extrabold tracking-tight ${net < 0 ? "text-rose-400 dark:text-rose-700" : "text-white dark:text-black"}`}>
                {net < 0 ? "−" : ""}{money(Math.abs(net))}
              </p>
              <div className="grid grid-cols-3 gap-3 mt-5">
                <HeroStat label="Earned" value={money(earned)} />
                <HeroStat label="Spent" value={money(spentTotal)} />
                <HeroStat label="Saved" value={savedPct === null ? "—" : `${savedPct}%`} />
              </div>
              {dailyAllow !== null && (
                <p className="text-xs font-semibold text-white/70 dark:text-black/70 mt-4">
                  {money(dailyAllow)}/day left to spend for the next {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  {budgetTotal > 0 ? " (from your budget)" : " (from your income)"}
                </p>
              )}
            </div>

            {/* Plan */}
            <div>
              <h2 className={SECTION}>Plan</h2>
              <PlanCard
                key={`${month}-${plan?.month}`}
                expected={expected} savingsGoal={savingsGoal} carried={!!plan && !planIsOwn} carriedFrom={plan?.month}
                earned={earned} budgetTotal={budgetTotal} unallocated={unallocated}
                currency={currency} onSave={savePlan}
              />
            </div>

            {/* Category budgets */}
            <div>
              <h2 className={SECTION}>Category budgets</h2>
              <CategoryBudgets
                key={month}
                rows={categoryRows} defaults={defaults} overrides={overrides}
                budgetTotal={budgetTotal} budgetLeft={budgetLeft}
                currency={currency} onSave={saveOverrides}
              />
            </div>

            {/* Loans — shown separately, never counted as income or spending */}
            <div>
              <h2 className={SECTION}>Loans this month</h2>
              <div className={`${CARD} overflow-hidden`}>
                <div className="grid grid-cols-2 divide-x divide-black/[0.05] dark:divide-white/[0.05]">
                  <div className="p-5">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400 mb-1">Money in</p>
                    <p className="font-display text-xl font-extrabold tracking-tight text-black dark:text-white mb-3">{money(loans.moneyIn)}</p>
                    <LoanLine label="Borrowed" value={money(loans.borrowed)} />
                    <LoanLine label="Paid back to you" value={money(loans.collected)} />
                  </div>
                  <div className="p-5">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400 mb-1">Money out</p>
                    <p className="font-display text-xl font-extrabold tracking-tight text-black dark:text-white mb-3">{money(loans.moneyOut)}</p>
                    <LoanLine label="Lent" value={money(loans.lent)} />
                    <LoanLine label="You paid back" value={money(loans.repaid)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-black/[0.05] dark:border-white/[0.05] bg-black/[0.015] dark:bg-white/[0.02]">
                  <div>
                    <p className="text-sm font-bold text-black dark:text-white">Cash change</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Net this month + loans in − loans out</p>
                  </div>
                  <p className={`font-display text-lg font-extrabold tracking-tight shrink-0 ${cashChange < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {cashChange < 0 ? "−" : "+"}{money(Math.abs(cashChange))}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-1">
                Loans are kept out of your budget. Manage them in <Link href="/debts" className="font-semibold underline underline-offset-2 hover:text-black dark:hover:text-white">Finances</Link>.
              </p>
            </div>

            {/* Incomes */}
            <div>
              <h2 className={SECTION}>Income · {incomes.length} entr{incomes.length === 1 ? "y" : "ies"}</h2>
              {incomes.length === 0 ? (
                <div className={`${CARD} p-6 text-center text-sm font-medium text-gray-500 dark:text-gray-400`}>
                  No income recorded for {monthLabel(month)}. Use the + button to add one.
                </div>
              ) : (
                <div className={`${CARD} overflow-hidden`}>
                  {incomes.map((inc, idx) => (
                    <IncomeRow key={inc.id} inc={inc} isLast={idx === incomes.length - 1} currency={currency}
                      onDelete={deleteIncome} onUpdated={onIncomeUpdated} />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ── small pieces ──────────────────────────────────────────────────────────────

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/60 dark:text-black/60 mb-1">{label}</p>
      <p className="font-display text-base sm:text-xl font-extrabold tracking-tight leading-tight text-white dark:text-black break-words">{value}</p>
    </div>
  )
}

function LoanLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs py-0.5">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-black dark:text-white text-right">{value}</span>
    </div>
  )
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({ expected, savingsGoal, carried, carriedFrom, earned, budgetTotal, unallocated, currency, onSave }: {
  expected: number; savingsGoal: number; carried: boolean; carriedFrom?: string
  earned: number; budgetTotal: number; unallocated: number; currency: string
  onSave: (expected: number, savings: number) => Promise<boolean>
}) {
  const [editing, setEditing]   = useState(false)
  const [expDraft, setExpDraft] = useState(expected ? String(expected) : "")
  const [savDraft, setSavDraft] = useState(savingsGoal ? String(savingsGoal) : "")
  const [saving, setSaving]     = useState(false)
  const money = (v: number) => `${currency} ${formatMoney(v)}`

  const receivedPct = expected > 0 ? Math.min(100, Math.round((earned / expected) * 100)) : 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ok = await onSave(parseFloat(expDraft) || 0, parseFloat(savDraft) || 0)
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className={`${CARD} p-5 sm:p-6 space-y-3`}>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={LABEL}>Expected income</label>
            <input type="number" step="0.01" min="0" value={expDraft} onChange={e => setExpDraft(e.target.value)} placeholder="0.00" autoFocus className={INPUT} />
          </div>
          <div className="flex-1">
            <label className={LABEL}>Savings goal</label>
            <input type="number" step="0.01" min="0" value={savDraft} onChange={e => setSavDraft(e.target.value)} placeholder="0.00" className={INPUT} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={`flex-1 ${BTN}`}>{saving ? "Saving..." : "Save plan"}</button>
          <button type="button" onClick={() => setEditing(false)} className={BTN_GHOST}>Cancel</button>
        </div>
      </form>
    )
  }

  if (expected === 0 && savingsGoal === 0) {
    return (
      <div className={`${CARD} p-5 sm:p-6 flex items-center justify-between gap-4`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">Set how much you expect to earn and save this month.</p>
        <button onClick={() => setEditing(true)} className={`shrink-0 ${BTN}`}>Set plan</button>
      </div>
    )
  }

  return (
    <div className={`${CARD} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">Received</p>
          <p className="font-display text-xl font-extrabold tracking-tight text-black dark:text-white">
            {money(earned)} <span className="text-sm font-semibold text-gray-400">of {money(expected)}</span>
          </p>
          {carried && carriedFrom && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Carried over from {monthLabel(carriedFrom.slice(0, 7))}. Save to keep it for this month.</p>
          )}
        </div>
        <button onClick={() => setEditing(true)} className="h-9 px-4 shrink-0 rounded-full text-xs font-bold bg-gray-100 dark:bg-white/[0.06] text-black dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">Edit</button>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden mb-5">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${receivedPct}%` }} />
      </div>
      <div className="space-y-1.5 text-sm">
        <PlanLine label="Expected income" value={money(expected)} />
        <PlanLine label="Category budgets" value={`− ${money(budgetTotal)}`} />
        <PlanLine label="Savings goal" value={`− ${money(savingsGoal)}`} />
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-black/[0.05] dark:border-white/[0.05]">
          <span className="font-bold text-black dark:text-white">{unallocated < 0 ? "Over-planned by" : "Unallocated"}</span>
          <span className={`font-display font-bold tracking-tight ${unallocated < 0 ? "text-rose-600 dark:text-rose-400" : "text-black dark:text-white"}`}>{money(Math.abs(unallocated))}</span>
        </div>
      </div>
    </div>
  )
}

function PlanLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-black dark:text-white">{value}</span>
    </div>
  )
}

// ── CategoryBudgets ───────────────────────────────────────────────────────────

function CategoryBudgets({ rows, defaults, overrides, budgetTotal, budgetLeft, currency, onSave }: {
  rows: { cat: string; spent: number; limit: number | undefined }[]
  defaults: { category: string; monthly_limit: number }[]
  overrides: { category: string; amount: number }[]
  budgetTotal: number; budgetLeft: number; currency: string
  onSave: (draft: Record<string, string>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const money = (v: number) => `${currency} ${formatMoney(v)}`

  const startEdit = () => {
    setDraft(Object.fromEntries(overrides.map(o => [o.category, String(o.amount)])))
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    const defaultFor = (c: string) => defaults.find(d => d.category === c)?.monthly_limit
    return (
      <div className={`${CARD} p-5 sm:p-6`}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Limits for this month only. Leave blank to use your default from <Link href="/settings" className="font-semibold underline underline-offset-2">Settings</Link>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {CATEGORIES.map(c => {
            const def = defaultFor(c)
            return (
              <div key={c}>
                <label className={LABEL}>{c}</label>
                <input type="number" min="0" step="1" value={draft[c] ?? ""}
                  onChange={e => setDraft(prev => ({ ...prev, [c]: e.target.value }))}
                  placeholder={def !== undefined ? `Default ${formatMoney(Number(def))}` : "No limit"} className={INPUT} />
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className={`flex-1 ${BTN}`}>{saving ? "Saving..." : "Save budgets"}</button>
          <button onClick={() => setEditing(false)} className={BTN_GHOST}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${CARD} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        {budgetTotal > 0 ? (
          <div>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1">{budgetLeft < 0 ? "Over budget" : "Budget left"}</p>
            <p className={`font-display text-xl font-extrabold tracking-tight ${budgetLeft < 0 ? "text-rose-600 dark:text-rose-400" : "text-black dark:text-white"}`}>
              {money(Math.abs(budgetLeft))} <span className="text-sm font-semibold text-gray-400">of {money(budgetTotal)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No limits set. Add some for this month, or set defaults in Settings.</p>
        )}
        <button onClick={startEdit} className="h-9 px-4 shrink-0 rounded-full text-xs font-bold bg-gray-100 dark:bg-white/[0.06] text-black dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">Edit</button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No spending this month yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map(({ cat, spent, limit }) => {
            const over = limit !== undefined && spent > limit
            const pct  = limit ? Math.min(100, (spent / limit) * 100) : limit === 0 ? 100 : 0
            return (
              <div key={cat}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`text-sm font-semibold ${CATEGORY_TEXT[cat] || CATEGORY_TEXT["Other"]}`}>{cat}</span>
                  <div className="text-right text-sm">
                    <span className="font-bold text-black dark:text-white">{money(spent)}</span>
                    {limit !== undefined
                      ? <span className={`text-xs ml-2 ${over ? "font-bold text-rose-600 dark:text-rose-400" : "text-gray-400"}`}>
                          {over ? `${formatMoney(spent - limit)} over` : `${formatMoney(limit - spent)} left`}
                        </span>
                      : <span className="text-xs text-gray-400 ml-2">no limit</span>}
                  </div>
                </div>
                {limit !== undefined && (
                  <div className="h-2.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${over ? "bg-rose-500" : CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"]}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── IncomeRow ─────────────────────────────────────────────────────────────────

function IncomeRow({ inc, isLast, currency, onDelete, onUpdated }: {
  inc: Income; isLast: boolean; currency: string
  onDelete: (id: string) => void; onUpdated: (u: Income) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [amount, setAmount]       = useState(String(inc.amount))
  const [description, setDesc]    = useState(inc.description ?? "")
  const [source, setSource]       = useState(inc.source)
  const [date, setDate]           = useState(inc.date)
  const [saving, setSaving]       = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const startEdit = () => {
    setAmount(String(inc.amount)); setDesc(inc.description ?? "")
    setSource(inc.source); setDate(inc.date); setIsEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setSaving(true)
    const { data, error } = await supabase.from("incomes")
      .update({ amount: parsed, description: description.trim() || null, source, date })
      .eq("id", inc.id).select().single()
    setSaving(false)
    if (!error && data) { setIsEditing(false); onUpdated(data) }
  }

  const borderCls = !isLast ? "border-b border-black/[0.05] dark:border-white/[0.05]" : ""
  const badge = INCOME_SOURCE_BADGE[inc.source] || INCOME_SOURCE_BADGE["Other"]

  if (isEditing) {
    return (
      <div className={`px-5 py-5 bg-volt/[0.06] ${borderCls}`}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={LABEL}>{currency} Amount *</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required autoFocus className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
            </div>
          </div>
          <input type="text" value={description} onChange={e => setDesc(e.target.value)} placeholder="Description" className={INPUT} />
          <select value={source} onChange={e => setSource(e.target.value)} className={INPUT}>
            {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={`flex-1 ${BTN}`}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setIsEditing(false)} className={BTN_GHOST}>Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 pl-4 sm:pl-5 pr-2 sm:pr-3 py-3.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors ${borderCls}`}>
      <span className={`w-11 h-11 shrink-0 rounded-2xl grid place-items-center font-display text-base font-extrabold ${badge}`}>{inc.source.charAt(0)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-black dark:text-white truncate">{inc.description || inc.source}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {inc.description && <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${badge}`}>{inc.source}</span>}
          <span className="text-xs text-gray-400 dark:text-gray-600">{fmtDay(inc.date)}</span>
        </div>
      </div>
      <span className="font-display text-base sm:text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 shrink-0 ml-1"><span className="text-xs font-semibold text-gray-400 mr-0.5">+{currency}</span>{formatMoney(Number(inc.amount))}</span>
      <button onClick={startEdit} aria-label="Edit income" className="w-9 h-9 shrink-0 grid place-items-center text-gray-400 hover:text-black dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
      </button>
      <button onClick={() => onDelete(inc.id)} aria-label="Delete income" className="w-9 h-9 shrink-0 grid place-items-center text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      </button>
    </div>
  )
}
