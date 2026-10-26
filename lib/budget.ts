import { todayStr } from "./dates"

// Months are "YYYY-MM" keys; DB rows store the first day ("YYYY-MM-01").

export interface PayRecord { amount: number; date: string; written_off?: boolean }
export interface LoanRecord { amount: number; date: string; paid_history: PayRecord[] | null }

export const currentMonth = () => todayStr().slice(0, 7)

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** [first day, first day of next month) — use with .gte() / .lt() */
export const monthRange = (month: string): [string, string] => [`${month}-01`, `${shiftMonth(month, 1)}-01`]

export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })

/** Days remaining in the month, counting today. 0 for past months. */
export function daysLeftInMonth(month: string) {
  const cur = currentMonth()
  if (month < cur) return 0
  const [y, m] = month.split("-").map(Number)
  const days = new Date(y, m, 0).getDate()
  return month > cur ? days : days - new Date().getDate() + 1
}

/** Month override wins; otherwise the default limit from expense_budgets. */
export function effectiveLimits(
  defaults: { category: string; monthly_limit: number }[],
  overrides: { category: string; amount: number }[],
) {
  const limits: Record<string, number> = {}
  for (const d of defaults)  limits[d.category] = Number(d.monthly_limit)
  for (const o of overrides) limits[o.category] = Number(o.amount)
  return limits
}

export function spentByCategory(expenses: { amount: number; category: string }[]) {
  const spent: Record<string, number> = {}
  for (const e of expenses) spent[e.category] = (spent[e.category] ?? 0) + Number(e.amount)
  return spent
}

export const overBudgetCount = (limits: Record<string, number>, spent: Record<string, number>) =>
  Object.entries(limits).filter(([cat, limit]) => (spent[cat] ?? 0) > limit).length

/**
 * Cash moved by loans during the month. Kept separate from income/expenses:
 * borrowing isn't earning and lending isn't spending. Written-off amounts never
 * moved cash, so they're excluded (the write-off itself is recorded as an
 * expense or income instead).
 */
export function loanFlows(debts: LoanRecord[], lendings: LoanRecord[], month: string) {
  const inMonth = (d: string | null | undefined) => d?.slice(0, 7) === month
  const created = (list: LoanRecord[]) => list.filter(l => inMonth(l.date)).reduce((s, l) => s + Number(l.amount), 0)
  const paid = (list: LoanRecord[]) => list.reduce((s, l) =>
    s + (l.paid_history ?? []).filter(p => !p.written_off && inMonth(p.date)).reduce((t, p) => t + Number(p.amount), 0), 0)

  const borrowed  = created(debts)
  const repaid    = paid(debts)
  const lent      = created(lendings)
  const collected = paid(lendings)
  return { borrowed, repaid, lent, collected, moneyIn: borrowed + collected, moneyOut: lent + repaid }
}
