import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { setUserTimeZone } from "@/lib/dates"
import { outstanding, isForgiven, counted, paidAfterForgiving, loanTotals, type LoanLike } from "@/lib/loans"

beforeAll(() => setUserTimeZone("Africa/Addis_Ababa"))
afterAll(() => setUserTimeZone(null))

const loan = (o: Partial<LoanLike>): LoanLike => ({ amount: 1000, amount_paid: 0, paid_history: [], forgiven_at: null, ...o })

describe("forgiven loans", () => {
  it("an unpaid forgiven loan is kept but not counted", () => {
    const l = loan({ forgiven_at: "2026-10-01T09:00:00Z" })
    expect(isForgiven(l)).toBe(true)
    expect(outstanding(l)).toBe(1000)
    expect(counted(l)).toBe(0)
  })

  it("a forgiven loan that gets fully repaid is just paid", () => {
    const l = loan({ amount_paid: 1000, paid_history: [{ amount: 1000, date: "2026-10-20" }], forgiven_at: "2026-10-01T09:00:00Z" })
    expect(isForgiven(l)).toBe(false)
    expect(counted(l)).toBe(0)
    expect(paidAfterForgiving(l)).toBe(1000)
  })

  it("only payments from the forgiving day on count as recovered (in the user's timezone)", () => {
    // 22:30 UTC on Sep 30 is already Oct 1 in Addis Ababa
    const l = loan({
      amount_paid: 600, forgiven_at: "2026-09-30T22:30:00Z",
      paid_history: [{ amount: 200, date: "2026-09-30" }, { amount: 300, date: "2026-10-01" }, { amount: 100, date: "2026-10-09" }],
    })
    expect(paidAfterForgiving(l)).toBe(400)
    expect(counted(l)).toBe(0)
  })

  it("old write-off entries never count as money that came back", () => {
    const l = loan({ amount_paid: 1000, forgiven_at: "2026-10-01T09:00:00Z", paid_history: [{ amount: 1000, date: "2026-10-05", written_off: true }] })
    expect(paidAfterForgiving(l)).toBe(0)
  })

  it("unforgiving restores the amount to the totals", () => {
    const l = loan({ amount_paid: 250, forgiven_at: null })
    expect(isForgiven(l)).toBe(false)
    expect(counted(l)).toBe(750)
  })

  it("Finances totals leave forgiven amounts out of the net and report them separately", () => {
    const debts = [loan({ amount: 500 }), loan({ amount: 300, forgiven_at: "2026-10-01T09:00:00Z" })]
    const lendings = [loan({ amount: 2000, amount_paid: 500 }), loan({ amount: 900, forgiven_at: "2026-10-01T09:00:00Z" })]
    expect(loanTotals(debts, lendings)).toEqual({
      youOwe: 500, owedToYou: 1500, net: 1000,
      forgivenYouOwe: 300, forgivenDebtCount: 1,
      forgivenOwedToYou: 900, forgivenLendCount: 1,
    })
  })
})
