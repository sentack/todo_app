"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"
import FriendCombobox from "@/components/FriendCombobox"
import { useCurrency } from "@/contexts/CurrencyContext"
import { triggerUndo } from "@/lib/undoToast"
import { formatMoney } from "@/lib/formatMoney"

interface PayRecord { amount: number; date: string }

interface DebtItem {
  id: string; amount: number; date: string; deadline: string | null
  person: string; amount_paid: number; paid_history: PayRecord[]; created_at: string
}

type StatusFilter = "all" | "unpaid" | "partial" | "paid"

const PAGE_SIZE = 10

function todayStr() { return new Date().toISOString().split("T")[0] }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function getStatus(item: DebtItem): "paid" | "partial" | "unpaid" {
  if (Number(item.amount_paid) >= Number(item.amount)) return "paid"
  if (Number(item.amount_paid) > 0) return "partial"
  return "unpaid"
}

const STATUS_BADGE = {
  paid:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  unpaid:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}
const STATUS_BAR = { paid: "bg-green-500", partial: "bg-yellow-400", unpaid: "bg-red-400" }

export default function DebtsPage() {
  const [allItems, setAllItems]       = useState<DebtItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshKey, setRefreshKey]   = useState(0)
  const [page, setPage]               = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [search, setSearch]             = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // (payment state now lives in DebtCard)

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)
  const { currency } = useCurrency()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      if (!userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        userIdRef.current = user.id
      }
      if (cancelled) return
      const { data } = await supabase.from("debts").select("*").eq("user_id", userIdRef.current!).order("created_at", { ascending: false })
      if (!cancelled) { setAllItems((data ?? []) as DebtItem[]); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1) }, [statusFilter, debouncedSearch])

  const filtered = useMemo(() => {
    let r = [...allItems]
    if (statusFilter !== "all") r = r.filter(i => getStatus(i) === statusFilter)
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase()
      r = r.filter(i => i.person.toLowerCase().includes(s))
    }
    return r
  }, [allItems, statusFilter, debouncedSearch])

  const summary = useMemo(() => ({
    total:     allItems.reduce((s, i) => s + Number(i.amount), 0),
    paid:      allItems.reduce((s, i) => s + Number(i.amount_paid), 0),
    remaining: allItems.filter(i => getStatus(i) !== "paid").reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0),
    overdue:   allItems.filter(i => i.deadline && new Date(i.deadline + "T00:00:00") < new Date() && getStatus(i) !== "paid").length,
  }), [allItems])

  const counts = useMemo(() => ({
    all: allItems.length,
    unpaid:  allItems.filter(i => getStatus(i) === "unpaid").length,
    partial: allItems.filter(i => getStatus(i) === "partial").length,
    paid:    allItems.filter(i => getStatus(i) === "paid").length,
  }), [allItems])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === "debt") { setPage(1); setRefreshKey(k => k + 1) }
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteItem = (id: string) => {
    const item = allItems.find(i => i.id === id)
    if (!item) return
    setAllItems(prev => prev.filter(i => i.id !== id))
    let undone = false
    triggerUndo(`Debt with ${item.person} deleted`, () => {
      undone = true
      setAllItems(prev => [...prev, item])
    })
    setTimeout(() => {
      if (!undone) supabase.from("debts").delete().eq("id", id)
    }, 5100)
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Debts</h1>
          </div>

          {/* Summary banner */}
          {allItems.length > 0 && (
            <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-400 dark:text-gray-600 text-xs font-medium mb-1">Total Owed</p>
                  <p className="text-lg font-bold text-white dark:text-black">{currency} {formatMoney(summary.total)}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-600 text-xs font-medium mb-1">Paid</p>
                  <p className="text-lg font-bold text-white dark:text-black">{currency} {formatMoney(summary.paid)}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-gray-600 text-xs font-medium mb-1">Remaining</p>
                  <p className="text-lg font-bold text-white dark:text-black">{currency} {formatMoney(summary.remaining)}</p>
                  {summary.overdue > 0 && <p className="text-xs text-red-400 mt-0.5">{summary.overdue} overdue</p>}
                </div>
              </div>
            </div>
          )}

          {/* Status filter */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 mb-4">
            {(["all", "unpaid", "partial", "paid"] as StatusFilter[]).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all duration-150 ${statusFilter === f ? "bg-black dark:bg-white text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}
              >
                {f === "all" ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>}
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton rounded-2xl h-36" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" /></svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">{search || statusFilter !== "all" ? "No debts match your filters." : "No debts yet. Use the + button to add one."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paged.map(item => (
                <DebtCard key={item.id} item={item} currency={currency}
                  userId={userIdRef.current ?? ""}
                  onUpdated={updated => setAllItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">← Prev</button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Next →</button>
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

// ── DebtCard ──────────────────────────────────────────────────────────────────

const CARD_INPUT = "w-full px-3 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"

function DebtCard({ item, userId, currency, onUpdated, onDelete }: {
  item: DebtItem; userId: string; currency: string
  onUpdated: (updated: DebtItem) => void; onDelete: (id: string) => void
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  // Edit state
  const [isEditing, setIsEditing]   = useState(false)
  const [person, setPerson]         = useState(item.person)
  const [amount, setAmount]         = useState(String(item.amount))
  const [date, setDate]             = useState(item.date)
  const [deadline, setDeadline]     = useState(item.deadline ?? "")
  const [saving, setSaving]         = useState(false)

  // Payment state
  const [isPaying, setIsPaying]     = useState(false)
  const [payAmount, setPayAmount]   = useState("")
  const [payDate, setPayDate]       = useState(todayStr())
  const [submittingPay, setSubmittingPay] = useState(false)

  const status    = getStatus(item)
  const remaining = Number(item.amount) - Number(item.amount_paid)
  const pct       = Math.min(100, Math.round((Number(item.amount_paid) / Number(item.amount)) * 100))
  const isOverdue = item.deadline && new Date(item.deadline + "T00:00:00") < new Date() && status !== "paid"

  const startEdit = () => {
    setPerson(item.person); setAmount(String(item.amount))
    setDate(item.date); setDeadline(item.deadline ?? "")
    setIsPaying(false); setIsEditing(true)
  }

  const ensureFriend = async (name: string) => {
    if (!userId || !name.trim()) return
    const { data } = await supabase.from("friends").select("id").eq("user_id", userId).eq("name", name.trim()).maybeSingle()
    if (!data) await supabase.from("friends").insert({ user_id: userId, name: name.trim() })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || !person.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from("debts")
      .update({ person: person.trim(), amount: parsed, date, deadline: deadline || null })
      .eq("id", item.id).select().single()
    if (!error && data) {
      await ensureFriend(person.trim())
      setIsEditing(false); onUpdated({ ...item, ...data })
    }
    setSaving(false)
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(payAmount)
    if (!parsed || parsed <= 0 || parsed > remaining + 0.001) return
    setSubmittingPay(true)
    const newAmountPaid = Math.min(Number(item.amount), Number(item.amount_paid) + parsed)
    const newHistory: PayRecord[] = [...item.paid_history, { amount: parsed, date: payDate }]
    const { data, error } = await supabase.from("debts")
      .update({ amount_paid: newAmountPaid, paid_history: newHistory })
      .eq("id", item.id).select().single()
    if (!error && data) {
      onUpdated({ ...item, ...data, paid_history: newHistory })
      setIsPaying(false); setPayAmount(""); setPayDate(todayStr())
    }
    setSubmittingPay(false)
  }

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-black dark:text-white">Edit Debt</p>
          <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <FriendCombobox value={person} onChange={setPerson} userId={userId} label="Lender (who you owe)" placeholder="Name" required />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{currency} Amount *</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className={CARD_INPUT} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={CARD_INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={CARD_INPUT} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-900 text-black dark:text-white text-sm font-semibold rounded-xl hover:opacity-80">Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-lg text-black dark:text-white truncate">{item.person}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Borrowed {fmtDate(item.date)}</span>
              {item.deadline && (
                <span className={`text-xs font-medium ${isOverdue ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                  · {isOverdue ? "Overdue" : "Due"} {fmtDate(item.deadline)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-black dark:text-white">{currency} {formatMoney(Number(item.amount))}</p>
            {status !== "paid" && <p className="text-sm text-gray-500 dark:text-gray-400">{currency} {formatMoney(remaining)} left</p>}
          </div>
        </div>
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>Paid {currency} {formatMoney(Number(item.amount_paid))}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR[status]}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[status]}`}>{status}</span>
          <div className="flex items-center gap-1">
            {status !== "paid" && (
              <button onClick={() => { setIsPaying(true); setIsEditing(false) }} className="px-3 py-1.5 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-80 transition-all">
                Record Payment
              </button>
            )}
            <button onClick={startEdit} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
            </button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Inline payment form */}
      {isPaying && (
        <div className="border-t border-gray-100 dark:border-gray-900 p-5 bg-gray-50 dark:bg-gray-950">
          <p className="text-sm font-semibold text-black dark:text-white mb-3">Record Payment</p>
          <form onSubmit={handlePay} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Amount (max {currency} {formatMoney(remaining)})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currency}</span>
                  <input type="number" step="0.01" min="0.01" max={remaining} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" required autoFocus className={`${CARD_INPUT} pl-11`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={CARD_INPUT} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submittingPay} className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all">
                {submittingPay ? "Saving..." : "Save Payment"}
              </button>
              <button type="button" onClick={() => { setIsPaying(false); setPayAmount(""); setPayDate(todayStr()) }} className="px-4 py-2.5 text-sm font-medium bg-gray-200 dark:bg-gray-800 text-black dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment history */}
      {item.paid_history.length > 0 && !isPaying && !isEditing && (
        <div className="border-t border-gray-100 dark:border-gray-900 px-5 py-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Payment History</p>
          <div className="space-y-1.5">
            {[...item.paid_history].reverse().map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(p.date)}</span>
                <span className="text-xs font-semibold text-black dark:text-white">{currency} {formatMoney(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
