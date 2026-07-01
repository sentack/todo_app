"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import FriendCombobox from "@/components/FriendCombobox"
import { useCurrency } from "@/contexts/CurrencyContext"
import { triggerUndo } from "@/lib/undoToast"
import { formatMoney } from "@/lib/formatMoney"

interface PayRecord { amount: number; date: string }

interface DebtItem {
  id: string; amount: number; date: string; deadline: string | null
  person: string; amount_paid: number; paid_history: PayRecord[]; created_at: string
}

interface LendingItem {
  id: string; amount: number; date: string; deadline: string | null
  person: string; amount_paid: number; paid_history: PayRecord[]; created_at: string
}

interface PersonGroup { name: string; debts: DebtItem[]; lendings: LendingItem[] }

const MODAL_PAGE = 10

function todayStr() { return new Date().toISOString().split("T")[0] }

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getStatus(item: { amount: number; amount_paid: number }): "paid" | "partial" | "unpaid" {
  if (Number(item.amount_paid) >= Number(item.amount)) return "paid"
  if (Number(item.amount_paid) > 0) return "partial"
  return "unpaid"
}

const STATUS_BADGE: Record<string, string> = {
  paid:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  unpaid:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}
const STATUS_DOT: Record<string, string> = {
  paid: "bg-green-500", partial: "bg-yellow-400", unpaid: "bg-red-400",
}

const CARD_INPUT = "w-full px-3 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"

function groupByPerson(debts: DebtItem[], lendings: LendingItem[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>()
  const key = (n: string) => n.trim().toLowerCase()
  for (const d of debts) {
    const k = key(d.person)
    if (!map.has(k)) map.set(k, { name: d.person.trim(), debts: [], lendings: [] })
    map.get(k)!.debts.push(d)
  }
  for (const l of lendings) {
    const k = key(l.person)
    if (!map.has(k)) map.set(k, { name: l.person.trim(), debts: [], lendings: [] })
    map.get(k)!.lendings.push(l)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function personNet(g: PersonGroup) {
  const debt = g.debts.reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.amount_paid)), 0)
  const lent = g.lendings.reduce((s, l) => s + Math.max(0, Number(l.amount) - Number(l.amount_paid)), 0)
  return lent - debt
}

// ─────────────────────────────────────────────────────────── Page ────

export default function DebtsPage() {
  const [allDebts,    setAllDebts]    = useState<DebtItem[]>([])
  const [allLendings, setAllLendings] = useState<LendingItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshKey,  setRefreshKey]  = useState(0)
  const [search,      setSearch]      = useState("")
  const [debSearch,   setDebSearch]   = useState("")
  const [hideSettled, setHideSettled] = useState(false)

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)
  const { currency } = useCurrency()

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 300)
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
      const [{ data: debts }, { data: lendings }] = await Promise.all([
        supabase.from("debts").select("*").eq("user_id", userIdRef.current!).order("date", { ascending: false }),
        supabase.from("lendings").select("*").eq("user_id", userIdRef.current!).order("date", { ascending: false }),
      ])
      if (!cancelled) {
        setAllDebts((debts ?? []) as DebtItem[])
        setAllLendings((lendings ?? []) as LendingItem[])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent).detail?.type
      if (t === "debt" || t === "lending") setRefreshKey(k => k + 1)
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    let g = groupByPerson(allDebts, allLendings)
    if (debSearch.trim()) {
      const s = debSearch.toLowerCase()
      g = g.filter(gr => gr.name.toLowerCase().includes(s))
    }
    if (hideSettled) g = g.filter(gr => personNet(gr) !== 0)
    return g
  }, [allDebts, allLendings, debSearch, hideSettled])

  const summary = useMemo(() => {
    const youOwe  = allDebts.reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.amount_paid)), 0)
    const theyOwe = allLendings.reduce((s, l) => s + Math.max(0, Number(l.amount) - Number(l.amount_paid)), 0)
    return { youOwe, theyOwe, net: theyOwe - youOwe }
  }, [allDebts, allLendings])

  const hasAny = allDebts.length > 0 || allLendings.length > 0

  const onDebtUpdated    = (u: DebtItem)    => setAllDebts(prev => prev.map(d => d.id === u.id ? u : d))
  const onLendingUpdated = (u: LendingItem) => setAllLendings(prev => prev.map(l => l.id === u.id ? u : l))

  const onDebtDelete = (id: string) => {
    const item = allDebts.find(d => d.id === id)
    if (!item) return
    setAllDebts(prev => prev.filter(d => d.id !== id))
    let undone = false
    triggerUndo(`Debt with ${item.person} deleted`, () => { undone = true; setAllDebts(prev => [...prev, item]) })
    setTimeout(() => { if (!undone) supabase.from("debts").delete().eq("id", id) }, 5100)
  }

  const onLendingDelete = (id: string) => {
    const item = allLendings.find(l => l.id === id)
    if (!item) return
    setAllLendings(prev => prev.filter(l => l.id !== id))
    let undone = false
    triggerUndo(`Lending for ${item.person} deleted`, () => { undone = true; setAllLendings(prev => [...prev, item]) })
    setTimeout(() => { if (!undone) supabase.from("lendings").delete().eq("id", id) }, 5100)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-slide-in-down">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Finances</h1>
        </div>

        {/* Summary banner */}
        {hasAny && (
          <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-gray-400 dark:text-gray-600 text-xs font-medium mb-1">You Owe</p>
                <p className="text-lg font-bold text-white dark:text-black">{currency} {formatMoney(summary.youOwe)}</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-600 text-xs font-medium mb-1">Owed to You</p>
                <p className="text-lg font-bold text-white dark:text-black">{currency} {formatMoney(summary.theyOwe)}</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-600 text-xs font-medium mb-1">Net</p>
                <p className={`text-lg font-bold ${summary.net >= 0 ? "text-green-400 dark:text-green-500" : "text-red-400"}`}>
                  {summary.net >= 0 ? "+" : ""}{currency} {formatMoney(Math.abs(summary.net))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search + filter */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            )}
          </div>
          <button onClick={() => setHideSettled(v => !v)}
            className={`shrink-0 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${hideSettled ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white" : "bg-white dark:bg-black text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-white"}`}>
            {hideSettled ? "All" : "Active"}
          </button>
        </div>

        {/* Person cards */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton rounded-2xl h-24" />)}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {search || hideSettled ? "No people match your filters." : "No debts or lendings yet. Use the + button to add one."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(group => (
              <PersonCard
                key={group.name.toLowerCase()}
                group={group}
                currency={currency}
                userId={userIdRef.current ?? ""}
                onDebtUpdated={onDebtUpdated}
                onDebtDelete={onDebtDelete}
                onLendingUpdated={onLendingUpdated}
                onLendingDelete={onLendingDelete}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────── PersonCard ────

function PersonCard({ group, currency, userId, onDebtUpdated, onDebtDelete, onLendingUpdated, onLendingDelete }: {
  group: PersonGroup; currency: string; userId: string
  onDebtUpdated: (d: DebtItem) => void; onDebtDelete: (id: string) => void
  onLendingUpdated: (l: LendingItem) => void; onLendingDelete: (id: string) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const net = personNet(group)

  const recentItems = useMemo(() => {
    const all = [
      ...group.debts.map(d => ({ ...d, _type: "debt" as const })),
      ...group.lendings.map(l => ({ ...l, _type: "lending" as const })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return all.slice(0, 5)
  }, [group])

  const totalTx = group.debts.length + group.lendings.length

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full text-left bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-md transition-all duration-150 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
            <span className="text-white dark:text-black font-bold text-base leading-none">
              {group.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm text-black dark:text-white truncate">{group.name}</p>
              <span className="text-xs text-gray-400 shrink-0">{totalTx} tx</span>
            </div>

            {/* Last 5 mini chips */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {recentItems.map((item, i) => {
                const st = getStatus(item)
                return (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item._type === "debt" ? "bg-red-400" : "bg-green-400"}`} />
                    {currency} {formatMoney(Number(item.amount))}
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[st]}`} />
                  </span>
                )
              })}
              {totalTx > 5 && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-900 text-gray-400">
                  +{totalTx - 5} more
                </span>
              )}
            </div>
          </div>

          {/* Net */}
          <div className="text-right shrink-0 ml-2">
            {net === 0 ? (
              <span className="text-xs font-semibold text-green-500 dark:text-green-400">Settled</span>
            ) : (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">{net > 0 ? "Owed to you" : "You owe"}</p>
                <p className={`text-sm font-bold ${net > 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {currency} {formatMoney(Math.abs(net))}
                </p>
              </>
            )}
          </div>
        </div>
      </button>

      {modalOpen && (
        <PersonModal
          group={group}
          currency={currency}
          userId={userId}
          onDebtUpdated={onDebtUpdated}
          onDebtDelete={onDebtDelete}
          onLendingUpdated={onLendingUpdated}
          onLendingDelete={onLendingDelete}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────── PersonModal ────

function PersonModal({ group, currency, userId, onClose, onDebtUpdated, onDebtDelete, onLendingUpdated, onLendingDelete }: {
  group: PersonGroup; currency: string; userId: string; onClose: () => void
  onDebtUpdated: (d: DebtItem) => void; onDebtDelete: (id: string) => void
  onLendingUpdated: (l: LendingItem) => void; onLendingDelete: (id: string) => void
}) {
  const [tab,      setTab]      = useState<"debt" | "lending">("debt")
  const [debtPage, setDebtPage] = useState(1)
  const [lendPage, setLendPage] = useState(1)

  const net          = personNet(group)
  const youOweTotal  = group.debts.reduce((s, d) => s + Math.max(0, Number(d.amount) - Number(d.amount_paid)), 0)
  const theyOweTotal = group.lendings.reduce((s, l) => s + Math.max(0, Number(l.amount) - Number(l.amount_paid)), 0)

  const debtPages     = Math.max(1, Math.ceil(group.debts.length / MODAL_PAGE))
  const lendPages     = Math.max(1, Math.ceil(group.lendings.length / MODAL_PAGE))
  const pagedDebts    = group.debts.slice((debtPage - 1) * MODAL_PAGE, debtPage * MODAL_PAGE)
  const pagedLendings = group.lendings.slice((lendPage - 1) * MODAL_PAGE, lendPage * MODAL_PAGE)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  // Lock body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white dark:bg-black sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "70vh" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-900 shrink-0">
          <div className="w-9 h-9 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
            <span className="text-white dark:text-black font-bold text-base leading-none">
              {group.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-black dark:text-white truncate">{group.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {group.debts.length} debt{group.debts.length !== 1 ? "s" : ""} · {group.lendings.length} lending{group.lendings.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Net summary strip */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-gray-900 shrink-0">
          <div className="bg-white dark:bg-black px-4 py-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">You Owe</p>
            <p className="text-sm font-bold text-red-500 dark:text-red-400">{youOweTotal > 0 ? `${currency} ${formatMoney(youOweTotal)}` : "—"}</p>
          </div>
          <div className="bg-white dark:bg-black px-4 py-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Net</p>
            <p className={`text-sm font-bold ${net > 0 ? "text-green-500 dark:text-green-400" : net < 0 ? "text-red-500 dark:text-red-400" : "text-gray-500"}`}>
              {net === 0 ? "Settled" : `${net > 0 ? "+" : ""}${currency} ${formatMoney(Math.abs(net))}`}
            </p>
          </div>
          <div className="bg-white dark:bg-black px-4 py-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">They Owe</p>
            <p className="text-sm font-bold text-green-500 dark:text-green-400">{theyOweTotal > 0 ? `${currency} ${formatMoney(theyOweTotal)}` : "—"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-900 shrink-0">
          <button onClick={() => setTab("debt")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === "debt" ? "text-red-500 dark:text-red-400 border-b-2 border-red-500 dark:border-red-400" : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
            I Owe ({group.debts.length})
          </button>
          <button onClick={() => setTab("lending")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === "lending" ? "text-green-500 dark:text-green-400 border-b-2 border-green-500 dark:border-green-400" : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
            They Owe ({group.lendings.length})
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {tab === "debt" ? (
            group.debts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">No debts with {group.name}</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-900">
                {pagedDebts.map(d => (
                  <DebtRow key={d.id} item={d} currency={currency} userId={userId} onUpdated={onDebtUpdated} onDelete={onDebtDelete} />
                ))}
              </div>
            )
          ) : (
            group.lendings.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">No lendings with {group.name}</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-900">
                {pagedLendings.map(l => (
                  <LendingRow key={l.id} item={l} currency={currency} userId={userId} onUpdated={onLendingUpdated} onDelete={onLendingDelete} />
                ))}
              </div>
            )
          )}
        </div>

        {/* Pagination */}
        {((tab === "debt" && debtPages > 1) || (tab === "lending" && lendPages > 1)) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-900 shrink-0">
            {tab === "debt" ? (
              <>
                <button onClick={() => setDebtPage(p => Math.max(1, p - 1))} disabled={debtPage === 1}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">← Prev</button>
                <span className="text-xs text-gray-500 dark:text-gray-400">Page {debtPage} of {debtPages}</span>
                <button onClick={() => setDebtPage(p => Math.min(debtPages, p + 1))} disabled={debtPage === debtPages}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Next →</button>
              </>
            ) : (
              <>
                <button onClick={() => setLendPage(p => Math.max(1, p - 1))} disabled={lendPage === 1}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">← Prev</button>
                <span className="text-xs text-gray-500 dark:text-gray-400">Page {lendPage} of {lendPages}</span>
                <button onClick={() => setLendPage(p => Math.min(lendPages, p + 1))} disabled={lendPage === lendPages}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Next →</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────── DebtRow ────

function DebtRow({ item, currency, userId, onUpdated, onDelete }: {
  item: DebtItem; currency: string; userId: string
  onUpdated: (d: DebtItem) => void; onDelete: (id: string) => void
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [isEditing,     setIsEditing]     = useState(false)
  const [isPaying,      setIsPaying]      = useState(false)
  const [histExpanded,  setHistExpanded]  = useState(false)
  const [person,        setPerson]        = useState(item.person)
  const [amount,        setAmount]        = useState(String(item.amount))
  const [date,          setDate]          = useState(item.date)
  const [deadline,      setDeadline]      = useState(item.deadline ?? "")
  const [saving,        setSaving]        = useState(false)
  const [payAmount,     setPayAmount]     = useState("")
  const [payDate,       setPayDate]       = useState(todayStr())
  const [submittingPay, setSubmittingPay] = useState(false)

  const status    = getStatus(item)
  const remaining = Number(item.amount) - Number(item.amount_paid)
  const pct       = Math.min(100, Math.round((Number(item.amount_paid) / Number(item.amount)) * 100))
  const isOverdue = item.deadline && new Date(item.deadline + "T00:00:00") < new Date() && status !== "paid"

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
    if (!error && data) { await ensureFriend(person.trim()); setIsEditing(false); onUpdated({ ...item, ...data }) }
    setSaving(false)
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(payAmount)
    if (!parsed || parsed <= 0 || parsed > remaining + 0.001) return
    setSubmittingPay(true)
    const newPaid    = Math.min(Number(item.amount), Number(item.amount_paid) + parsed)
    const newHistory: PayRecord[] = [...item.paid_history, { amount: parsed, date: payDate }]
    const { data, error } = await supabase.from("debts")
      .update({ amount_paid: newPaid, paid_history: newHistory })
      .eq("id", item.id).select().single()
    if (!error && data) { onUpdated({ ...item, ...data, paid_history: newHistory }); setIsPaying(false); setPayAmount(""); setPayDate(todayStr()) }
    setSubmittingPay(false)
  }

  if (isEditing) {
    return (
      <div className="px-4 py-4 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-black dark:text-white">Edit Debt</p>
          <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-black dark:hover:text-white">
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
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={CARD_INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={CARD_INPUT} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-black dark:text-white text-sm font-semibold rounded-xl hover:opacity-80">Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-black dark:text-white">{currency} {formatMoney(Number(item.amount))}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[status]}`}>{status}</span>
            {isOverdue && <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">Overdue</span>}
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span>Borrowed {fmtDate(item.date)}</span>
            {item.deadline && <span>· Due {fmtDate(item.deadline)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {status !== "paid" && (
            <button onClick={() => { setIsPaying(true); setIsEditing(false) }}
              className="px-2.5 py-1 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">Pay</button>
          )}
          <button onClick={() => { setIsEditing(true); setIsPaying(false) }} className="p-1 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      {status !== "unpaid" && (
        <div className="mb-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Paid {currency} {formatMoney(Number(item.amount_paid))}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${status === "paid" ? "bg-green-500" : "bg-yellow-400"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isPaying && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-900">
          <form onSubmit={handlePay} className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currency}</span>
                <input type="number" step="0.01" min="0.01" max={remaining} value={payAmount}
                  onChange={e => setPayAmount(e.target.value)} placeholder={`max ${formatMoney(remaining)}`}
                  required autoFocus className={`${CARD_INPUT} pl-11`} />
              </div>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={`${CARD_INPUT} w-auto shrink-0`} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submittingPay} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50">{submittingPay ? "Saving…" : "Save Payment"}</button>
              <button type="button" onClick={() => { setIsPaying(false); setPayAmount(""); setPayDate(todayStr()) }} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-900 text-black dark:text-white rounded-xl hover:opacity-80">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {item.paid_history.length > 0 && !isPaying && (
        <div className="mt-2">
          <button onClick={() => setHistExpanded(v => !v)} className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            {histExpanded ? "▲" : "▼"} {item.paid_history.length} payment{item.paid_history.length !== 1 ? "s" : ""}
          </button>
          {histExpanded && (
            <div className="mt-1.5 space-y-1">
              {[...item.paid_history].reverse().map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{fmtDate(p.date)}</span>
                  <span className="font-semibold text-black dark:text-white">{currency} {formatMoney(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────── LendingRow ────

function LendingRow({ item, currency, userId, onUpdated, onDelete }: {
  item: LendingItem; currency: string; userId: string
  onUpdated: (l: LendingItem) => void; onDelete: (id: string) => void
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [isEditing,     setIsEditing]     = useState(false)
  const [isPaying,      setIsPaying]      = useState(false)
  const [histExpanded,  setHistExpanded]  = useState(false)
  const [person,        setPerson]        = useState(item.person)
  const [amount,        setAmount]        = useState(String(item.amount))
  const [date,          setDate]          = useState(item.date)
  const [deadline,      setDeadline]      = useState(item.deadline ?? "")
  const [saving,        setSaving]        = useState(false)
  const [payAmount,     setPayAmount]     = useState("")
  const [payDate,       setPayDate]       = useState(todayStr())
  const [submittingPay, setSubmittingPay] = useState(false)

  const status    = getStatus(item)
  const remaining = Number(item.amount) - Number(item.amount_paid)
  const pct       = Math.min(100, Math.round((Number(item.amount_paid) / Number(item.amount)) * 100))
  const isOverdue = item.deadline && new Date(item.deadline + "T00:00:00") < new Date() && status !== "paid"

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
    const { data, error } = await supabase.from("lendings")
      .update({ person: person.trim(), amount: parsed, date, deadline: deadline || null })
      .eq("id", item.id).select().single()
    if (!error && data) { await ensureFriend(person.trim()); setIsEditing(false); onUpdated({ ...item, ...data }) }
    setSaving(false)
  }

  const handleReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(payAmount)
    if (!parsed || parsed <= 0 || parsed > remaining + 0.001) return
    setSubmittingPay(true)
    const newPaid    = Math.min(Number(item.amount), Number(item.amount_paid) + parsed)
    const newHistory: PayRecord[] = [...item.paid_history, { amount: parsed, date: payDate }]
    const { data, error } = await supabase.from("lendings")
      .update({ amount_paid: newPaid, paid_history: newHistory })
      .eq("id", item.id).select().single()
    if (!error && data) { onUpdated({ ...item, ...data, paid_history: newHistory }); setIsPaying(false); setPayAmount(""); setPayDate(todayStr()) }
    setSubmittingPay(false)
  }

  if (isEditing) {
    return (
      <div className="px-4 py-4 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-black dark:text-white">Edit Lending</p>
          <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-black dark:hover:text-white">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <FriendCombobox value={person} onChange={setPerson} userId={userId} label="Borrower (who owes you)" placeholder="Name" required />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{currency} Amount *</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className={CARD_INPUT} />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={CARD_INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={CARD_INPUT} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-black dark:text-white text-sm font-semibold rounded-xl hover:opacity-80">Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-black dark:text-white">{currency} {formatMoney(Number(item.amount))}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[status]}`}>{status}</span>
            {isOverdue && <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">Overdue</span>}
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <span>Lent {fmtDate(item.date)}</span>
            {item.deadline && <span>· Due {fmtDate(item.deadline)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {status !== "paid" && (
            <button onClick={() => { setIsPaying(true); setIsEditing(false) }}
              className="px-2.5 py-1 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">Got Paid</button>
          )}
          <button onClick={() => { setIsEditing(true); setIsPaying(false) }} className="p-1 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      {status !== "unpaid" && (
        <div className="mb-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Received {currency} {formatMoney(Number(item.amount_paid))}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${status === "paid" ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isPaying && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-900">
          <form onSubmit={handleReceipt} className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currency}</span>
                <input type="number" step="0.01" min="0.01" max={remaining} value={payAmount}
                  onChange={e => setPayAmount(e.target.value)} placeholder={`max ${formatMoney(remaining)}`}
                  required autoFocus className={`${CARD_INPUT} pl-11`} />
              </div>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={`${CARD_INPUT} w-auto shrink-0`} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submittingPay} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50">{submittingPay ? "Saving…" : "Save Receipt"}</button>
              <button type="button" onClick={() => { setIsPaying(false); setPayAmount(""); setPayDate(todayStr()) }} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-900 text-black dark:text-white rounded-xl hover:opacity-80">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {item.paid_history.length > 0 && !isPaying && (
        <div className="mt-2">
          <button onClick={() => setHistExpanded(v => !v)} className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            {histExpanded ? "▲" : "▼"} {item.paid_history.length} receipt{item.paid_history.length !== 1 ? "s" : ""}
          </button>
          {histExpanded && (
            <div className="mt-1.5 space-y-1">
              {[...item.paid_history].reverse().map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{fmtDate(p.date)}</span>
                  <span className="font-semibold text-black dark:text-white">{currency} {formatMoney(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
