// Expense search: stats for what matches, checked against plain reference sums.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { setUserTimeZone } from "@/lib/dates"
import { formatMoney } from "@/lib/formatMoney"
import { resolvePeriod, periodForData, searchExpenses, type PeriodKey } from "@/lib/analytics"
import SpendingSearch from "@/components/stats/SpendingSearch"
import { moneyFixture } from "./fixtures"

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-27T09:00:00Z"))
  setUserTimeZone("Africa/Addis_Ababa")
})
afterAll(() => { vi.useRealTimers(); setUserTimeZone(null) })

const D = moneyFixture()
const money = (v: number) => `ETB ${formatMoney(v)}`
const sum = (xs: { amount: number }[]) => xs.reduce((s, e) => s + e.amount, 0)
const RANGE: Partial<Record<PeriodKey, [string, string]>> = {
  "month": ["2026-10-01", "2026-10-31"],
  "3m":    ["2026-08-01", "2026-10-31"],
  "all":   ["2024-03-01", "2026-10-31"],
}
const period = (k: PeriodKey) => periodForData(resolvePeriod(k), D.expenses.map(e => e.date))
const inR = (d: string, [a, b]: [string, string]) => d >= a && d <= b

describe("searchExpenses", () => {
  it.each(["month", "3m", "all"] as PeriodKey[])("%s: “lunch” matches descriptions, case-insensitively", key => {
    const r = searchExpenses(period(key), D.expenses, { query: "  LUNCH ", category: null })
    const ref = D.expenses.filter(e => e.description === "Lunch" && inR(e.date, RANGE[key]!))
    const periodSpent = sum(D.expenses.filter(e => inR(e.date, RANGE[key]!)))
    expect(r.count).toBe(ref.length)
    expect(r.total).toBeCloseTo(sum(ref), 6)
    expect(r.avg).toBeCloseTo(sum(ref) / ref.length, 6)
    expect(r.share!).toBeCloseTo((sum(ref) / periodSpent) * 100, 6)
    expect(r.max).toBe(Math.max(...ref.map(e => e.amount)))
    expect(r.min).toBe(Math.min(...ref.map(e => e.amount)))
    const days = [...new Set(ref.map(e => e.date))].sort()
    expect(r.first).toBe(days[0])
    expect(r.last).toBe(days.at(-1))
    expect(r.everyDays!).toBeCloseTo(
      (Date.parse(days.at(-1)!) - Date.parse(days[0])) / 86400000 / (days.length - 1), 6)
    expect(r.matches[0].date >= r.matches.at(-1)!.date).toBe(true)        // newest first
    expect(r.elsewhere).toBe(D.expenses.filter(e => e.description === "Lunch").length - ref.length)
    expect(r.byCategory.reduce((s, c) => s + c.total, 0)).toBeCloseTo(sum(ref), 6)
  })

  it("compares with the same point in the previous period", () => {
    const r = searchExpenses(period("month"), D.expenses, { query: "taxi", category: null })
    expect(r.prevTotal).toBeCloseTo(sum(D.expenses.filter(e => e.description === "Taxi" && inR(e.date, ["2026-09-01", "2026-09-27"]))), 6)
  })

  it("filters by category alone, and by text within a category", () => {
    const cat = searchExpenses(period("month"), D.expenses, { query: "", category: "Coffee" })
    expect(cat.total).toBeCloseTo(sum(D.expenses.filter(e => e.category === "Coffee" && inR(e.date, RANGE.month!))), 6)
    const both = searchExpenses(period("month"), D.expenses, { query: "latte", category: "Coffee" })
    expect(both.count).toBe(D.expenses.filter(e => e.category === "Coffee" && e.description === "Latte" && inR(e.date, RANGE.month!)).length)
  })

  it("matches the category name too", () => {
    const r = searchExpenses(period("month"), D.expenses, { query: "transp", category: null })
    expect(r.count).toBe(D.expenses.filter(e => (e.category === "Transport" || /transp/i.test(e.description ?? "")) && inR(e.date, RANGE.month!)).length)
  })

  it("nothing matching", () => {
    const r = searchExpenses(period("all"), D.expenses, { query: "zzz", category: null })
    expect(r).toMatchObject({ count: 0, total: 0, first: null, everyDays: null, elsewhere: 0 })
  })
})

describe("search UI", () => {
  const cards = (html: string) => {
    const out: Record<string, string> = {}
    for (const m of html.matchAll(/data-stat="([^"]+)"[\s\S]*?data-value="true"[^>]*>([^<]*)</g)) out[m[1]] = m[2]
    return out
  }

  it("shows the stats for what matches", () => {
    const p = period("month")
    const html = renderToStaticMarkup(<SpendingSearch expenses={D.expenses} period={p} currency="ETB" initialQuery="lunch" />)
    const r = searchExpenses(p, D.expenses, { query: "lunch", category: null })
    const c = cards(html)
    expect(c["Search total"]).toBe(money(r.total))
    expect(c["Average"]).toBe(money(r.avg))
    expect(c["Range"]).toBe(`${formatMoney(r.min)} – ${formatMoney(r.max)}`)
    expect(html).toContain(`${r.count} expenses`)
    expect(html).toContain("Clear search")
  })

  it("an empty result says so and points to other periods", () => {
    const may = [{ amount: 120, category: "Food & Drinks", date: "2026-05-04", description: "Lunch" }]
    const html = renderToStaticMarkup(<SpendingSearch expenses={may} period={resolvePeriod("month")} currency="ETB" initialQuery="lunch" />)
    expect(html).toContain("No expenses match")
    expect(html).toContain("1 match in other periods")
    expect(html).not.toContain("Search total")
  })

  it("shows nothing extra until you search", () => {
    const html = renderToStaticMarkup(<SpendingSearch expenses={D.expenses} period={period("month")} currency="ETB" />)
    expect(html).not.toContain("Search total")
    expect(html).not.toContain("Clear search")
  })
})
