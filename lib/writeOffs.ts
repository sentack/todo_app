// Forgiving loans against the database. Forgiving closes a loan and records
// its unpaid part as an expense (lending) or income (debt) dated the day the
// loan was made; these keep that record in step when the loan is reopened or
// money comes back. See lib/loans.ts for the rules.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { PayRecord } from "./budget"
import { writtenOffAmount, writeOffRecordIds, reopenWriteOff, payAgainstWriteOff, forgiveLoan } from "./loans"

export type LoanTable = "debts" | "lendings"

interface WrittenOffLoan {
  id: string; person: string; amount: number; amount_paid: number; paid_history: PayRecord[]; date?: string
}

/** Where a forgiven amount is recorded (the prefixes also find records from before they were linked) */
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

/**
 * Forgive what's left of a loan: record it as an expense (lending) or income
 * (debt) on the loan's own date, then close the loan with a linked entry.
 * If closing fails, the new record is removed again.
 */
export async function forgiveRemote<T extends WrittenOffLoan & { date: string }>(
  supabase: SupabaseClient, table: LoanTable, item: T, userId: string, today: string,
) {
  const r = WRITE_OFF_RECORD[table]
  const amount = Math.round((Number(item.amount) - Number(item.amount_paid)) * 100) / 100
  if (amount <= 0) return null
  const row = { user_id: userId, amount, date: item.date, description: r.prefix + item.person,
    ...(table === "lendings" ? { category: "Other" } : { source: "Other" }) }
  const { data: rec, error } = await supabase.from(r.table).insert(row).select("id").single()
  if (error || !rec) return null

  const next = forgiveLoan(item, today, rec.id as string)
  const { data, error: updErr } = await supabase.from(table)
    .update({ amount_paid: next.amount_paid, paid_history: next.paid_history }).eq("id", item.id).select().single()
  if (updErr || !data) {
    await supabase.from(r.table).delete().eq("id", rec.id)
    return null
  }
  return { ...item, ...data, paid_history: next.paid_history } as T
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
