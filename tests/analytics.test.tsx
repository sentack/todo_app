// Every Insights number checked against an independent reference calculation.
// "Today" is fixed at 2026-10-27 in Africa/Addis_Ababa (UTC+3, no DST).

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { setUserTimeZone } from "@/lib/dates"
import { formatMoney } from "@/lib/formatMoney"
import {
  resolvePeriod, periodForData, moneyAnalytics, todoAnalytics, shoppingAnalytics,
  type PeriodKey, type MoneyInput,
} from "@/lib/analytics"
import { MoneyView, loadMoneyInput } from "@/components/stats/MoneyTab"
import { TodosView } from "@/components/stats/TodosTab"
import { ShoppingView } from "@/components/stats/ShoppingTab"
import { moneyFixture, todoFixture, shoppingFixture, fakeSupabase, daysFrom } from "./fixtures"

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-27T09:00:00Z"))   // 12:00 in Addis Ababa
  setUserTimeZone("Africa/Addis_Ababa")
})
afterAll(() => { vi.useRealTimers(); setUserTimeZone(null) })

// Inclusive date ranges written out by hand — the reference for each period
const RANGES: Record<PeriodKey, { from: string; to: string; prev: [string, string] | null; elapsed: number }> = {
  "month":      { from: "2026-10-01", to: "2026-10-31", prev: ["2026-09-01", "2026-09-27"], elapsed: 27 },
  "last-month": { from: "2026-09-01", to: "2026-09-30", prev: ["2026-08-01", "2026-08-31"], elapsed: 30 },
  "3m":         { from: "2026-08-01", to: "2026-10-31", prev: ["2026-05-01", "2026-07-27"], elapsed: 31 + 30 + 27 },
  "6m":         { from: "2026-05-01", to: "2026-10-31", prev: ["2025-11-01", "2026-04-27"], elapsed: 31 + 30 + 31 + 31 + 30 + 27 },
  "12m":        { from: "2025-11-01", to: "2026-10-31", prev: ["2024-11-01", "2025-10-27"], elapsed: 30 + 31 + 31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 27 },
  "all":        { from: "2024-03-01", to: "2026-10-31", prev: null, elapsed: daysFrom("2024-03-01", "2026-10-27").length },
}
const KEYS = Object.keys(RANGES) as PeriodKey[]

const inR = (d: string, from: string, to: string) => d >= from && d <= to
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)
const monthsOf = (from: string, to: string) => [...new Set(daysFrom(from, to).map(d => d.slice(0, 7)))]
const addisDay = (ts: string) => new Date(Date.parse(ts) + 3 * 3600000).toISOString().slice(0, 10)

const money = (v: number) => `ETB ${formatMoney(v)}`
const signed = (v: number) => `${v < 0 ? "−" : "+"}${money(Math.abs(v))}`

/** { card label → displayed value } from rendered markup */
function cards(html: string) {
  const out: Record<string, string> = {}
  for (const m of html.matchAll(/data-stat="([^"]+)"[\s\S]*?data-value="true"[^>]*>([^<]*)</g)) out[m[1]] = m[2]
  return out
}
function cardDelta(html: string, label: string) {
  const m = html.match(new RegExp(`data-stat="${label}"(?:(?!data-stat=)[\\s\\S])*?data-delta="true"[^>]*>([^<]*)<`))
  return m?.[1] ?? null
}

const D: MoneyInput = moneyFixture()

describe("periods", () => {
  it.each(KEYS)("%s covers the right days", key => {
    const p = periodForData(resolvePeriod(key), D.expenses.map(e => e.date))
    const r = RANGES[key]
    expect(p.start).toBe(r.from)
    // Running periods include the rest of this month; last month ends when this one starts
    expect(p.end).toBe(key === "last-month" ? "2026-10-01" : "2026-11-01")
    expect(p.days).toBe(r.elapsed)                   // …but averages divide by days elapsed
    expect(p.hasComparison).toBe(r.prev !== null)
    if (r.prev) { expect(p.prevStart).toBe(r.prev[0]); expect(p.prevEnd > r.prev[1]).toBe(true) }
  })
})

describe("money", () => {
  it("fixture is bigger than one Supabase response", () => {
    expect(D.expenses.length).toBeGreaterThan(2000)
  })

  it.each(KEYS)("%s: every number matches the reference", key => {
    const r = RANGES[key]
    const p = periodForData(resolvePeriod(key), D.expenses.map(e => e.date))
    const a = moneyAnalytics(p, D)

    const exp = D.expenses.filter(e => inR(e.date, r.from, r.to))
    const inc = D.incomes.filter(i => inR(i.date, r.from, r.to))
    const spent = sum(exp, e => e.amount), earned = sum(inc, i => i.amount)
    expect(a.spent).toBeCloseTo(spent, 6)
    expect(a.earned).toBeCloseTo(earned, 6)
    expect(a.net).toBeCloseTo(earned - spent, 6)
    expect(a.savingsRate!).toBeCloseTo(((earned - spent) / earned) * 100, 6)
    expect(a.avgPerDay).toBeCloseTo(spent / r.elapsed, 6)

    if (r.prev) {
      expect(a.spentPrev).toBeCloseTo(sum(D.expenses.filter(e => inR(e.date, ...r.prev!)), e => e.amount), 6)
      expect(a.earnedPrev).toBeCloseTo(sum(D.incomes.filter(i => inR(i.date, ...r.prev!)), i => i.amount), 6)
    } else {
      expect(a.spentPrev).toBe(0)
      expect(a.savingsRatePrev).toBeNull()
    }

    expect(a.projected === null).toBe(key !== "month")
    if (key === "month") expect(a.projected!).toBeCloseTo((spent / 27) * 31, 6)

    // Categories and their previous-period values
    for (const c of a.categories) {
      expect(c.total).toBeCloseTo(sum(exp.filter(e => e.category === c.cat), e => e.amount), 6)
      if (r.prev) expect(c.prev).toBeCloseTo(sum(D.expenses.filter(e => e.category === c.cat && inR(e.date, ...r.prev!)), e => e.amount), 6)
    }
    expect(sum(a.categories, c => c.total)).toBeCloseTo(spent, 6)
    expect(sum(a.sources, s => s.total)).toBeCloseTo(earned, 6)

    // Budgets: each (month, budgeted category) pair, October's Coffee override included
    let kept = 0, total = 0
    for (const m of monthsOf(r.from, r.to)) {
      for (const d of D.defaults) {
        const limit = m === "2026-10" && d.category === "Coffee" ? 5000 : d.monthly_limit
        const s = sum(exp.filter(e => e.date.startsWith(m) && e.category === d.category), e => e.amount)
        total++; if (s <= limit) kept++
      }
    }
    expect(a.budget).toMatchObject({ kept, total })

    // Plans: only months inside the period
    const months = monthsOf(r.from, r.to)
    const planned = D.plans.map(pl => pl.month.slice(0, 7)).filter(m => months.includes(m))
    expect(a.expected).toBe(sum(D.plans.filter(pl => planned.includes(pl.month.slice(0, 7))), pl => pl.expected_income))
    // Compared with income from the planned months only, never the whole period
    expect(a.receivedVsPlan).toBeCloseTo(sum(inc.filter(i => planned.includes(i.date.slice(0, 7))), i => i.amount), 6)

    // Cash flow chart: whole calendar months
    for (const m of a.cashflow) {
      expect(m.spending).toBeCloseTo(sum(D.expenses.filter(e => e.date.startsWith(m.key)), e => e.amount), 6)
      expect(m.income).toBeCloseTo(sum(D.incomes.filter(i => i.date.startsWith(m.key)), i => i.amount), 6)
    }
    expect(a.cashflow.at(-1)!.key).toBe(key === "last-month" ? "2026-09" : "2026-10")
    expect(a.cashflow).toHaveLength(Math.max(months.length, 6))

    // Habits
    expect(a.habits.txCount).toBe(exp.length)
    const spendDays = new Set(exp.filter(e => e.date <= "2026-10-27").map(e => e.date)).size
    expect(a.habits.noSpendDays).toBe(r.elapsed - spendDays)
  })

  it("loans: position, overdue, repayment, write-offs, flows, people", () => {
    const a = moneyAnalytics(resolvePeriod("month"), D).loans
    expect(a.owedToYou).toBe(3000)            // Sara
    expect(a.youOwe).toBe(3000)               // Abel 5000 − 2000 paid
    expect(a.overdueLendAmount).toBe(3000)
    expect(a.overdueDebtAmount).toBe(3000)
    expect(a.repaymentRate!).toBeCloseTo((1300 / (5800 - 1500)) * 100, 6)   // written-off part excluded
    expect(a.lossRate!).toBeCloseTo((1500 / 5800) * 100, 6)
    expect(a.avgSettleDays).toBe(17.5)        // Mimi 20d, abel 15d; Liya's write-off doesn't count
    expect(a.flowIn).toBe(0)                  // Liya's October entry is a write-off, not cash
    expect(a.flowOut).toBe(3000 + 2000)       // lent to Sara + repaid Abel
    expect(a.people).toEqual([{ name: "Abel", net: -3000 }, { name: "Sara", net: 3000 }])   // "abel " merged
  })

  it("loads every row through the paged loader (>1,000 expenses)", async () => {
    const tag = <T extends object>(xs: T[]) => xs.map((x, i) => ({ ...x, id: `${i}`, user_id: "u1" }))
    const client = fakeSupabase({
      expenses: D.expenses, incomes: tag(D.incomes), expense_budgets: tag(D.defaults),
      month_budgets: tag(D.overrides), month_plans: tag(D.plans), debts: tag(D.debts), lendings: tag(D.lendings),
    })
    const input = await loadMoneyInput(client as never, "u1")
    expect(input.expenses).toHaveLength(D.expenses.length)
    expect(input.incomes).toHaveLength(D.incomes.length)
    const oct = moneyAnalytics(resolvePeriod("month"), input).spent
    expect(oct).toBeCloseTo(sum(D.expenses.filter(e => e.date.startsWith("2026-10")), e => e.amount), 6)
  })

  it.each(KEYS)("%s: each card shows the right value", key => {
    const r = RANGES[key]
    const html = renderToStaticMarkup(<MoneyView data={D} period={resolvePeriod(key)} currency="ETB" />)
    const c = cards(html)
    const spent = sum(D.expenses.filter(e => inR(e.date, r.from, r.to)), e => e.amount)
    const earned = sum(D.incomes.filter(i => inR(i.date, r.from, r.to)), i => i.amount)

    const rate = ((earned - spent) / earned) * 100
    expect(c["Savings rate"]).toBe(Math.abs(rate) < 1 ? `${rate.toFixed(1)}%` : `${Math.round(rate)}%`)
    expect(c["Earned"]).toBe(money(earned))
    expect(c["Spent"]).toBe(money(spent))
    expect(c["Net"]).toBe(signed(earned - spent))
    expect(c["Spending"]).toBe(money(spent))
    if (key === "month") expect(c["Projected month-end"]).toBe(money((spent / 27) * 31))
    else expect(c["Average per day"]).toBe(money(spent / r.elapsed))
    expect(c["Net loans"]).toBe(signed(0))

    const delta = cardDelta(html, "Spending")
    if (r.prev) {
      const prev = sum(D.expenses.filter(e => inR(e.date, ...r.prev!)), e => e.amount)
      const pct = Math.round(((spent - prev) / prev) * 100)
      expect(delta).toContain(`${Math.abs(pct)}%`)
      expect(delta).toContain(pct > 0 ? "▲" : "▼")
    } else {
      expect(delta).toBeNull()                // All time has nothing to compare with
    }
  })

  it("after local midnight on the 1st, This month is the new month", () => {
    vi.setSystemTime(new Date("2026-10-31T22:30:00Z"))   // 01:30 on Nov 1 in Addis Ababa
    const p = resolvePeriod("month")
    expect(p.start).toBe("2026-11-01")
    const a = moneyAnalytics(p, { ...D, expenses: [...D.expenses, { amount: 250, category: "Coffee", date: "2026-11-01", description: null }] })
    expect(a.spent).toBe(250)
    vi.setSystemTime(new Date("2026-10-27T09:00:00Z"))
  })
})

describe("todos", () => {
  const T = todoFixture()

  it.each(KEYS)("%s: every number and card matches the reference", key => {
    const r = RANGES[key]
    const p = periodForData(resolvePeriod(key), T.map(t => addisDay(t.created_at)))
    const a = todoAnalytics(p, T)
    const from = key === "all" ? T.map(t => addisDay(t.created_at)).sort()[0] : r.from

    const done = T.filter(t => t.completed && inR(addisDay(t.completed_at!), from, r.to))
    const created = T.filter(t => inR(addisDay(t.created_at), from, r.to))
    const withDue = done.filter(t => t.due_date)
    const overdue = T.filter(t => !t.completed && t.due_date && t.due_date < "2026-10-27")
    expect(a.completed).toBe(done.length)
    expect(a.created).toBe(created.length)
    expect(a.backlogChange).toBe(created.length - done.length)
    expect(a.onTimeRate!).toBeCloseTo((withDue.filter(t => addisDay(t.completed_at!) <= t.due_date!).length / withDue.length) * 100, 6)
    expect(a.overdue).toHaveLength(overdue.length)
    expect(a.openCount).toBe(T.filter(t => !t.completed).length)
    if (r.prev) expect(a.completedPrev).toBe(T.filter(t => t.completed && inR(addisDay(t.completed_at!), ...r.prev!)).length)
    expect(sum(a.chart, b => b.completed)).toBe(done.length)
    expect(sum(a.chart, b => b.created)).toBe(created.length)

    const c = cards(renderToStaticMarkup(<TodosView todos={T} period={resolvePeriod(key)} />))
    expect(c["Completed"]).toBe(String(done.length))
    expect(c["Added"]).toBe(String(created.length))
    expect(c["Open now"]).toBe(String(a.openCount))
    expect(c["Overdue"]).toBe(String(overdue.length))
    expect(c["Backlog"]).toBe(`${a.backlogChange > 0 ? "+" : ""}${created.length - done.length}`)
    expect(c["On time"]).toBe(`${Math.round(a.onTimeRate!)}%`)
  })
})

describe("shopping", () => {
  const S = shoppingFixture()

  it.each(KEYS)("%s: every number and card matches the reference", key => {
    const r = RANGES[key]
    const p = periodForData(resolvePeriod(key), S.map(i => addisDay(i.created_at)))
    const a = shoppingAnalytics(p, S)
    const from = key === "all" ? S.map(i => addisDay(i.created_at)).sort()[0] : r.from
    const cost = (i: typeof S[number]) => i.price * i.quantity

    const pending = S.filter(i => !i.bought)
    const urgent = pending.filter(i => i.urgency === "critical" || i.urgency === "high")
    const bought = S.filter(i => i.bought && inR(addisDay(i.bought_at!), from, r.to))
    expect(a.pendingCost).toBe(sum(pending, cost))
    expect(a.urgentCost).toBe(sum(urgent, cost))
    expect(a.bought).toBe(bought.length)
    expect(sum(a.byUrgency, u => u.count)).toBe(pending.length)

    const c = cards(renderToStaticMarkup(<ShoppingView items={S} budgetLeft={2000} period={resolvePeriod(key)} currency="ETB" />))
    expect(c["Your list costs"]).toBe(money(sum(pending, cost)))
    expect(c["Pending"]).toBe(String(pending.length))
    expect(c["Urgent"]).toBe(String(urgent.length))
    expect(c["Bought"]).toBe(String(bought.length))
    expect(c["Urgent value"]).toBe(money(sum(urgent, cost)))
  })
})
