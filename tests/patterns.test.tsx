// The extra money analytics: weekday/weekend, big purchases, regular expenses,
// savings cover, spending pace and income per month — against reference maths.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { setUserTimeZone } from "@/lib/dates"
import { formatMoney } from "@/lib/formatMoney"
import { resolvePeriod, moneyAnalytics, moneyInsights, type MoneyInput } from "@/lib/analytics"
import { MoneyView } from "@/components/stats/MoneyTab"
import { moneyFixture, daysFrom } from "./fixtures"

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-27T09:00:00Z"))   // Oct 27 in Addis Ababa
  setUserTimeZone("Africa/Addis_Ababa")
})
afterAll(() => { vi.useRealTimers(); setUserTimeZone(null) })

const D = moneyFixture()
const money = (v: number) => `ETB ${formatMoney(v)}`
const sum = (xs: { amount: number }[]) => xs.reduce((s, e) => s + e.amount, 0)
const isWeekend = (d: string) => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay())
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const oct = D.expenses.filter(e => e.date.startsWith("2026-10"))

describe("patterns (This month)", () => {
  // Computed after the fake clock is set (describe bodies run before beforeAll)
  let a: ReturnType<typeof moneyAnalytics>
  beforeAll(() => { a = moneyAnalytics(resolvePeriod("month"), D) })

  it("weekday vs weekend average per day, over the days elapsed", () => {
    const days = daysFrom("2026-10-01", "2026-10-27")
    const spentOn = (d: string) => sum(oct.filter(e => e.date === d))
    const wk = days.filter(d => !isWeekend(d)), we = days.filter(isWeekend)
    expect(a.patterns.weekdayDays).toBe(wk.length)
    expect(a.patterns.weekendDays).toBe(we.length)
    expect(a.patterns.weekdayAvg!).toBeCloseTo(wk.reduce((s, d) => s + spentOn(d), 0) / wk.length, 6)
    expect(a.patterns.weekendAvg!).toBeCloseTo(we.reduce((s, d) => s + spentOn(d), 0) / we.length, 6)
  })

  it("big purchases are at least 3× the typical expense", () => {
    const threshold = median(oct.map(e => e.amount)) * 3
    const big = oct.filter(e => e.amount >= threshold)
    expect(a.patterns.big.threshold).toBeCloseTo(threshold, 6)
    expect(a.patterns.big.count).toBe(big.length)
    if (big.length) expect(a.patterns.big.share!).toBeCloseTo((sum(big) / sum(oct)) * 100, 6)
  })

  it("regular expenses: reasons in at least 3 of the last 6 months", () => {
    const window = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
    const ref = new Map<string, { months: Set<string>; total: number }>()
    for (const e of D.expenses) {
      if (!e.description || !window.includes(e.date.slice(0, 7))) continue
      const r = ref.get(e.description) ?? { months: new Set<string>(), total: 0 }
      r.months.add(e.date.slice(0, 7)); r.total += e.amount; ref.set(e.description, r)
    }
    const expected = [...ref.entries()].filter(([, r]) => r.months.size >= 3)
    expect(a.regulars.map(r => r.label).sort()).toEqual(expected.map(([k]) => k).sort())
    for (const r of a.regulars) {
      const x = ref.get(r.label)!
      expect(r.months).toBe(x.months.size)
      expect(r.perMonth).toBeCloseTo(x.total / x.months.size, 6)
    }
    expect(a.regulars.map(r => r.perMonth)).toEqual([...a.regulars.map(r => r.perMonth)].sort((x, y) => y - x))
  })

  it("savings cover: net divided by the daily average", () => {
    const earned = sum(D.incomes.filter(i => i.date.startsWith("2026-10")))
    const net = earned - sum(oct)
    expect(a.patterns.coverDays === null).toBe(net <= 0)
    if (net > 0) expect(a.patterns.coverDays!).toBeCloseTo(net / (sum(oct) / 27), 6)
  })

  it("pace: running totals day by day, this month to today vs all of last month", () => {
    expect(a.pace).toHaveLength(31)                                  // October has 31 days, September 30
    expect(a.pace[26].day).toBe("2026-10-27")
    expect(a.pace[26].current!).toBeCloseTo(sum(oct.filter(e => e.date <= "2026-10-27")), 6)
    expect(a.pace[27].current).toBeNull()                            // tomorrow hasn't happened
    expect(a.pace[29].previous!).toBeCloseTo(sum(D.expenses.filter(e => e.date.startsWith("2026-09"))), 6)
    expect(a.pace[30].previous).toBeNull()                           // September has no 31st
    for (let i = 1; i < 27; i++) expect(a.pace[i].current!).toBeGreaterThanOrEqual(a.pace[i - 1].current!)
  })
})

describe("income per month", () => {
  it("averages over the months in the period", () => {
    const a = moneyAnalytics(resolvePeriod("3m"), D)
    const inc = D.incomes.filter(i => i.date >= "2026-08-01" && i.date <= "2026-10-31")
    expect(a.income.avgPerMonth).toBeCloseTo(sum(inc) / 3, 6)
    expect(a.income).toMatchObject({ months: 3, of: 3 })
  })
})

describe("insights", () => {
  it("shows up to five, and calls out weekend-heavy spending", () => {
    // Spending only on weekends: Sat Oct 3, Sun Oct 4 (and a little on a weekday)
    const quiet: MoneyInput = {
      ...D, defaults: [], debts: [], lendings: [], plans: [],
      expenses: [
        { amount: 900, category: "Food & Drinks", date: "2026-10-03", description: "Brunch" },
        { amount: 800, category: "Entertainment", date: "2026-10-04", description: "Cinema" },
        { amount: 20, category: "Coffee", date: "2026-10-07", description: "Coffee" },
      ],
    }
    const a = moneyAnalytics(resolvePeriod("month"), quiet)
    const texts = moneyInsights(a, resolvePeriod("month"), money).map(i => i.text)
    expect(texts.some(t => t.includes("more per day on weekends"))).toBe(true)
    expect(moneyInsights(moneyAnalytics(resolvePeriod("month"), D), resolvePeriod("month"), money).length).toBeLessThanOrEqual(5)
  })
})

describe("Money tab cards", () => {
  const cards = (html: string) => {
    const out: Record<string, string> = {}
    for (const m of html.matchAll(/data-stat="([^"]+)"[\s\S]*?data-value="true"[^>]*>([^<]*)</g)) out[m[1]] = m[2]
    return out
  }

  it("Patterns, pace and income show the computed values", () => {
    const a = moneyAnalytics(resolvePeriod("3m"), D)
    const html = renderToStaticMarkup(<MoneyView data={D} period={resolvePeriod("3m")} currency="ETB" />)
    const c = cards(html)
    expect(c["Weekday average"]).toBe(money(a.patterns.weekdayAvg!))
    expect(c["Weekend average"]).toBe(money(a.patterns.weekendAvg!))
    expect(c["Big purchases"]).toBe(a.patterns.big.count > 0 ? String(a.patterns.big.count) : "None")
    expect(c["Income per month"]).toBe(money(a.income.avgPerMonth))
    expect(html).toContain("Spending pace")
    expect(html).toContain("Previous period")                         // comparison line in the legend
    expect(html).toContain("Regular expenses")
  })
})
