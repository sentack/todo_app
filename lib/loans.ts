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

// ── Old write-offs ───────────────────────────────────────────────────
// The old "write off" closed a loan and recorded the unpaid part as an
// expense (lending) or income (debt). These undo it, fully or partly.

const round2 = (v: number) => Math.round(v * 100) / 100

/** Amount closed by the old write-off */
export const writtenOffAmount = (l: LoanLike) =>
  round2(sum((l.paid_history ?? []).filter(p => p.written_off), p => Number(p.amount)))

/** Ids of the expense/income rows the write-off created, where linked */
export const writeOffRecordIds = (l: LoanLike) =>
  (l.paid_history ?? []).filter(p => p.written_off && p.record_id).map(p => p.record_id!)

/** Reopen: drop the write-off so the amount is owed again */
export function reopenWriteOff(l: LoanLike) {
  return {
    paid_history: (l.paid_history ?? []).filter(p => !p.written_off),
    amount_paid: round2(Number(l.amount_paid) - writtenOffAmount(l)),
  }
}

/**
 * A payment on a written-off loan: that much stops being written off and
 * becomes a real payment. The loan stays fully settled. `writtenOffLeft` is
 * what the linked expense/income should shrink to (0 = delete it).
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
      { amount: pay, date },
    ],
    writtenOffLeft: left,
  }
}
