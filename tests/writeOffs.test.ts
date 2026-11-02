// Forgiving loans: the expense/income it records stays in step when the loan
// is reopened or paid back, and cash totals never count the same money twice.

import { describe, it, expect } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { PayRecord } from "@/lib/budget"
import { loanFlows } from "@/lib/budget"
import { writtenOffAmount, reopenWriteOff, payAgainstWriteOff, outstanding } from "@/lib/loans"
import { forgiveRemote, reopenWriteOffRemote, payAgainstWriteOffRemote, writeOffRecordId } from "@/lib/writeOffs"

type Row = Record<string, unknown>

/** In-memory stand-in for the few query shapes the write-off actions use */
function memDb(tables: Record<string, Row[]>, failUpdatesOn?: string) {
  let nextId = 0
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    let op: { kind: "select" | "update" | "delete" | "insert"; values?: Row } = { kind: "select" }
    const rows = () => (tables[table] ??= []).filter(r => filters.every(([k, v]) => r[k] === v))
    const run = () => {
      if (op.kind === "insert") { const r = { id: `new${++nextId}`, ...op.values }; (tables[table] ??= []).push(r); return [r] }
      if (op.kind === "update" && table === failUpdatesOn) return null
      if (op.kind === "update") { for (const r of rows()) Object.assign(r, op.values); return rows() }
      if (op.kind === "delete") { const gone = new Set(rows()); tables[table] = tables[table].filter(r => !gone.has(r)); return [] }
      return rows()
    }
    const b = {
      select() { return b },
      update(values: Row) { op = { kind: "update", values }; return b },
      insert(values: Row) { op = { kind: "insert", values }; return b },
      delete() { op = { kind: "delete" }; return b },
      eq(k: string, v: unknown) { filters.push([k, v]); return b },
      order() { return b },
      limit() { return b },
      single: () => { const r = run(); return Promise.resolve(r ? { data: { ...r[0] }, error: null } : { data: null, error: { message: "failed" } }) },
      maybeSingle: () => Promise.resolve({ data: run()?.[0] ?? null, error: null }),
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
    expect(outstanding({ ...l, ...next })).toBe(800)
  })

  it("a partial payment shrinks the write-off and records a real payment", () => {
    const next = payAgainstWriteOff(writtenOffLending(), 300, "2026-11-01", "X1")
    expect(next.writtenOffLeft).toBe(500)
    expect(next.paid_history).toEqual([
      { amount: 200, date: "2026-08-20" },
      { amount: 500, date: "2026-10-02", written_off: true, record_id: "X1" },
      { amount: 300, date: "2026-11-01", recovered: true },
    ])
  })

  it("paying back everything removes the write-off; overpaying is capped", () => {
    const next = payAgainstWriteOff(writtenOffLending(), 5000, "2026-11-01", "X1")
    expect(next.writtenOffLeft).toBe(0)
    expect(next.paid_history.some(p => p.written_off)).toBe(false)
    expect(next.paid_history.at(-1)).toEqual({ amount: 800, date: "2026-11-01", recovered: true })
  })
})

describe("forgiving in the database", () => {
  const open = () => ({ id: "L9", person: "Sara", amount: 1700, amount_paid: 200, date: "2026-07-23", paid_history: [{ amount: 200, date: "2026-08-01" }] as PayRecord[] })

  it("records the rest as an expense on the day it was lent, and closes the loan", async () => {
    const tables: Record<string, Row[]> = { lendings: [open()], expenses: [] }
    const updated = await forgiveRemote(memDb(tables), "lendings", open(), "u1", "2026-11-02")
    expect(tables.expenses).toEqual([{ id: "new1", user_id: "u1", amount: 1500, date: "2026-07-23", description: "Written off: loan to Sara", category: "Other" }])
    expect(tables.lendings[0]).toMatchObject({ amount_paid: 1700 })
    expect(updated!.paid_history.at(-1)).toEqual({ amount: 1500, date: "2026-11-02", written_off: true, record_id: "new1" })
  })

  it("a forgiven debt is income on the day it was borrowed", async () => {
    const debt = { id: "D9", person: "Abel", amount: 600, amount_paid: 0, date: "2026-07-01", paid_history: [] as PayRecord[] }
    const tables: Record<string, Row[]> = { debts: [{ ...debt }], incomes: [] }
    await forgiveRemote(memDb(tables), "debts", debt, "u1", "2026-11-02")
    expect(tables.incomes[0]).toMatchObject({ amount: 600, date: "2026-07-01", source: "Other", description: "Forgiven: debt to Abel" })
  })

  it("if the loan can't be closed, the expense is removed again", async () => {
    const tables: Record<string, Row[]> = { lendings: [open()], expenses: [] }
    expect(await forgiveRemote(memDb(tables, "lendings"), "lendings", open(), "u1", "2026-11-02")).toBeNull()
    expect(tables.expenses).toEqual([])
  })

  it("forgive, part paid back, then undo: the expense follows every step", async () => {
    const tables: Record<string, Row[]> = { lendings: [open()], expenses: [] }
    const db = memDb(tables)
    const forgiven = await forgiveRemote(db, "lendings", open(), "u1", "2026-11-02")
    const part = await payAgainstWriteOffRemote(db, "lendings", forgiven!, 600, "2026-11-10")
    expect(tables.expenses[0]).toMatchObject({ amount: 900, date: "2026-07-23" })
    await reopenWriteOffRemote(db, "lendings", part!)
    expect(tables.expenses).toEqual([])
    expect(tables.lendings[0]).toMatchObject({ amount_paid: 800 })   // 200 + 600 really paid; 900 owed again
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
