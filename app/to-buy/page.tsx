"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import AuthenticatedLayout from "@/components/AuthenticatedLayout"

interface ToBuyItem {
  id: string
  name: string
  quantity: number
  price: number
  urgency: "low" | "medium" | "high" | "critical"
  bought: boolean
  notes: string | null
  created_at: string
}

type ViewFilter = "pending" | "bought" | "all"

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const URGENCY_META: Record<string, { label: string; badge: string; dot: string }> = {
  critical: {
    label: "Critical",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dot: "bg-red-500",
  },
  high: {
    label: "High",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    dot: "bg-orange-400",
  },
  medium: {
    label: "Medium",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    dot: "bg-yellow-400",
  },
  low: {
    label: "Low",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    dot: "bg-gray-400",
  },
}

export default function ToBuyPage() {
  const [items, setItems]           = useState<ToBuyItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [formOpen, setFormOpen]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // form fields
  const [name, setName]         = useState("")
  const [quantity, setQuantity] = useState("1")
  const [price, setPrice]       = useState("")
  const [urgency, setUrgency]   = useState<ToBuyItem["urgency"]>("medium")
  const [notes, setNotes]       = useState("")

  // view
  const [viewFilter, setViewFilter] = useState<ViewFilter>("pending")
  const [search, setSearch]         = useState("")

  const supabase = createBrowserSupabaseClient()

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("to_buy_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }
    const { data, error } = await supabase
      .from("to_buy_items")
      .insert({
        user_id: user.id,
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        price: parseFloat(price) || 0,
        urgency,
        notes: notes.trim() || null,
      })
      .select()
      .single()
    if (!error && data) {
      setItems(prev => [data, ...prev])
      setName("")
      setQuantity("1")
      setPrice("")
      setNotes("")
      setFormOpen(false)
    }
    setSubmitting(false)
  }

  const toggleBought = useCallback(async (item: ToBuyItem) => {
    setTogglingId(item.id)
    const { error } = await supabase
      .from("to_buy_items")
      .update({ bought: !item.bought })
      .eq("id", item.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, bought: !i.bought } : i))
    }
    setTogglingId(null)
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    setDeletingId(id)
    await supabase.from("to_buy_items").delete().eq("id", id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDeletingId(null)
  }, [])

  // ── derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = items
    if (viewFilter === "pending") result = result.filter(i => !i.bought)
    if (viewFilter === "bought")  result = result.filter(i => i.bought)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.notes?.toLowerCase().includes(q))
    }
    return [...result].sort((a, b) => {
      if (a.bought !== b.bought) return Number(a.bought) - Number(b.bought)
      return URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    })
  }, [items, viewFilter, search])

  const pendingCount  = items.filter(i => !i.bought).length
  const boughtCount   = items.filter(i => i.bought).length
  const pendingTotal  = items.filter(i => !i.bought).reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)
  const totalCost     = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)

  // group by urgency (only when showing pending or all)
  const grouped = useMemo(() => {
    if (viewFilter === "bought") return null
    const g: Record<string, ToBuyItem[]> = {}
    for (const item of filtered) {
      if (item.bought) continue
      const key = item.urgency
      if (!g[key]) g[key] = []
      g[key].push(item)
    }
    return g
  }, [filtered, viewFilter])

  const boughtItems = filtered.filter(i => i.bought)

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-black dark:text-white">To Buy</h1>
            </div>
            <button
              onClick={() => setFormOpen(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                formOpen
                  ? "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                  : "bg-black dark:bg-white text-white dark:text-black hover:opacity-80"
              }`}
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${formOpen ? "rotate-45" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {formOpen ? "Cancel" : "Add Item"}
            </button>
          </div>

          {/* Summary banner */}
          {!loading && items.length > 0 && (
            <div className="bg-black dark:bg-white rounded-2xl p-5 mb-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Pending</p>
                  <p className="text-3xl font-bold text-white dark:text-black">{pendingCount} item{pendingCount !== 1 ? "s" : ""}</p>
                  {pendingTotal > 0 && (
                    <p className="text-gray-400 dark:text-gray-600 text-sm mt-1">≈ ETB {pendingTotal.toFixed(2)}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-gray-400 dark:text-gray-600 text-sm font-medium mb-1">Bought</p>
                  <p className="text-2xl font-bold text-white dark:text-black">{boughtCount}</p>
                  {totalCost > 0 && (
                    <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Total: ETB {totalCost.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Collapsible form */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${formOpen ? "max-h-[640px] opacity-100 mb-6" : "max-h-0 opacity-0"}`}>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-black dark:text-white mb-4">New Item</h2>
              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Item name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="What do you need to buy?"
                    required
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Price per unit (ETB)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">ETB</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-11 pr-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Urgency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["low", "medium", "high", "critical"] as ToBuyItem["urgency"][]).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUrgency(u)}
                        className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150 ${
                          urgency === u
                            ? u === "critical"
                              ? "bg-red-500 text-white"
                              : u === "high"
                              ? "bg-orange-400 text-white"
                              : u === "medium"
                              ? "bg-yellow-400 text-black"
                              : "bg-gray-400 text-white"
                            : "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                        }`}
                      >
                        {URGENCY_META[u].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Notes <span className="text-gray-400">(optional)</span></label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any details..."
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all duration-200"
                >
                  {submitting ? "Adding..." : "Add to List"}
                </button>
              </form>
            </div>
          </div>

          {/* Search + view filter */}
          <div className="space-y-3 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit">
              {(["pending", "all", "bought"] as ViewFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setViewFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-150 ${
                    viewFilter === f
                      ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {f === "pending" ? `Pending ${pendingCount > 0 ? `(${pendingCount})` : ""}` : f === "bought" ? `Bought ${boughtCount > 0 ? `(${boughtCount})` : ""}` : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-2xl h-16" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {search ? "No items match your search." : viewFilter === "bought" ? "Nothing bought yet." : "Your list is empty. Add something above."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending items grouped by urgency */}
              {grouped && Object.keys(grouped).length > 0 && (
                <div className="space-y-6">
                  {(["critical", "high", "medium", "low"] as ToBuyItem["urgency"][])
                    .filter(u => grouped[u]?.length)
                    .map(urgencyKey => (
                      <div key={urgencyKey}>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <div className={`w-2 h-2 rounded-full ${URGENCY_META[urgencyKey].dot}`} />
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            {URGENCY_META[urgencyKey].label}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-600">
                            {grouped[urgencyKey].length} item{grouped[urgencyKey].length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                          {grouped[urgencyKey].map((item, idx) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              isLast={idx === grouped[urgencyKey].length - 1}
                              togglingId={togglingId}
                              deletingId={deletingId}
                              onToggle={toggleBought}
                              onDelete={deleteItem}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Bought items (flat) */}
              {(viewFilter === "bought" || (viewFilter === "all" && boughtItems.length > 0)) && (
                <div>
                  {viewFilter === "all" && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Bought</span>
                    </div>
                  )}
                  <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    {boughtItems.map((item, idx) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isLast={idx === boughtItems.length - 1}
                        togglingId={togglingId}
                        deletingId={deletingId}
                        onToggle={toggleBought}
                        onDelete={deleteItem}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

// ── row component ──────────────────────────────────────────────────────────────

function ItemRow({
  item,
  isLast,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
}: {
  item: ToBuyItem
  isLast: boolean
  togglingId: string | null
  deletingId: string | null
  onToggle: (item: ToBuyItem) => void
  onDelete: (id: string) => void
}) {
  const URGENCY_META: Record<string, { badge: string }> = {
    critical: { badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    high:     { badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    medium:   { badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    low:      { badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  }

  const itemTotal = Number(item.price) * Number(item.quantity)

  return (
    <div className={`flex items-center gap-3 px-5 py-4 transition-colors ${item.bought ? "bg-gray-50 dark:bg-gray-950" : ""} ${!isLast ? "border-b border-gray-100 dark:border-gray-900" : ""}`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item)}
        disabled={togglingId === item.id}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
          item.bought
            ? "bg-black dark:bg-white border-black dark:border-white"
            : "border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white"
        } disabled:opacity-50`}
      >
        {item.bought && (
          <svg className="w-3 h-3 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${item.bought ? "line-through text-gray-400 dark:text-gray-600" : "text-black dark:text-white"}`}>
          {item.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Qty: {Number(item.quantity) % 1 === 0 ? Number(item.quantity) : Number(item.quantity).toFixed(2)}
          </span>
          {Number(item.price) > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              · ETB {Number(item.price).toFixed(2)} each
            </span>
          )}
          {item.notes && (
            <span className="text-xs text-gray-400 dark:text-gray-600 truncate max-w-[120px]">· {item.notes}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {itemTotal > 0 && (
          <span className={`text-sm font-bold ${item.bought ? "text-gray-400 dark:text-gray-600 line-through" : "text-black dark:text-white"}`}>
            ETB {itemTotal.toFixed(2)}
          </span>
        )}
        {!item.bought && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${URGENCY_META[item.urgency]?.badge}`}>
            {item.urgency}
          </span>
        )}
        <button
          onClick={() => onDelete(item.id)}
          disabled={deletingId === item.id}
          className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors duration-200 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  )
}
