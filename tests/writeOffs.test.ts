// Old write-offs: reopening and paying back keep the expense/income they
// created in step, and cash totals never count the same money twice.

import { describe, it, expect } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { PayRecord } from "@/lib/budget"
import { loanFlows } from "@/lib/budget"
import { writtenOffAmount, reopenWriteOff, payAgainstWriteOff, counted } from "@/lib/loans"
import { reopenWriteOffRemote, payAgainstWriteOffRemote, writeOffRecordId } from "@/lib/writeOffs"

type Row = Record<string, unknown>

/** In-memory stand-in for the few query shapes the write-off actions use */
function memDb(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    let op: { kind: "select" | "update" | "delete"; values?: Row } = { kind: "select" }
    const rows = () => (tables[table] ??= []).filter(r => filters.every(([k, v]) => r[k] === v))
    const run = () => {
      if (op.kind === "update") { for (const r of rows()) Object.assign(r, op.values); return rows() }
      if (op.kind === "delete") { const gone = new Set(rows()); tables[table] = tables[table].filter(r => !gone.has(r)); return [] }
      return rows()
    }
    const b = {
      select() { return b },
      update(values: Row) { op = { kind: "update", values }; return b },
      delete() { op = { kind: "delete" }; return b },
      eq(k: string, v: unknown) { filters.push([k, v]); return b },
      order() { return b },
      limit() { return b },
      single: () => Promise.resolve({ data: { ...run()[0] }, error: null }),
      maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(res),
    }
    return b
  }
  return { from } as unknown as SupabaseClient
}

const writtenOffLending = (extra: Partial<{ paid_history: PayRecord[]; amount_paid: number }> = {}) => ({
  id: "L1", person: "Sara", amount: 1000, amount_paid: 1000, date: "2026-08-05",
  paid_history: [{ amount: 200, date: "2026-08-20" }, { amount: 800, date: "2026-10-02", written_off: true, record_id: "X1" }] as PayRecord[],
  ...extra,
})

describe("write-off rules", () => {
  it("reopening drops the write-off and makes the amount owed again", () => {
    const l = writtenOffLending()
    expect(writtenOffAmount(l)).toBe(800)
    const next = reopenWriteOff(l)
    expect(next.amount_paid).toBe(200)
    expect(next.paid_history).toEqual([{ amount: 200, date: "2026-08-20" }])
    expect(counted({ ...l, ...next })).toBe(800)
  })

  it("a partial payment shrinks the write-off and records a real payment", () => {
    const next = payAgainstWriteOff(writtenOffLending(), 300, "2026-11-01", "X1")
    expect(next.writtenOffLeft).toBe(500)
    expect(next.paid_history).toEqual([
      { amount: 200, date: "2026-08-20" },
      { amount: 500, date: "2026-10-02", written_off: true, record_id: "X1" },
      { amount: 300, date: "2026-11-01" },
    ])
  })

  it("paying back everything removes the write-off; overpaying is capped", () => {
    const next = payAgainstWriteOff(writtenOffLending(), 5000, "2026-11-01", "X1")
    expect(next.writtenOffLeft).toBe(0)
    expect(next.paid_history.some(p => p.written_off)).toBe(false)
    expect(next.paid_history.at(-1)).toEqual({ amount: 800, date: "2026-11-01" })
  })
})

describe("write-off records in the database", () => {
  const setup = () => {
    const tables: Record<string, Row[]> = {
      lendings: [writtenOffLending()],
      expenses: [
        { id: "X1", amount: 800, description: "Written off: loan to Sara", date: "2026-08-05", created_at: "1" },
        { id: "X2", amount: 50, description: "Coffee", date: "2026-08-05", created_at: "2" },
      ],
    }
    return { tables, db: memDb(tables) }
  }

  it("reopen deletes only the expense the write-off created", async () => {
    const { tables, db } = setup()
    const res = await reopenWriteOffRemote(db, "lendings", writtenOffLending())
    expect(res!.recordFound).toBe(true)
    expect(tables.expenses.map(e => e.id)).toEqual(["X2"])
    expect(tables.lendings[0]).toMatchObject({ amount_paid: 200 })
    expect(res!.item.paid_history).toEqual([{ amount: 200, date: "2026-08-20" }])
  })

  it("a partial payment shrinks the expense; the rest deletes it", async () => {
    const { tables, db } = setup()
    const after = await payAgainstWriteOffRemote(db, "lendings", writtenOffLending(), 300, "2026-11-01")
    expect(tables.expenses.find(e => e.id === "X1")!.amount).toBe(500)
    await payAgainstWriteOffRemote(db, "lendings", after!, 500, "2026-11-15")
    expect(tables.expenses.map(e => e.id)).toEqual(["X2"])
    expect(writtenOffAmount(tables.lendings[0] as never)).toBe(0)
  })

  it("finds an unlinked write-off record by its description and amount", async () => {
    const { db } = setup()
    const unlinked = writtenOffLending({ paid_history: [{ amount: 200, date: "2026-08-20" }, { amount: 800, date: "2026-10-02", written_off: true }] })
    expect(await writeOffRecordId(db, "lendings", unlinked)).toBe("X1")
  })

  it("debts use the income the write-off created", async () => {
    const tables: Record<string, Row[]> = {
      debts: [{ id: "D1", person: "Abel", amount: 600, amount_paid: 600, paid_history: [{ amount: 600, date: "2026-09-01", written_off: true }] }],
      incomes: [{ id: "I1", amount: 600, description: "Forgiven: debt to Abel", created_at: "1" }],
    }
    await reopenWriteOffRemote(memDb(tables), "debts", tables.debts[0] as never)
    expect(tables.incomes).toEqual([])
    expect(tables.debts[0]).toMatchObject({ amount_paid: 0, paid_history: [] })
  })
})

describe("cash isn't counted twice", () => {
  it("a written-off lending is an expense on its date, not also money lent", () => {
    // Lent 1000 on Aug 5, all written off (expense of 1000 dated Aug 5)
    const off = { amount: 1000, date: "2026-08-05", paid_history: [{ amount: 1000, date: "2026-10-02", written_off: true }] }
    expect(loanFlows([], [off], "2026-08").moneyOut).toBe(0)          // the expense carries it
    expect(loanFlows([], [off], "2026-10").moneyIn).toBe(0)           // the write-off isn't money back

    // 400 comes back on Oct 10: the expense shrinks to 600, so 400 is a loan again
    const paid = { ...off, paid_history: payAgainstWriteOff({ ...off, amount_paid: 1000 }, 400, "2026-10-10", null).paid_history }
    expect(loanFlows([], [paid], "2026-08").moneyOut).toBe(400)       // 400 lent + 600 expense = the 1000 that left
    expect(loanFlows([], [paid], "2026-10").moneyIn).toBe(400)        // and 400 came back
  })

  it("a written-off debt is income on its date, not also money borrowed", () => {
    const off = { amount: 500, date: "2026-07-01", paid_history: [{ amount: 500, date: "2026-09-01", written_off: true }] }
    expect(loanFlows([off], [], "2026-07").moneyIn).toBe(0)
  })
})
