"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import Modal from "./Modal"
import FriendCombobox from "./FriendCombobox"
import { CATEGORIES } from "@/lib/constants"
import { useCurrency } from "@/contexts/CurrencyContext"

type ModalType = "todo" | "expense" | "to-buy" | "debt" | "lending" | "friend"

const SECTIONS: { label: string; modal: ModalType; icon: string }[] = [
  { label: "Todo",    modal: "todo",    icon: "📋" },
  { label: "Expense", modal: "expense", icon: "💰" },
  { label: "To Buy",  modal: "to-buy",  icon: "🛒" },
  { label: "Debt",    modal: "debt",    icon: "↓"  },
  { label: "Lending", modal: "lending", icon: "↑"  },
  { label: "Friend",  modal: "friend",  icon: "👤" },
]

// Shared input/label/submit CSS strings
const INPUT = "w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-2xl text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-white/[0.06] focus:border-black dark:focus:border-volt focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 transition-all text-[0.9375rem]"
const LABEL = "block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-2"
const SUBMIT = "w-full h-12 mt-2 bg-black dark:bg-volt text-white dark:text-black font-bold rounded-2xl shadow-lg shadow-black/10 dark:shadow-volt/20 hover:opacity-90 disabled:opacity-40 disabled:shadow-none transition-all duration-200 text-[0.9375rem]"

function todayStr() { return new Date().toISOString().split("T")[0] }

// ── AddTodoForm ────────────────────────────────────────────────────────────────

function AddTodoForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle]       = useState("")
  const [desc, setDesc]         = useState("")
  const [notes, setNotes]       = useState("")
  const [statusId, setStatusId] = useState(1)
  const [dueDate, setDueDate]   = useState("")
  const [subtasks, setSubtasks] = useState<{ title: string; weight: number }[]>([])
  const [loading, setLoading]   = useState(false)

  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: todo, error } = await supabase.from("todos").insert({
      user_id: user.id,
      title: title.trim(),
      description: desc.trim() || null,
      notes: notes.trim() || null,
      status_id: statusId,
      completed: statusId === 3,
      due_date: dueDate || null,
      updated_at: new Date().toISOString(),
    }).select().single()

    if (!error && todo) {
      const valid = subtasks.filter(s => s.title.trim())
      if (valid.length > 0) {
        await supabase.from("subtasks").insert(
          valid.map(s => ({ todo_id: todo.id, title: s.title.trim(), weight: s.weight, completed: false }))
        )
      }
      onDone()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL}>Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="What needs to be done?" className={INPUT} autoFocus />
      </div>
      <div>
        <label className={LABEL}>Description</label>
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description (optional)" className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Subtasks ({subtasks.length})</label>
        <div className="space-y-2 mb-2">
          {subtasks.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <input type="text" value={s.title} onChange={e => {
                  const next = [...subtasks]
                  if (!e.target.value) next.splice(i, 1)
                  else next[i] = { ...next[i], title: e.target.value }
                  setSubtasks(next)
                }} placeholder="Subtask name" className={INPUT} />
              </div>
              <input type="number" min="1" max="5" value={s.weight} onChange={e => {
                const next = [...subtasks]; next[i] = { ...next[i], weight: parseInt(e.target.value) || 1 }; setSubtasks(next)
              }} className="w-14 shrink-0 px-2 py-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-2xl text-black dark:text-white text-center font-semibold focus:outline-none focus:border-black dark:focus:border-volt focus:ring-4 focus:ring-black/5 dark:focus:ring-volt/15 transition-all text-[0.9375rem]" />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setSubtasks(prev => [...prev, { title: "", weight: 1 }])} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-volt-800 dark:text-volt bg-volt-100 dark:bg-volt/10 hover:bg-volt-200 dark:hover:bg-volt/20 transition-colors">
          + Add subtask
        </button>
      </div>
      <div>
        <label className={LABEL}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes (optional)" rows={2} className={`${INPUT} resize-none`} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT} />
        </div>
        <div className="flex-1">
          <label className={LABEL}>Status</label>
          <select value={statusId} onChange={e => setStatusId(Number(e.target.value))} className={INPUT}>
            <option value={1}>📋 Pending</option>
            <option value={2}>⚡ In Progress</option>
            <option value={3}>✅ Completed</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={loading || !title.trim()} className={SUBMIT}>
        {loading ? "Creating..." : "Create Todo"}
      </button>
    </form>
  )
}

// ── AddExpenseForm ─────────────────────────────────────────────────────────────

function AddExpenseForm({ onDone }: { onDone: () => void }) {
  const [amount, setAmount]         = useState("")
  const [description, setDesc]      = useState("")
  const [category, setCategory]     = useState("Food & Drinks")
  const [date, setDate]             = useState(todayStr())
  const [loading, setLoading]       = useState(false)
  const { currency }                = useCurrency()
  const supabase                    = useMemo(() => createBrowserSupabaseClient(), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from("expenses").insert({
      user_id: user.id, amount: parsed,
      description: description.trim() || null, category, date,
    })
    if (!error) onDone()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">{currency}</span>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className={`${INPUT} pl-11`} autoFocus />
          </div>
        </div>
        <div>
          <label className={LABEL}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Description</label>
        <input type="text" value={description} onChange={e => setDesc(e.target.value)} placeholder="What did you spend on?" className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} className={INPUT}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button type="submit" disabled={loading} className={SUBMIT}>
        {loading ? "Saving..." : "Add Expense"}
      </button>
    </form>
  )
}

// ── AddToBuyForm ───────────────────────────────────────────────────────────────

function AddToBuyForm({ onDone }: { onDone: () => void }) {
  const [name, setName]         = useState("")
  const [quantity, setQuantity] = useState("1")
  const [price, setPrice]       = useState("")
  const [urgency, setUrgency]   = useState<"low"|"medium"|"high"|"critical">("medium")
  const [notes, setNotes]       = useState("")
  const [loading, setLoading]   = useState(false)
  const { currency }            = useCurrency()
  const supabase                = useMemo(() => createBrowserSupabaseClient(), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from("to_buy_items").insert({
      user_id: user.id, name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      price: parseFloat(price) || 0,
      urgency, notes: notes.trim() || null,
    })
    if (!error) onDone()
    setLoading(false)
  }

  const urgencyMeta = { critical: "bg-rose-500 text-white shadow-md shadow-rose-500/30", high: "bg-orange-400 text-white shadow-md shadow-orange-400/30", medium: "bg-amber-300 text-black shadow-md shadow-amber-300/30", low: "bg-gray-500 text-white shadow-md shadow-gray-500/30" }
  const inactiveCls = "bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.09]"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL}>Item name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="What do you need to buy?" className={INPUT} autoFocus />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Quantity</label>
          <input type="number" step="0.01" min="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT} />
        </div>
        <div className="flex-1">
          <label className={LABEL}>Price ({currency})</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">{currency}</span>
            <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className={`${INPUT} pl-11`} />
          </div>
        </div>
      </div>
      <div>
        <label className={LABEL}>Urgency</label>
        <div className="grid grid-cols-4 gap-2">
          {(["low","medium","high","critical"] as const).map(u => (
            <button key={u} type="button" onClick={() => setUrgency(u)}
              className={`py-2.5 rounded-2xl text-xs font-bold capitalize transition-all duration-150 ${urgency === u ? urgencyMeta[u] : inactiveCls}`}
            >{u}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={LABEL}>Notes <span className="text-gray-400">(optional)</span></label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any details..." className={INPUT} />
      </div>
      <button type="submit" disabled={loading || !name.trim()} className={SUBMIT}>
        {loading ? "Saving..." : "Add to List"}
      </button>
    </form>
  )
}

// ── AddDebtForm ────────────────────────────────────────────────────────────────

function AddDebtForm({ onDone }: { onDone: () => void }) {
  const [person, setPerson]     = useState("")
  const [amount, setAmount]     = useState("")
  const [date, setDate]         = useState(todayStr())
  const [deadline, setDeadline] = useState("")
  const [loading, setLoading]   = useState(false)
  const [userId, setUserId]     = useState("")
  const { currency }            = useCurrency()
  const supabase                = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [supabase])

  const ensureFriend = async (name: string) => {
    if (!userId || !name.trim()) return
    const { data } = await supabase.from("friends").select("id").eq("user_id", userId).eq("name", name.trim()).maybeSingle()
    if (!data) await supabase.from("friends").insert({ user_id: userId, name: name.trim() })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || !person.trim() || !userId) return
    setLoading(true)

    const { error } = await supabase.from("debts").insert({
      user_id: userId, person: person.trim(), amount: parsed,
      date, deadline: deadline || null,
    })
    if (!error) {
      await ensureFriend(person.trim())
      onDone()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FriendCombobox value={person} onChange={setPerson} userId={userId} label="Lender (who you owe)" placeholder="Name" required />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">{currency}</span>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className={`${INPUT} pl-11`} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Deadline <span className="text-gray-400">(optional)</span></label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={INPUT} />
      </div>
      <button type="submit" disabled={loading} className={SUBMIT}>
        {loading ? "Saving..." : "Add Debt"}
      </button>
    </form>
  )
}

// ── AddLendingForm ─────────────────────────────────────────────────────────────

function AddLendingForm({ onDone }: { onDone: () => void }) {
  const [person, setPerson]     = useState("")
  const [amount, setAmount]     = useState("")
  const [date, setDate]         = useState(todayStr())
  const [deadline, setDeadline] = useState("")
  const [loading, setLoading]   = useState(false)
  const [userId, setUserId]     = useState("")
  const { currency }            = useCurrency()
  const supabase                = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [supabase])

  const ensureFriend = async (name: string) => {
    if (!userId || !name.trim()) return
    const { data } = await supabase.from("friends").select("id").eq("user_id", userId).eq("name", name.trim()).maybeSingle()
    if (!data) await supabase.from("friends").insert({ user_id: userId, name: name.trim() })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || !person.trim() || !userId) return
    setLoading(true)

    const { error } = await supabase.from("lendings").insert({
      user_id: userId, person: person.trim(), amount: parsed,
      date, deadline: deadline || null,
    })
    if (!error) {
      await ensureFriend(person.trim())
      onDone()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FriendCombobox value={person} onChange={setPerson} userId={userId} label="Borrower (who owes you)" placeholder="Name" required />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">{currency}</span>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className={`${INPUT} pl-11`} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Deadline <span className="text-gray-400">(optional)</span></label>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={INPUT} />
      </div>
      <button type="submit" disabled={loading} className={SUBMIT}>
        {loading ? "Saving..." : "Add Lending"}
      </button>
    </form>
  )
}

// ── AddFriendForm ──────────────────────────────────────────────────────────────

function AddFriendForm({ onDone }: { onDone: () => void }) {
  const [name, setName]     = useState("")
  const [loading, setLoading] = useState(false)
  const supabase              = useMemo(() => createBrowserSupabaseClient(), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: existing } = await supabase.from("friends").select("id").eq("user_id", user.id).eq("name", name.trim()).maybeSingle()
    if (!existing) {
      await supabase.from("friends").insert({ user_id: user.id, name: name.trim() })
    }
    onDone()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL}>Name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Friend's name" className={INPUT} autoFocus />
      </div>
      <button type="submit" disabled={loading || !name.trim()} className={SUBMIT}>
        {loading ? "Adding..." : "Add Friend"}
      </button>
    </form>
  )
}

// ── QuickAddFAB ────────────────────────────────────────────────────────────────

export default function QuickAddFAB() {
  const [open, setOpen]               = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType | null>(null)

  const handleSection = (modal: ModalType) => {
    setOpen(false)
    setActiveModal(modal)
  }

  const closeModal = () => setActiveModal(null)

  const doneAndRefresh = (type: string) => {
    window.dispatchEvent(new CustomEvent("refresh-data", { detail: { type } }))
    closeModal()
  }

  const MODAL_TITLES: Record<ModalType, string> = {
    "todo":    "Add Todo",
    "expense": "Add Expense",
    "to-buy":  "Add to Shopping List",
    "debt":    "Add Debt",
    "lending": "Add Lending",
    "friend":  "Add Friend",
  }

  return (
    <>
      {/* Backdrop to close the section picker */}
      {open && (
        <div className="fixed inset-0 z-[90] bg-black/25 dark:bg-black/50 backdrop-blur-[3px] animate-fade-in" onClick={() => setOpen(false)} />
      )}

      <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+1.125rem)] lg:left-auto lg:translate-x-0 lg:right-8 lg:bottom-8 flex flex-col items-center lg:items-end gap-3">
        {/* Section buttons */}
        {open && (
          <div className="w-[min(21rem,calc(100vw-2rem))] grid grid-cols-3 gap-1 p-2 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] rounded-[1.75rem] shadow-2xl animate-pop-in">
            <p className="col-span-3 px-3 pt-2 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Quick add</p>
            {SECTIONS.map((s, i) => (
              <button
                key={s.modal}
                onClick={() => handleSection(s.modal)}
                style={{ animationDelay: `${i * 35}ms` }}
                className="group animate-pop-in flex flex-col items-center gap-2 py-3.5 rounded-2xl text-xs font-bold text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <span className="w-12 h-12 grid place-items-center rounded-2xl bg-gray-100 dark:bg-white/[0.06] group-hover:bg-volt group-hover:text-black text-lg font-bold transition-colors">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-black/20 dark:focus-visible:ring-white/30 ${open ? "bg-black text-white dark:bg-white dark:text-black shadow-xl" : "bg-volt text-black shadow-[0_10px_28px_-6px_rgb(200_244_58/0.75)] hover:shadow-[0_14px_34px_-6px_rgb(200_244_58/0.9)] hover:-translate-y-0.5"}`}
          aria-label="Quick add"
        >
          <svg
            className={`w-6 h-6 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? "rotate-[135deg]" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Global modals — all accessible from every page */}
      {activeModal && (
        <Modal
          open={true}
          onClose={closeModal}
          title={MODAL_TITLES[activeModal]}
        >
          {activeModal === "todo"    && <AddTodoForm    onDone={() => doneAndRefresh("todo")}    />}
          {activeModal === "expense" && <AddExpenseForm onDone={() => doneAndRefresh("expense")} />}
          {activeModal === "to-buy"  && <AddToBuyForm   onDone={() => doneAndRefresh("to-buy")}  />}
          {activeModal === "debt"    && <AddDebtForm    onDone={() => doneAndRefresh("debt")}    />}
          {activeModal === "lending" && <AddLendingForm onDone={() => doneAndRefresh("lending")} />}
          {activeModal === "friend"  && <AddFriendForm  onDone={() => doneAndRefresh("friend")}  />}
        </Modal>
      )}
    </>
  )
}
