// Shared rules for debts and lendings, so Finances, the sidebar and Insights
// agree on what is owed.

import { dayKey } from "./dates"
import type { PayRecord } from "./budget"

export interface LoanLike {
  amount: number
  amount_paid: number
  paid_history: PayRecord[] | null
  forgiven_at?: string | null
}

export const outstanding = (l: LoanLike) => Math.max(0, Number(l.amount) - Number(l.amount_paid))

/** Marked forgiven and still unpaid: kept on record, left out of totals */
export const isForgiven = (l: LoanLike) => !!l.forgiven_at && outstanding(l) > 0

/** The unpaid part that still counts toward what's owed */
export const counted = (l: LoanLike) => isForgiven(l) ? 0 : outstanding(l)

/** Real payments (not old write-offs) made on or after the day it was forgiven */
export function paidAfterForgiving(l: LoanLike) {
  if (!l.forgiven_at) return 0
  const from = dayKey(l.forgiven_at)
  return (l.paid_history ?? [])
    .filter(p => !p.written_off && p.date >= from)
    .reduce((s, p) => s + Number(p.amount), 0)
}

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

/** Totals for the Finances page: forgiven amounts are reported separately */
export function loanTotals(debts: LoanLike[], lendings: LoanLike[]) {
  const youOwe = sum(debts, counted), owedToYou = sum(lendings, counted)
  const fDebts = debts.filter(isForgiven), fLend = lendings.filter(isForgiven)
  return {
    youOwe, owedToYou, net: owedToYou - youOwe,
    forgivenYouOwe: sum(fDebts, outstanding), forgivenDebtCount: fDebts.length,
    forgivenOwedToYou: sum(fLend, outstanding), forgivenLendCount: fLend.length,
  }
}
