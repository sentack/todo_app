"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"
import { useCurrency } from "@/contexts/CurrencyContext"
import { triggerUndo } from "@/lib/undoToast"

interface ToBuyItem {
  id: string; name: string; quantity: number; price: number
  urgency: "low" | "medium" | "high" | "critical"; bought: boolean; notes: string | null; created_at: string
}

type ViewFilter = "pending" | "bought" | "all"

const PAGE_SIZE = 15

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const URGENCY_META: Record<string, { label: string; badge: string; dot: string }> = {
  critical: { label: "Critical", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",           dot: "bg-red-500"    },
  high:     { label: "High",     badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-400" },
  medium:   { label: "Medium",   badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", dot: "bg-yellow-400" },
  low:      { label: "Low",      badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",           dot: "bg-gray-400"   },
}

interface LogPrompt { itemId: string; name: string; amount: number }

export default function ToBuyPage() {
  const [allItems, setAllItems]       = useState<ToBuyItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshKey, setRefreshKey]   = useState(0)
  const [page, setPage]               = useState(1)
  const [togglingId, setTogglingId]   = useState<string | null>(null)
  const [logPrompt, setLogPrompt]     = useState<LogPrompt | null>(null)

  // filters
  const [viewFilter, setViewFilter]           = useState<ViewFilter>("pending")
  const [search, setSearch]                   = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const supabase  = useMemo(() => createBrowserSupabaseClient(), [])
  const userIdRef = useRef<string | null>(null)
  const { currency } = useCurrency()

  // Auto-dismiss log prompt after 8s
  useEffect(() => {
    if (!logPrompt) return
    const t = setTimeout(() => setLogPrompt(null), 8000)
    return () => clearTimeout(t)
  }, [logPrompt])

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Load all items on mount and after mutations
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      if (!userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        userIdRef.current = user.id
      }
      if (cancelled) return
      const uid = userIdRef.current!

      const { data } = await supabase
        .from("to_buy_items")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })

      if (!cancelled) {
        setAllItems((data ?? []) as ToBuyItem[])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [viewFilter, debouncedSearch])

  // ── client-side filter ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...allItems]

    if (viewFilter === "pending") result = result.filter(i => !i.bought)
    if (viewFilter === "bought")  result = result.filter(i =>  i.bought)

    if (debouncedSearch.trim()) {
      const s = debouncedSearch.trim().toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(s) || (i.notes ?? "").toLowerCase().includes(s))
    }

    // Sort: pending by urgency first, bought by newest
    result.sort((a, b) => {
      if (!a.bought && !b.bought) return URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
      if (!a.bought &&  b.bought) return -1
      if ( a.bought && !b.bought) return  1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [allItems, viewFilter, debouncedSearch])

  const summary = useMemo(() => ({
    pendingCount: allItems.filter(i => !i.bought).length,
    boughtCount:  allItems.filter(i =>  i.bought).length,
    pendingTotal: allItems.filter(i => !i.bought).reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0),
  }), [allItems])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Group the current page's pending items by urgency
  const pendingPaged = paged.filter(i => !i.bought)
  const boughtPaged  = paged.filter(i =>  i.bought)

  const urgencyGroups: Record<string, ToBuyItem[]> = {}
  for (const item of pendingPaged) {
    if (!urgencyGroups[item.urgency]) urgencyGroups[item.urgency] = []
    urgencyGroups[item.urgency].push(item)
  }

  // ── mutations ─────────────────────────────────────────────────────────────

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.type === "to-buy") { setPage(1); refresh() }
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBought = async (item: ToBuyItem) => {
    setTogglingId(item.id)
    const newBought = !item.bought
    const { error } = await supabase.from("to_buy_items").update({ bought: newBought }).eq("id", item.id)
    if (!error) {
      setAllItems(prev => prev.map(i => i.id === item.id ? { ...i, bought: newBought } : i))
      // Prompt to log as expense only when marking as bought and item has a price
      if (newBought && Number(item.price) > 0) {
        setLogPrompt({ itemId: item.id, name: item.name, amount: Number(item.price) * Number(item.quantity) })
      }
    }
    setTogglingId(null)
  }

  const logAsExpense = async () => {
    if (!logPrompt || !userIdRef.current) return
    const today = new Date().toISOString().split("T")[0]
    await supabase.from("expenses").insert({
      user_id: userIdRef.current,
      category: "Shopping",
      amount: logPrompt.amount,
      description: logPrompt.name,
      date: today,
    })
    setLogPrompt(null)
  }

  const deleteItem = (id: string) => {
    const item = allItems.find(i => i.id === id)
    if (!item) return
    setAllItems(prev => prev.filter(i => i.id !== id))
    let undone = false
    triggerUndo(`Removed "${item.name}"`, () => {
      undone = true
      setAllItems(prev => [item, ...prev])
    })
    setTimeout(() => { if (!undone) supabase.from("to_buy_items").delete().eq("id", id) }, 5100)
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-black dark:text-white">To Buy</h1>
          </div>

          {/* Summary banner */}
          {(summary.pendingCount > 0 || summary.boughtCount > 0) && (
            <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Pending</p>
                  <p className="text-3xl font-bold text-white dark:text-black">{summary.pendingCount} item{summary.pendingCount !== 1 ? "s" : ""}</p>
                  {summary.pendingTotal > 0 && <p className="text-gray-400 dark:text-gray-600 text-sm mt-1">≈ {currency} {summary.pendingTotal.toFixed(2)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Bought</p>
                  <p className="text-2xl font-bold text-white dark:text-black">{summary.boughtCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Log-as-expense prompt */}
          {logPrompt && (
            <div className="animate-slide-in-down bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100 truncate">Bought: {logPrompt.name}</p>
                  <p className="text-xs text-green-700 dark:text-green-300">Log {currency} {logPrompt.amount.toFixed(2)} as expense?</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={logAsExpense} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl transition-colors">Log</button>
                <button onClick={() => setLogPrompt(null)} className="px-3 py-1.5 bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 text-green-800 dark:text-green-200 text-xs font-semibold rounded-xl transition-colors">Skip</button>
              </div>
            </div>
          )}

          {/* Search + view filter */}
          <div className="space-y-3 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              )}
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit">
              {(["pending", "all", "bought"] as ViewFilter[]).map(f => (
                <button key={f} onClick={() => setViewFilter(f)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-150 ${viewFilter === f ? "bg-black dark:bg-white text-white dark:text-black shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}>
                  {f === "pending" ? `Pending${summary.pendingCount > 0 ? ` (${summary.pendingCount})` : ""}` : f === "bought" ? `Bought${summary.boughtCount > 0 ? ` (${summary.boughtCount})` : ""}` : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton rounded-2xl h-16" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {search ? "No items match your search." : viewFilter === "bought" ? "Nothing bought yet." : "Your list is empty. Use the + button to add something."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending — grouped by urgency */}
              {pendingPaged.length > 0 && (["critical","high","medium","low"] as ToBuyItem["urgency"][]).filter(u => urgencyGroups[u]?.length).map(u => (
                <div key={u}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className={`w-2 h-2 rounded-full ${URGENCY_META[u].dot}`} />
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{URGENCY_META[u].label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-600">{urgencyGroups[u].length} item{urgencyGroups[u].length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    {urgencyGroups[u].map((item, idx) => (
                      <ItemRow key={item.id} item={item} isLast={idx === urgencyGroups[u].length - 1} togglingId={togglingId} currency={currency} onToggle={toggleBought} onDelete={deleteItem} onUpdated={updated => setAllItems(prev => prev.map(i => i.id === updated.id ? updated : i))} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Bought items */}
              {boughtPaged.length > 0 && (
                <div>
                  {viewFilter === "all" && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Bought</span>
                    </div>
                  )}
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    {boughtPaged.map((item, idx) => (
                      <ItemRow key={item.id} item={item} isLast={idx === boughtPaged.length - 1} togglingId={togglingId} currency={currency} onToggle={toggleBought} onDelete={deleteItem} onUpdated={updated => setAllItems(prev => prev.map(i => i.id === updated.id ? updated : i))} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                Next →
              </button>
            </div>
          )}

        </div>
      </div>
    </AuthenticatedLayout>
  )
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

const BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}
const URGENCY_ACTIVE: Record<string, string> = {
  critical: "bg-red-500 text-white", high: "bg-orange-400 text-white",
  medium: "bg-yellow-400 text-black", low: "bg-gray-400 text-white",
}
const ITEM_INPUT = "w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"

function ItemRow({ item, isLast, togglingId, currency, onToggle, onDelete, onUpdated }: {
  item: ToBuyItem; isLast: boolean; togglingId: string | null; currency: string
  onToggle: (item: ToBuyItem) => void; onDelete: (id: string) => void
  onUpdated: (updated: ToBuyItem) => void
}) {
  const [isEditing, setIsEditing]   = useState(false)
  const [name, setName]             = useState(item.name)
  const [quantity, setQuantity]     = useState(String(item.quantity))
  const [price, setPrice]           = useState(item.price > 0 ? String(item.price) : "")
  const [urgency, setUrgency]       = useState(item.urgency)
  const [notes, setNotes]           = useState(item.notes ?? "")
  const [saving, setSaving]         = useState(false)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const startEdit = () => {
    setName(item.name); setQuantity(String(item.quantity))
    setPrice(item.price > 0 ? String(item.price) : "")
    setUrgency(item.urgency); setNotes(item.notes ?? "")
    setIsEditing(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const payload = { name: name.trim(), quantity: parseFloat(quantity) || 1, price: parseFloat(price) || 0, urgency, notes: notes.trim() || null }
    const { data, error } = await supabase.from("to_buy_items").update(payload).eq("id", item.id).select().single()
    setSaving(false)
    if (!error && data) { setIsEditing(false); onUpdated(data as ToBuyItem) }
  }

  const itemTotal = Number(item.price) * Number(item.quantity)
  const qtyStr    = Number(item.quantity) % 1 === 0 ? String(Number(item.quantity)) : Number(item.quantity).toFixed(2)
  const borderCls = !isLast ? "border-b border-gray-100 dark:border-gray-900" : ""
  const inactiveCls = "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"

  if (isEditing) {
    return (
      <div className={`px-4 py-3 ${borderCls}`}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Item name" autoFocus className={`${ITEM_INPUT} flex-1`} />
            <button type="button" onClick={() => setIsEditing(false)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Qty</label>
              <input type="number" step="0.01" min="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} className={ITEM_INPUT} />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price ({currency})</label>
              <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className={ITEM_INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(["low","medium","high","critical"] as const).map(u => (
              <button key={u} type="button" onClick={() => setUrgency(u)}
                className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${urgency === u ? URGENCY_ACTIVE[u] : inactiveCls}`}
              >{u}</button>
            ))}
          </div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className={ITEM_INPUT} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-900 text-black dark:text-white text-sm font-semibold rounded-xl hover:opacity-80">
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className={`px-4 py-3 transition-colors ${item.bought ? "bg-gray-50 dark:bg-gray-950" : ""} ${borderCls}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggle(item)} disabled={togglingId === item.id}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-50 ${item.bought ? "bg-black dark:bg-white border-black dark:border-white" : "border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white"}`}
        >
          {item.bought && <svg className="w-3 h-3 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        </button>
        <p className={`flex-1 min-w-0 font-medium truncate ${item.bought ? "line-through text-gray-400 dark:text-gray-600" : "text-black dark:text-white"}`}>
          {item.name}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={startEdit} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 pl-8 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">Qty: {qtyStr}</span>
          {Number(item.price) > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">· {currency} {Number(item.price).toFixed(2)} each</span>}
          {item.notes && <span className="text-xs text-gray-400 dark:text-gray-600 truncate max-w-[100px]">· {item.notes}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {itemTotal > 0 && <span className={`text-sm font-bold ${item.bought ? "text-gray-400 dark:text-gray-600 line-through" : "text-black dark:text-white"}`}>{currency} {itemTotal.toFixed(2)}</span>}
          {!item.bought && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${BADGE[item.urgency]}`}>{item.urgency}</span>}
        </div>
      </div>
    </div>
  )
}
