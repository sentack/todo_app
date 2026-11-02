// Undoing the old write-off against the database. The old write-off closed a
// loan and recorded the unpaid part as an expense (lending) or income (debt);
// these keep that record in step when the loan is reopened or paid back.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { PayRecord } from "./budget"
import { writtenOffAmount, writeOffRecordIds, reopenWriteOff, payAgainstWriteOff } from "./loans"

export type LoanTable = "debts" | "lendings"

interface WrittenOffLoan {
  id: string; person: string; amount: number; amount_paid: number; paid_history: PayRecord[]
}

/** Where an old write-off recorded the unpaid part */
export const WRITE_OFF_RECORD = {
  lendings: { table: "expenses", prefix: "Written off: loan to ", noun: "expense", page: "Expenses" },
  debts:    { table: "incomes",  prefix: "Forgiven: debt to ",  noun: "income",  page: "Budget" },
} as const

/** The expense/income row an old write-off created, or null if it can't be found */
export async function writeOffRecordId(supabase: SupabaseClient, table: LoanTable, item: WrittenOffLoan) {
  const linked = writeOffRecordIds(item)[0]
  if (linked) return linked
  // Not linked by the migration (e.g. edited since): look it up by description and amount
  const r = WRITE_OFF_RECORD[table]
  const { data } = await supabase.from(r.table).select("id")
    .eq("description", r.prefix + item.person).eq("amount", writtenOffAmount(item))
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/** Reopen a written-off loan: its expense/income is deleted and the amount is owed again */
export async function reopenWriteOffRemote<T extends WrittenOffLoan>(supabase: SupabaseClient, table: LoanTable, item: T) {
  const recordId = await writeOffRecordId(supabase, table, item)
  const next = reopenWriteOff(item)
  const { data, error } = await supabase.from(table).update(next).eq("id", item.id).select().single()
  if (error || !data) return null
  if (recordId) await supabase.from(WRITE_OFF_RECORD[table].table).delete().eq("id", recordId)
  return { item: { ...item, ...data, paid_history: next.paid_history } as T, recordFound: !!recordId }
}

/** Money back on a written-off loan: the write-off and its expense/income shrink by that much */
export async function payAgainstWriteOffRemote<T extends WrittenOffLoan>(
  supabase: SupabaseClient, table: LoanTable, item: T, amount: number, date: string,
) {
  const recordId = await writeOffRecordId(supabase, table, item)
  const next = payAgainstWriteOff(item, amount, date, recordId)
  const { data, error } = await supabase.from(table).update({ paid_history: next.paid_history }).eq("id", item.id).select().single()
  if (error || !data) return null
  if (recordId) {
    const rec = supabase.from(WRITE_OFF_RECORD[table].table)
    if (next.writtenOffLeft > 0) await rec.update({ amount: next.writtenOffLeft }).eq("id", recordId)
    else await rec.delete().eq("id", recordId)
  }
  return { ...item, ...data, paid_history: next.paid_history } as T
}
