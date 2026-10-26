// Analytics for the Stats page. Pure functions over rows already loaded, so
// switching periods is instant. Days are date keys in the user's timezone
// (see lib/dates.ts); timestamps go through dayKey().

import { todayStr, addDays, dayKey } from "./dates"
import { currentMonth, shiftMonth, monthLabel, effectiveLimits, spentByCategory, type LoanRecord, type PayRecord } from "./budget"

const DAY_MS = 86400000

// ─── Periods ─────────────────────────────────────────────────────────

export type PeriodKey = "month" | "last-month" | "3m" | "6m" | "12m"

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month",      label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "3m",         label: "3M" },
  { key: "6m",         label: "6M" },
  { key: "12m",        label: "12M" },
]

export const isPeriodKey = (v: string | null): v is PeriodKey => PERIODS.some(p => p.key === v)

export interface Period {
  key: PeriodKey
  label: string        // "October 2026", "Last 3 months"
  start: string        // first day, inclusive
  end: string          // day after the last, exclusive
  months: string[]     // month keys covered, oldest first
  prevStart: string    // comparison period: same length, ending at the same point
  prevEnd: string
  compareLabel: string // "vs same point last month"
  days: number         // days covered (to today for periods still running)
  toDate: boolean      // still running
}

export const daysBetween = (a: string, b: string) => {
  const t = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((t(b) - t(a)) / DAY_MS)
}

/** Shift a date key by whole months, clamping the day (Mar 31 → Feb 28). */
export function shiftDate(key: string, months: number) {
  const m = shiftMonth(key.slice(0, 7), months)
  const [y, mo] = m.split("-").map(Number)
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return `${m}-${String(Math.min(Number(key.slice(8, 10)), dim)).padStart(2, "0")}`
}

export function resolvePeriod(key: PeriodKey): Period {
  const cur = currentMonth()
  const tomorrow = addDays(todayStr(), 1)
  const n = key === "3m" ? 3 : key === "6m" ? 6 : key === "12m" ? 12 : 1
  const lastMonth = key === "last-month" ? shiftMonth(cur, -1) : cur
  const months = Array.from({ length: n }, (_, i) => shiftMonth(lastMonth, i - (n - 1)))
  const start = `${months[0]}-01`
  const toDate = key !== "last-month"
  const end = toDate ? tomorrow : `${cur}-01`
  return {
    key, months, start, end, toDate,
    label: n === 1 ? monthLabel(lastMonth) : `Last ${n} months`,
    prevStart: shiftDate(start, -n),
    prevEnd: toDate ? shiftDate(end, -n) : start,
    compareLabel: key === "month" ? "vs same point last month" : key === "last-month" ? "vs the month before" : `vs previous ${n} months`,
    days: daysBetween(start, end),
  }
}

const inRange = (d: string, start: string, end: string) => d >= start && d < end

// ─── Shared helpers ──────────────────────────────────────────────────

export type Tone = "good" | "bad" | "warn" | "info"
export interface Insight { tone: Tone; text: string; href?: string }
export interface Delta { text: string; tone: Tone | "neutral" }

const total = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0)

/** % change, or null when there's nothing to compare against */
export const pctChange = (now: number, prev: number) => prev > 0 ? ((now - prev) / prev) * 100 : null

/** Delta chip for a value where `upIsGood` says which direction is good */
export function deltaOf(now: number, prev: number, upIsGood: boolean, compareLabel: string): Delta | undefined {
  const pct = pctChange(now, prev)
  if (pct === null) return undefined
  const r = Math.round(pct)
  if (r === 0) return { text: `No change ${compareLabel}`, tone: "neutral" }
  return { text: `${r > 0 ? "▲" : "▼"} ${Math.abs(r)}% ${compareLabel}`, tone: (r > 0) === upIsGood ? "good" : "bad" }
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Monday on or before a date key */
const weekStart = (k: string) => {
  const [y, m, d] = k.split("-").map(Number)
  return addDays(k, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7))
}

const shortDay  = (k: string) => new Date(k + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
const shortMon  = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" })
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** Time buckets for a period: weeks up to 3 months, months beyond */
function buckets(period: Period) {
  if (period.months.length > 3) {
    return period.months.map(m => ({ key: m, label: shortMon(m), start: `${m}-01`, end: `${shiftMonth(m, 1)}-01` }))
  }
  const out: { key: string; label: string; start: string; end: string }[] = []
  for (let w = weekStart(period.start); w < period.end; w = addDays(w, 7)) {
    // Clip the first/last week to the period so nothing outside it is counted
    const start = w < period.start ? period.start : w
    const next = addDays(w, 7)
    out.push({ key: w, label: shortDay(start), start, end: next > period.end ? period.end : next })
  }
  return out
}

/** Consecutive days with activity ending today (or yesterday), and the longest run */
function streaks(days: Set<string>) {
  const sorted = [...days].sort()
  let longest = 0, run = 0
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  const today = todayStr()
  let cursor = days.has(today) ? today : addDays(today, -1), current = 0
  while (days.has(cursor)) { current++; cursor = addDays(cursor, -1) }
  return { current, longest }
}

// ─── Money ───────────────────────────────────────────────────────────

export interface ExpenseRow { amount: number; category: string; date: string; description: string | null }
export interface IncomeRow  { amount: number; source: string; date: string }
export interface LoanRow extends LoanRecord { amount_paid: number; deadline: string | null; person: string }

export interface MoneyInput {
  expenses: ExpenseRow[]
  incomes: IncomeRow[]
  defaults: { category: string; monthly_limit: number }[]
  overrides: { month: string; category: string; amount: number }[]   // month = YYYY-MM-01
  plans: { month: string; expected_income: number }[]
  debts: LoanRow[]
  lendings: LoanRow[]
}

const outstanding = (l: LoanRow) => Math.max(0, Number(l.amount) - Number(l.amount_paid))
const realPayments = (l: LoanRow) => (l.paid_history ?? []).filter((p: PayRecord) => !p.written_off)
const writtenOff = (l: LoanRow) => total((l.paid_history ?? []).filter((p: PayRecord) => p.written_off), p => Number(p.amount))

export function moneyAnalytics(period: Period, d: MoneyInput) {
  const today = todayStr()
  const exp     = d.expenses.filter(e => inRange(e.date, period.start, period.end))
  const expPrev = d.expenses.filter(e => inRange(e.date, period.prevStart, period.prevEnd))
  const inc     = d.incomes.filter(i => inRange(i.date, period.start, period.end))
  const incPrev = d.incomes.filter(i => inRange(i.date, period.prevStart, period.prevEnd))

  const spent = total(exp, e => Number(e.amount)), spentPrev = total(expPrev, e => Number(e.amount))
  const earned = total(inc, i => Number(i.amount)), earnedPrev = total(incPrev, i => Number(i.amount))
  const net = earned - spent
  const savingsRate     = earned > 0 ? (net / earned) * 100 : null
  const savingsRatePrev = earnedPrev > 0 ? ((earnedPrev - spentPrev) / earnedPrev) * 100 : null

  // Projection only makes sense while the current month is running
  let projected: number | null = null
  if (period.key === "month") {
    const day = Number(today.slice(8, 10))
    const [y, m] = period.months[0].split("-").map(Number)
    projected = (spent / day) * new Date(Date.UTC(y, m, 0)).getUTCDate()
  }

  // Budget adherence per (month, category). expense_budgets has no history,
  // so today's defaults apply to past months too.
  const budgetRows: { month: string; category: string; limit: number; spent: number }[] = []
  for (const m of period.months) {
    const limits = effectiveLimits(d.defaults, d.overrides.filter(o => o.month.slice(0, 7) === m))
    const spentM = spentByCategory(exp.filter(e => e.date.slice(0, 7) === m))
    for (const [category, limit] of Object.entries(limits)) budgetRows.push({ month: m, category, limit, spent: spentM[category] ?? 0 })
  }
  const kept = budgetRows.filter(r => r.spent <= r.limit).length
  // Over-budget categories, summed over the period's months
  const overMap = new Map<string, number>()
  for (const r of budgetRows) if (r.spent > r.limit) overMap.set(r.category, (overMap.get(r.category) ?? 0) + r.spent - r.limit)
  const overBudget = [...overMap.entries()].map(([category, over]) => ({ category, over })).sort((a, b) => b.over - a.over)

  // Categories with change vs previous period
  const byCat = spentByCategory(exp), byCatPrev = spentByCategory(expPrev)
  const categories = Object.keys({ ...byCat, ...byCatPrev })
    .map(cat => ({ cat, total: byCat[cat] ?? 0, prev: byCatPrev[cat] ?? 0, change: pctChange(byCat[cat] ?? 0, byCatPrev[cat] ?? 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)

  const bySource: Record<string, number> = {}
  for (const i of inc) bySource[i.source] = (bySource[i.source] ?? 0) + Number(i.amount)
  const sources = Object.entries(bySource).map(([source, t]) => ({ source, total: t })).sort((a, b) => b.total - a.total)

  // Only plans saved for these exact months count — no carry-over in hindsight
  const expected = total(d.plans.filter(p => period.months.includes(p.month.slice(0, 7))), p => Number(p.expected_income))

  // Cash flow: at least 6 months of context, ending with the period's last month
  const chartLen = Math.max(period.months.length, 6)
  const lastM = period.months[period.months.length - 1]
  const cashflow = Array.from({ length: chartLen }, (_, i) => {
    const m = shiftMonth(lastM, i - (chartLen - 1))
    const income   = total(d.incomes.filter(x => x.date.slice(0, 7) === m), x => Number(x.amount))
    const spending = total(d.expenses.filter(x => x.date.slice(0, 7) === m), x => Number(x.amount))
    return { key: m, label: shortMon(m), income, spending, net: income - spending, inPeriod: period.months.includes(m) }
  })

  // Loans: position is "now", flows are within the period
  const owedToYou = total(d.lendings, outstanding), youOwe = total(d.debts, outstanding)
  const overdueLend = d.lendings.filter(l => outstanding(l) > 0 && l.deadline && l.deadline < today)
  const overdueDebt = d.debts.filter(l => outstanding(l) > 0 && l.deadline && l.deadline < today)
  const lentTotal   = total(d.lendings, l => Number(l.amount))
  const collected   = total(d.lendings, l => total(realPayments(l), p => Number(p.amount)))
  const lost        = total(d.lendings, writtenOff)
  const settleDays  = [...d.debts, ...d.lendings]
    .filter(l => outstanding(l) === 0 && realPayments(l).length > 0 && writtenOff(l) === 0)
    .map(l => Math.max(0, daysBetween(l.date, realPayments(l).map(p => p.date).sort().at(-1)!)))
  const flowIn  = total(d.debts.filter(l => inRange(l.date, period.start, period.end)), l => Number(l.amount))
                + total(d.lendings, l => total(realPayments(l).filter(p => inRange(p.date, period.start, period.end)), p => Number(p.amount)))
  const flowOut = total(d.lendings.filter(l => inRange(l.date, period.start, period.end)), l => Number(l.amount))
                + total(d.debts, l => total(realPayments(l).filter(p => inRange(p.date, period.start, period.end)), p => Number(p.amount)))

  const personMap = new Map<string, { name: string; net: number }>()
  for (const [list, sign] of [[d.lendings, 1], [d.debts, -1]] as const) {
    for (const l of list) {
      const k = l.person.trim().toLowerCase()
      const e = personMap.get(k) ?? { name: l.person.trim(), net: 0 }
      e.net += sign * outstanding(l)
      personMap.set(k, e)
    }
  }
  const people = [...personMap.values()].filter(p => Math.abs(p.net) > 0.005).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  // Habits
  const weekdays = WEEKDAYS.map(label => ({ label, value: 0 }))
  for (const e of exp) { const [y, m, dd] = e.date.split("-").map(Number); weekdays[(new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7].value += Number(e.amount) }
  const spendDays = new Set(exp.map(e => e.date))
  const byDay = new Map<string, number>()
  for (const e of exp) byDay.set(e.date, (byDay.get(e.date) ?? 0) + Number(e.amount))
  const biggestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const descMap = new Map<string, { label: string; total: number; count: number }>()
  for (const e of exp) {
    const label = e.description?.trim() || e.category
    const k = label.toLowerCase()
    const x = descMap.get(k) ?? { label, total: 0, count: 0 }
    x.total += Number(e.amount); x.count++
    descMap.set(k, x)
  }
  const lastSpend = d.expenses.reduce((mx, e) => e.date <= today && e.date > mx ? e.date : mx, "")

  return {
    earned, earnedPrev, spent, spentPrev, net, savingsRate, savingsRatePrev,
    avgPerDay: period.days > 0 ? spent / period.days : 0,
    projected,
    budget: { kept, total: budgetRows.length, overBudget },
    categories, sources, expected, cashflow,
    loans: {
      owedToYou, youOwe, net: owedToYou - youOwe,
      overdueLendAmount: total(overdueLend, outstanding), overdueLendCount: overdueLend.length,
      overdueDebtAmount: total(overdueDebt, outstanding), overdueDebtCount: overdueDebt.length,
      repaymentRate: lentTotal - lost > 0 ? (collected / (lentTotal - lost)) * 100 : null,
      lossRate: lentTotal > 0 ? (lost / lentTotal) * 100 : null,
      avgSettleDays: settleDays.length ? total(settleDays, x => x) / settleDays.length : null,
      flowIn, flowOut, people,
    },
    habits: {
      weekdays,
      noSpendDays: Math.max(0, period.days - spendDays.size),
      daysSinceSpend: lastSpend ? daysBetween(lastSpend, today) : null,
      txCount: exp.length,
      avgTx: exp.length ? spent / exp.length : 0,
      medianTx: median(exp.map(e => Number(e.amount))) ?? 0,
      biggest: [...exp].sort((a, b) => Number(b.amount) - Number(a.amount))[0] ?? null,
      biggestDay: biggestDay ? { date: biggestDay[0], total: biggestDay[1] } : null,
      topDescriptions: [...descMap.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    },
  }
}

export type MoneyAnalytics = ReturnType<typeof moneyAnalytics>

export function moneyInsights(a: MoneyAnalytics, period: Period, money: (v: number) => string): Insight[] {
  const out: (Insight & { rank: number })[] = []
  const prevWord = period.key === "month" || period.key === "last-month" ? "last month" : "the previous period"

  if (a.budget.overBudget.length > 0) {
    const [top, ...rest] = a.budget.overBudget
    out.push({ rank: 0, tone: "bad", href: "/budget", text: `${top.category} went ${money(top.over)} over budget${rest.length ? ` (and ${rest.length} more categor${rest.length === 1 ? "y" : "ies"})` : ""}.` })
  }
  if (a.projected !== null && a.earned > 0 && a.projected > a.earned) {
    out.push({ rank: 1, tone: "bad", href: "/budget", text: `At this pace you'll spend about ${money(a.projected)} this month — more than the ${money(a.earned)} you've earned.` })
  }
  if (a.loans.overdueLendCount > 0) {
    out.push({ rank: 2, tone: "warn", href: "/debts", text: `${a.loans.overdueLendCount} loan${a.loans.overdueLendCount === 1 ? " is" : "s are"} overdue — ${money(a.loans.overdueLendAmount)} owed to you.` })
  }
  if (a.loans.overdueDebtCount > 0) {
    out.push({ rank: 2, tone: "warn", href: "/debts", text: `You're overdue on ${money(a.loans.overdueDebtAmount)} across ${a.loans.overdueDebtCount} debt${a.loans.overdueDebtCount === 1 ? "" : "s"}.` })
  }
  // Biggest category moves that matter (≥25% and ≥5% of spending)
  const movers = a.categories.filter(c => c.change !== null && Math.abs(c.change) >= 25 && Math.abs(c.total - c.prev) >= a.spent * 0.05)
  const up = [...movers].filter(c => c.change! > 0).sort((x, y) => (y.total - y.prev) - (x.total - x.prev))[0]
  const down = [...movers].filter(c => c.change! < 0).sort((x, y) => (x.total - x.prev) - (y.total - y.prev))[0]
  if (up) out.push({ rank: 3, tone: "warn", href: `/expenses?category=${encodeURIComponent(up.cat)}`, text: `You spent ${Math.round(up.change!)}% more on ${up.cat} than ${prevWord}.` })
  if (a.savingsRate !== null && a.savingsRatePrev !== null && Math.abs(a.savingsRate - a.savingsRatePrev) >= 5) {
    const diff = Math.round(a.savingsRate - a.savingsRatePrev)
    out.push({ rank: 4, tone: diff > 0 ? "good" : "warn", text: `Your savings rate is ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} points from ${prevWord}.` })
  }
  if (down) out.push({ rank: 5, tone: "good", text: `${down.cat} spending is down ${Math.abs(Math.round(down.change!))}% from ${prevWord}.` })
  if (a.earned === 0 && a.spent > 0) out.push({ rank: 6, tone: "info", text: "No income recorded for this period — add it to see your savings rate." })

  return out.sort((x, y) => x.rank - y.rank).slice(0, 3).map(({ tone, text, href }) => ({ tone, text, href }))
}

// ─── Todos ───────────────────────────────────────────────────────────

export interface TodoRow {
  id: string; title: string; created_at: string; updated_at: string | null
  completed_at?: string | null; completed: boolean; due_date: string | null
}

/** completed_at when available; updated_at is the fallback before the migration */
const completedAt = (t: TodoRow) => t.completed ? (t.completed_at ?? t.updated_at ?? null) : null

export function todoAnalytics(period: Period, todos: TodoRow[]) {
  const today = todayStr()
  const done = todos.map(t => ({ t, at: completedAt(t) })).filter((x): x is { t: TodoRow; at: string } => !!x.at)
  const doneIn = (s: string, e: string) => done.filter(x => inRange(dayKey(x.at), s, e))

  const completed = doneIn(period.start, period.end)
  const completedPrev = doneIn(period.prevStart, period.prevEnd)
  const created = todos.filter(t => inRange(dayKey(t.created_at), period.start, period.end))

  const withDue = completed.filter(x => x.t.due_date)
  const onTime = withDue.filter(x => dayKey(x.at) <= x.t.due_date!)

  const hours = completed.map(x => (new Date(x.at).getTime() - new Date(x.t.created_at).getTime()) / 3600000).filter(h => h >= 0)

  const open = todos.filter(t => !t.completed)
  const overdue = open.filter(t => t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const oldestOpen = [...open].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 3)
    .map(t => ({ id: t.id, title: t.title, days: daysBetween(dayKey(t.created_at), today) }))

  const chart = buckets(period).map(b => ({
    label: b.label,
    created: todos.filter(t => inRange(dayKey(t.created_at), b.start, b.end)).length,
    completed: done.filter(x => inRange(dayKey(x.at), b.start, b.end)).length,
  }))

  return {
    completed: completed.length, completedPrev: completedPrev.length,
    created: created.length,
    backlogChange: created.length - completed.length,
    onTimeRate: withDue.length ? (onTime.length / withDue.length) * 100 : null,
    onTimeBase: withDue.length,
    medianHours: median(hours),
    openCount: open.length,
    overdue: overdue.map(t => ({ id: t.id, title: t.title, days: daysBetween(t.due_date!, today) })),
    oldestOpen,
    streak: streaks(new Set(done.map(x => dayKey(x.at)))),
    chart,
  }
}

export type TodoAnalytics = ReturnType<typeof todoAnalytics>

export function todoInsights(a: TodoAnalytics): Insight[] {
  const out: Insight[] = []
  if (a.overdue.length > 0) {
    out.push({ tone: "bad", href: "/", text: `${a.overdue.length} todo${a.overdue.length === 1 ? " is" : "s are"} overdue — the oldest by ${a.overdue[0].days} day${a.overdue[0].days === 1 ? "" : "s"}.` })
  }
  if (a.backlogChange > 0 && a.created >= 3) {
    out.push({ tone: "warn", text: `You added ${a.created} todos and finished ${a.completed} — your backlog grew by ${a.backlogChange}.` })
  } else if (a.backlogChange < 0) {
    out.push({ tone: "good", text: `You finished ${a.completed} todos and added ${a.created} — your backlog shrank by ${-a.backlogChange}.` })
  }
  if (a.streak.current >= 2) {
    out.push({ tone: "good", text: `${a.streak.current}-day completion streak${a.streak.current >= a.streak.longest ? " — your best yet" : ""}. Keep it going.` })
  }
  if (a.onTimeRate !== null && a.onTimeBase >= 3 && a.onTimeRate < 60) {
    out.push({ tone: "warn", text: `Only ${Math.round(a.onTimeRate)}% of todos with a due date were finished on time.` })
  }
  return out.slice(0, 3)
}

// ─── Shopping ────────────────────────────────────────────────────────

export type Urgency = "critical" | "high" | "medium" | "low"
export const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"]

export interface ToBuyRow {
  id: string; name: string; quantity: number; price: number; urgency: Urgency
  bought: boolean; created_at: string; bought_at?: string | null; expense_id?: string | null
}

const cost = (i: ToBuyRow) => Number(i.price) * Number(i.quantity)

export function shoppingAnalytics(period: Period, items: ToBuyRow[]) {
  const today = todayStr()
  const pending = items.filter(i => !i.bought)
  const urgent = pending.filter(i => i.urgency === "critical" || i.urgency === "high")
  const boughtIn = (s: string, e: string) => items.filter(i => i.bought && i.bought_at && inRange(dayKey(i.bought_at), s, e))
  const bought = boughtIn(period.start, period.end)
  const boughtPrev = boughtIn(period.prevStart, period.prevEnd)
  const priced = bought.filter(i => cost(i) > 0)
  const buyDays = bought.map(i => daysBetween(dayKey(i.created_at), dayKey(i.bought_at!))).filter(x => x >= 0)

  return {
    hasTimestamps: items.some(i => i.bought_at !== undefined),
    pendingCount: pending.length,
    pendingCost: total(pending, cost),
    urgentCount: urgent.length,
    urgentCost: total(urgent, cost),
    urgentWaiting: urgent.filter(i => daysBetween(dayKey(i.created_at), today) > 7),
    bought: bought.length, boughtPrev: boughtPrev.length,
    boughtCost: total(bought, cost),
    avgDaysToBuy: buyDays.length ? total(buyDays, x => x) / buyDays.length : null,
    loggedRate: priced.length ? (priced.filter(i => i.expense_id).length / priced.length) * 100 : null,
    byUrgency: URGENCIES.map(u => {
      const list = pending.filter(i => i.urgency === u)
      return { urgency: u, count: list.length, cost: total(list, cost) }
    }),
    mostExpensive: [...pending].sort((a, b) => cost(b) - cost(a)).slice(0, 5).map(i => ({ id: i.id, name: i.name, urgency: i.urgency, cost: cost(i) })),
  }
}

export type ShoppingAnalytics = ReturnType<typeof shoppingAnalytics>

export function shoppingInsights(a: ShoppingAnalytics, budgetLeft: number | null, money: (v: number) => string): Insight[] {
  const out: Insight[] = []
  if (budgetLeft !== null && a.pendingCost > 0 && a.pendingCost > budgetLeft) {
    out.push({ tone: "bad", href: "/budget", text: `Your list costs ${money(a.pendingCost)} but only ${money(Math.max(0, budgetLeft))} is left in this month's budget.` })
  }
  if (a.urgentWaiting.length > 0) {
    out.push({ tone: "warn", href: "/to-buy", text: `${a.urgentWaiting.length} urgent item${a.urgentWaiting.length === 1 ? " has" : "s have"} been waiting over a week.` })
  }
  if (a.loggedRate !== null && a.loggedRate < 50 && a.bought >= 3) {
    out.push({ tone: "info", text: `Only ${Math.round(a.loggedRate)}% of bought items were logged as expenses — your spending may be undercounted.` })
  }
  return out.slice(0, 3)
}
