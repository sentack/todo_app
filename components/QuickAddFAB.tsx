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
const INPUT = "w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"
const LABEL = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5"
const SUBMIT = "w-full py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all duration-200 text-sm"

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
            <div key={i} className="flex gap-2">
              <input type="text" value={s.title} onChange={e => {
                const next = [...subtasks]
                if (!e.target.value) next.splice(i, 1)
                else next[i] = { ...next[i], title: e.target.value }
                setSubtasks(next)
              }} placeholder="Subtask" className={`${INPUT} flex-1`} />
              <input type="number" min="1" max="5" value={s.weight} onChange={e => {
                const next = [...subtasks]; next[i] = { ...next[i], weight: parseInt(e.target.value) || 1 }; setSubtasks(next)
              }} className={`${INPUT} w-16 text-center`} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setSubtasks(prev => [...prev, { title: "", weight: 1 }])} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
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

  const urgencyMeta = { critical: "bg-red-500 text-white", high: "bg-orange-400 text-white", medium: "bg-yellow-400 text-black", low: "bg-gray-400 text-white" }
  const inactiveCls = "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"

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
              className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150 ${urgency === u ? urgencyMeta[u] : inactiveCls}`}
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
        <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
      )}

      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
        {/* Section buttons */}
        {open && (
          <div className="flex flex-col items-end gap-2 animate-slide-in-up">
            {SECTIONS.map(s => (
              <button
                key={s.modal}
                onClick={() => handleSection(s.modal)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg text-sm font-semibold text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-14 h-14 rounded-full bg-black dark:bg-white text-white dark:text-black shadow-2xl flex items-center justify-center hover:opacity-80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2"
          aria-label="Quick add"
        >
          <svg
            className={`w-6 h-6 transition-transform duration-200 ${open ? "rotate-45" : ""}`}
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
