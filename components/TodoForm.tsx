"use client"

import type React from "react"

import { useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"

interface TodoFormProps {
  onTodoAdded: () => void
}

export default function TodoForm({ onTodoAdded }: TodoFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    notes: "",
    status_id: 1, // Changed from status string to status_id number
  })

  const supabase = createBrowserSupabaseClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      console.log("[v0] Starting todo submission...")

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      console.log("[v0] User data:", user)
      console.log("[v0] User error:", userError)

      if (userError) {
        console.error("[v0] Auth error:", userError)
        throw new Error(`Authentication error: ${userError.message}`)
      }

      if (!user) {
        console.error("[v0] No user found")
        throw new Error("Not authenticated")
      }

      const todoData = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null,
        status_id: formData.status_id, // Using status_id instead of status
        completed: formData.status_id === 3, // Set completed based on status_id
      }

      console.log("[v0] Inserting todo data:", todoData)

      const { data, error } = await supabase.from("todos").insert([todoData]).select()

      console.log("[v0] Insert result:", { data, error })

      if (error) {
        console.error("[v0] Database error:", error)
        throw new Error(`Database error: ${error.message}`)
      }

      setFormData({ title: "", description: "", notes: "", status_id: 1 }) // Reset to status_id: 1
      setIsOpen(false)
      onTodoAdded()
      console.log("[v0] Todo added successfully")
    } catch (error) {
      console.error("Error adding todo:", error)
      alert(`Failed to add todo: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full p-4 text-left text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:text-blue-500 transition-colors"
      >
        + Add new todo
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div>
        <input
          type="text"
          placeholder="Todo title *"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <input
          type="text"
          placeholder="Description (optional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <textarea
          placeholder="Notes (optional)"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <select
          value={formData.status_id} // Changed from status to status_id
          onChange={(e) => setFormData({ ...formData, status_id: Number.parseInt(e.target.value) })} // Parse as integer
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={1}>Pending</option> {/* Using numeric IDs */}
          <option value={2}>In Progress</option>
          <option value={3}>Completed</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !formData.title.trim()}
          className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          {loading ? "Adding..." : "Add Todo"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false)
            setFormData({ title: "", description: "", notes: "", status_id: 1 }) // Reset to status_id: 1
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
