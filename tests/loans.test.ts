import { describe, it, expect } from "vitest"
import type { PayRecord } from "@/lib/budget"
import {
  outstanding, isForgiven, writtenOffAmount, recoveredAmount, loanTotals,
  forgiveLoan, reopenWriteOff, payAgainstWriteOff, type LoanLike,
} from "@/lib/loans"

const loan = (o: Partial<LoanLike>): LoanLike => ({ amount: 1000, amount_paid: 0, paid_history: [], ...o })

describe("forgiving a loan", () => {
  it("closes what's left with an entry linked to its expense/income", () => {
    const l = loan({ amount_paid: 250, paid_history: [{ amount: 250, date: "2026-09-01" }] })
    const next = forgiveLoan(l, "2026-11-02", "R1")
    expect(next.forgiven).toBe(750)
    expect(next.amount_paid).toBe(1000)
    expect(next.paid_history.at(-1)).toEqual({ amount: 750, date: "2026-11-02", written_off: true, record_id: "R1" })
    const after = { ...l, ...next }
    expect(isForgiven(after)).toBe(true)
    expect(outstanding(after)).toBe(0)              // out of what's owed
    expect(writtenOffAmount(after)).toBe(750)
  })

  it("undo makes the amount owed again", () => {
    const l = loan({ amount_paid: 1000, paid_history: [{ amount: 250, date: "2026-09-01" }, { amount: 750, date: "2026-11-02", written_off: true, record_id: "R1" }] })
    const after = { ...l, ...reopenWriteOff(l) }
    expect(isForgiven(after)).toBe(false)
    expect(outstanding(after)).toBe(750)
  })

  it("money back after forgiving is a recovered payment; fully repaid is no longer forgiven", () => {
    const l = loan({ amount_paid: 1000, paid_history: [{ amount: 1000, date: "2026-10-01", written_off: true, record_id: "R1" }] })
    const part = { ...l, paid_history: payAgainstWriteOff(l, 400, "2026-10-20", "R1").paid_history }
    expect(writtenOffAmount(part)).toBe(600)
    expect(recoveredAmount(part)).toBe(400)
    expect(isForgiven(part)).toBe(true)
    const full = { ...part, paid_history: payAgainstWriteOff(part, 600, "2026-10-25", "R1").paid_history }
    expect(isForgiven(full)).toBe(false)
    expect(recoveredAmount(full)).toBe(1000)
    expect(outstanding(full)).toBe(0)
  })

  it("Finances totals: forgiven loans are out of the net and reported separately", () => {
    const off = (amount: number): PayRecord[] => [{ amount, date: "2026-10-01", written_off: true }]
    const debts = [loan({ amount: 500 }), loan({ amount: 300, amount_paid: 300, paid_history: off(300) })]
    const lendings = [loan({ amount: 2000, amount_paid: 500 }), loan({ amount: 900, amount_paid: 900, paid_history: off(900) })]
    expect(loanTotals(debts, lendings)).toEqual({
      youOwe: 500, owedToYou: 1500, net: 1000,
      forgivenYouOwe: 300, forgivenDebtCount: 1,
      forgivenOwedToYou: 900, forgivenLendCount: 1,
    })
  })
})
