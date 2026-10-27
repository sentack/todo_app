// Deterministic sample data and a fake Supabase client for the analytics tests.

import { CATEGORIES } from "@/lib/constants"
import type { MoneyInput, TodoRow, ToBuyRow } from "@/lib/analytics"

/** Seeded PRNG so every run sees the same data */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Calendar days from `from` to `to` inclusive (date keys, UTC math) */
export function daysFrom(from: string, to: string) {
  const out: string[] = []
  for (let d = new Date(from + "T00:00:00Z"); iso(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(iso(d))
  return out
}

/**
 * ~2,400 expenses from Mar 2024 to the end of Oct 2026 (including entries
 * dated after "today" = 2026-10-27), so a single capped request can't hold them.
 */
export function moneyFixture(): MoneyInput & { expenses: (MoneyInput["expenses"][number] & { id: string; user_id: string })[] } {
  const rand = mulberry32(42)
  const cents = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100
  const expenses: ReturnType<typeof moneyFixture>["expenses"] = []
  let n = 0
  for (const date of daysFrom("2024-03-01", "2026-10-31")) {
    const count = Math.floor(rand() * 4) + (date >= "2026-10-01" ? 2 : 1)   // a busier current month
    for (let i = 0; i < count; i++) {
      expenses.push({
        id: `e${++n}`, user_id: "u1", date,
        amount: cents(15, 900),
        category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
        description: rand() < 0.4 ? ["Lunch", "Taxi", "Groceries", "Latte"][Math.floor(rand() * 4)] : null,
      })
    }
  }
  const incomes: MoneyInput["incomes"] = []
  for (const date of daysFrom("2024-03-01", "2026-10-31")) {
    if (date.endsWith("-01")) incomes.push({ amount: 30000 + Math.round(rand() * 5000), source: "Salary", date })
    if (rand() < 0.03) incomes.push({ amount: cents(500, 6000), source: "Freelance", date })
  }
  return {
    expenses, incomes,
    defaults: [
      { category: "Coffee", monthly_limit: 900 },
      { category: "Food & Drinks", monthly_limit: 6000 },
      { category: "Transport", monthly_limit: 4000 },
    ],
    overrides: [{ month: "2026-10-01", category: "Coffee", amount: 5000 }],
    plans: [{ month: "2026-09-01", expected_income: 32000 }, { month: "2026-10-01", expected_income: 36000 }],
    debts: [
      { amount: 5000, amount_paid: 2000, date: "2026-08-10", deadline: "2026-10-20", person: "Abel", paid_history: [{ amount: 2000, date: "2026-10-05" }] },
      { amount: 1200, amount_paid: 1200, date: "2026-05-02", deadline: null, person: "Mimi", paid_history: [{ amount: 1200, date: "2026-05-22" }] },
    ],
    lendings: [
      { amount: 3000, amount_paid: 0, date: "2026-10-03", deadline: "2026-10-15", person: "Sara", paid_history: [] },
      { amount: 2000, amount_paid: 2000, date: "2026-06-01", deadline: null, person: "Liya", paid_history: [{ amount: 500, date: "2026-07-01" }, { amount: 1500, date: "2026-10-02", written_off: true }] },
      { amount: 800, amount_paid: 800, date: "2026-09-10", deadline: "2026-12-01", person: "abel ", paid_history: [{ amount: 800, date: "2026-09-25" }] },
    ],
  }
}

export function todoFixture(): TodoRow[] {
  const rand = mulberry32(7)
  const rows: TodoRow[] = []
  const base = Date.parse("2026-01-01T06:00:00Z")
  for (let i = 0; i < 1300; i++) {
    const created = base + Math.floor(rand() * 300) * 86400000 + Math.floor(rand() * 86400000)
    const done = rand() < 0.7
    // Some completions land late in the UTC evening — the next day in Addis Ababa
    const completed = done ? Math.min(created + Math.floor(rand() * 20 * 86400000), Date.parse("2026-10-27T08:00:00Z")) : null
    const due = rand() < 0.5 ? new Date(created + Math.floor(rand() * 15) * 86400000).toISOString().slice(0, 10) : null
    rows.push({
      id: `t${i}`, title: `Task ${i}`, created_at: new Date(created).toISOString(), updated_at: null,
      completed: done, completed_at: completed ? new Date(completed).toISOString() : null, due_date: due,
    })
  }
  return rows
}

export function shoppingFixture(): ToBuyRow[] {
  const urg = ["critical", "high", "medium", "low"] as const
  const rand = mulberry32(3)
  return Array.from({ length: 60 }, (_, i) => {
    const created = Date.parse("2026-08-01T09:00:00Z") + Math.floor(rand() * 85) * 86400000
    const bought = rand() < 0.5
    const boughtAt = bought ? Math.min(created + Math.floor(rand() * 12) * 86400000, Date.parse("2026-10-27T08:00:00Z")) : null
    return {
      id: `b${i}`, name: `Item ${i}`, quantity: 1 + Math.floor(rand() * 3), price: Math.round(rand() * 900),
      urgency: urg[Math.floor(rand() * 4)], bought, created_at: new Date(created).toISOString(),
      bought_at: boughtAt ? new Date(boughtAt).toISOString() : null, expense_id: bought && rand() < 0.6 ? `e${i}` : null,
    }
  })
}

/**
 * Minimal stand-in for the Supabase query builder. Like PostgREST it returns
 * at most `cap` rows per request — with or without .range().
 */
export function fakeSupabase(tables: Record<string, object[]>, cap = 1000) {
  const requests: { table: string; returned: number }[] = []
  const client = {
    requests,
    from(table: string) {
      const filters: ((r: Record<string, unknown>) => boolean)[] = []
      let range: [number, number] = [0, Infinity]
      let withCount = false
      const builder = {
        select(_cols: string, opts?: { count?: string }) { withCount = opts?.count === "exact"; return builder },
        eq(col: string, v: unknown) { filters.push(r => r[col] === v); return builder },
        gte(col: string, v: string) { filters.push(r => String(r[col]) >= v); return builder },
        lt(col: string, v: string) { filters.push(r => String(r[col]) < v); return builder },
        order() { return builder },
        range(from: number, to: number) { range = [from, to]; return builder },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          const matched = ((tables[table] ?? []) as Record<string, unknown>[]).filter(r => filters.every(f => f(r)))
          const [from, to] = range
          const data = matched.slice(from, Math.min(to + 1, from + cap))
          requests.push({ table, returned: data.length })
          return Promise.resolve({ data, error: null, count: withCount ? matched.length : null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  return client
}
