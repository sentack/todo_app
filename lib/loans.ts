// Shared rules for debts and lendings, so Finances, the sidebar and Insights
// agree on what is owed.
//
// Forgiving a loan closes its unpaid part with a `written_off` entry in
// paid_history and records that amount as an expense (lending) or income
// (debt) on the day the loan was made — `record_id` links to that row. If
// money comes back later it is recorded as a `recovered` payment and the
// forgiven amount (and its record) shrink by the same amount.

import type { PayRecord } from "./budget"

export interface LoanLike {
  amount: number
  amount_paid: number
  paid_history: PayRecord[] | null
}

const round2 = (v: number) => Math.round(v * 100) / 100
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

/** Still owed. Forgiven loans are closed, so they owe nothing */
export const outstanding = (l: LoanLike) => Math.max(0, Number(l.amount) - Number(l.amount_paid))

/** Amount forgiven (closed and recorded as an expense/income) */
export const writtenOffAmount = (l: LoanLike) =>
  round2(sum((l.paid_history ?? []).filter(p => p.written_off), p => Number(p.amount)))

export const isForgiven = (l: LoanLike) => writtenOffAmount(l) > 0

/** Money that came back after the loan was forgiven */
export const recoveredAmount = (l: LoanLike) =>
  round2(sum((l.paid_history ?? []).filter(p => p.recovered), p => Number(p.amount)))

/** Totals for the Finances page; forgiven amounts are reported separately */
export function loanTotals(debts: LoanLike[], lendings: LoanLike[]) {
  const youOwe = sum(debts, outstanding), owedToYou = sum(lendings, outstanding)
  const fDebts = debts.filter(isForgiven), fLend = lendings.filter(isForgiven)
  return {
    youOwe, owedToYou, net: owedToYou - youOwe,
    forgivenYouOwe: sum(fDebts, writtenOffAmount), forgivenDebtCount: fDebts.length,
    forgivenOwedToYou: sum(fLend, writtenOffAmount), forgivenLendCount: fLend.length,
  }
}

/** Ids of the expense/income rows the forgiven amount was recorded as, where linked */
export const writeOffRecordIds = (l: LoanLike) =>
  (l.paid_history ?? []).filter(p => p.written_off && p.record_id).map(p => p.record_id!)

/** Forgive what's left: close the loan with a written-off entry linked to its record */
export function forgiveLoan(l: LoanLike, date: string, recordId: string | null) {
  const left = round2(outstanding(l))
  return {
    amount_paid: Number(l.amount),
    paid_history: [...(l.paid_history ?? []), { amount: left, date, written_off: true, record_id: recordId }],
    forgiven: left,
  }
}

/** Undo forgiving: drop the written-off entry so the amount is owed again */
export function reopenWriteOff(l: LoanLike) {
  return {
    paid_history: (l.paid_history ?? []).filter(p => !p.written_off),
    amount_paid: round2(Number(l.amount_paid) - writtenOffAmount(l)),
  }
}

/**
 * Money back on a forgiven loan: that much stops being forgiven and becomes a
 * real (recovered) payment. The loan stays settled. `writtenOffLeft` is what
 * the linked expense/income should shrink to (0 = delete it).
 */
export function payAgainstWriteOff(l: LoanLike, amount: number, date: string, recordId: string | null) {
  const off = writtenOffAmount(l)
  const pay = round2(Math.min(amount, off))
  const left = round2(off - pay)
  const history = l.paid_history ?? []
  const firstOff = history.find(p => p.written_off)
  return {
    paid_history: [
      ...history.filter(p => !p.written_off),
      ...(left > 0 ? [{ amount: left, date: firstOff?.date ?? date, written_off: true, record_id: recordId }] : []),
      { amount: pay, date, recovered: true },
    ],
    writtenOffLeft: left,
  }
}
