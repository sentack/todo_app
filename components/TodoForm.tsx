"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"

interface Subtask {
  id?: string
  title: string
  weight: number
  completed?: boolean
}

interface Todo {
  id: string
  title: string
  description: string | null
  notes: string | null
  status_id: number
  completed: boolean
  subtasks?: Subtask[]
}

interface TodoFormProps {
  onTodoAdded: () => void
  editingTodo?: Todo | null
  onEditComplete?: () => void
}

export default function TodoForm({ onTodoAdded, editingTodo, onEditComplete }: TodoFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    notes: "",
    status_id: 1,
  })
  const [subtasks, setSubtasks] = useState<Subtask[]>([])

  const supabase = createBrowserSupabaseClient()

  // Load editing todo data
  useEffect(() => {
    if (editingTodo) {
      setFormData({
        title: editingTodo.title,
        description: editingTodo.description || "",
        notes: editingTodo.notes || "",
        status_id: editingTodo.status_id,
      })
      setSubtasks(editingTodo.subtasks || [])
      setIsOpen(true)
    }
  }, [editingTodo])

  const addSubtask = () => {
    setSubtasks([...subtasks, { title: "", weight: 1 }])
  }

  const updateSubtask = (index: number, field: keyof Subtask, value: string | number) => {
    const newSubtasks = [...subtasks]
    if (field === 'title' && typeof value === 'string') {
      newSubtasks[index].title = value
      // If title is cleared, remove the subtask
      if (value === '') {
        newSubtasks.splice(index, 1)
      }
    } else if (field === 'weight' && typeof value === 'number') {
      newSubtasks[index].weight = Math.max(1, Math.min(5, value))
    }
    setSubtasks(newSubtasks)
  }

  const handleSubtaskTitleChange = (index: number, value: string) => {
    const newSubtasks = [...subtasks]
    
    if (index >= newSubtasks.length) {
      // Adding new subtask
      if (value.trim()) {
        newSubtasks.push({ title: value, weight: 1 })
      }
    } else {
      // Updating existing subtask
      if (value === '') {
        // Remove subtask if title is cleared
        newSubtasks.splice(index, 1)
      } else {
        newSubtasks[index].title = value
      }
    }
    
    setSubtasks(newSubtasks)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      console.log(editingTodo ? "[v0] Starting todo update..." : "[v0] Starting todo submission...")

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("[v0] Auth error:", userError)
        throw new Error(`Authentication error: ${userError.message}`)
      }

      if (!user) {
        console.error("[v0] No user found")
        throw new Error("Not authenticated")
      }

      // Filter out subtasks with empty titles
      const validSubtasks = subtasks.filter(subtask => subtask.title.trim() !== '')

      const todoData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null,
        status_id: formData.status_id,
        completed: formData.status_id === 3,
        updated_at: new Date().toISOString(),
      }

      let todoId: string

      if (editingTodo) {
        // Update existing todo
        const { data, error } = await supabase
          .from("todos")
          .update(todoData)
          .eq("id", editingTodo.id)
          .select()
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          throw new Error(`Database error: ${error.message}`)
        }

        todoId = editingTodo.id

        // Delete existing subtasks
        await supabase
          .from("subtasks")
          .delete()
          .eq("todo_id", todoId)
      } else {
        // Create new todo
        const { data, error } = await supabase
          .from("todos")
          .insert([{ ...todoData, user_id: user.id }])
          .select()
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          throw new Error(`Database error: ${error.message}`)
        }

        todoId = data.id
      }

      // Insert subtasks if any
      if (validSubtasks.length > 0) {
        const subtaskData = validSubtasks.map(subtask => ({
          todo_id: todoId,
          title: subtask.title.trim(),
          weight: subtask.weight,
          completed: subtask.completed || false,
        }))

        const { error: subtaskError } = await supabase
          .from("subtasks")
          .insert(subtaskData)

        if (subtaskError) {
          console.error("[v0] Subtask error:", subtaskError)
          throw new Error(`Subtask error: ${subtaskError.message}`)
        }
      }

      // Reset form
      setFormData({ title: "", description: "", notes: "", status_id: 1 })
      setSubtasks([])
      setIsOpen(false)
      
      if (editingTodo && onEditComplete) {
        onEditComplete()
      } else {
        onTodoAdded()
      }
      
      console.log(editingTodo ? "[v0] Todo updated successfully" : "[v0] Todo added successfully")
    } catch (error) {
      console.error(editingTodo ? "Error updating todo:" : "Error adding todo:", error)
      alert(`Failed to ${editingTodo ? 'update' : 'add'} todo: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    setFormData({ title: "", description: "", notes: "", status_id: 1 })
    setSubtasks([])
    if (editingTodo && onEditComplete) {
      onEditComplete()
    }
  }

  if (!isOpen) {
    return (
      <div className="group">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full p-6 text-left border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl hover:border-black dark:hover:border-white transition-all duration-300 btn-hover group-hover:bg-gray-50 dark:group-hover:bg-gray-950"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-900 group-hover:bg-black dark:group-hover:bg-white flex items-center justify-center transition-all duration-300">
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-white dark:group-hover:text-black transition-colors duration-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-black dark:text-white group-hover:text-black dark:group-hover:text-white">Add new todo</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Click to create a new task</p>
            </div>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="animate-slide-in-down">
      <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center">
            <svg className="w-4 h-4 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
              {editingTodo ? (
                <path fillRule="evenodd" d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              )}
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-black dark:text-white">
            {editingTodo ? 'Edit Todo' : 'Create New Todo'}
          </h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Title *
            </div>
          </label>
          <input
            type="text"
            placeholder="What needs to be done?"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-black text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all duration-200"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
              Description
            </div>
          </label>
          <input
            type="text"
            placeholder="Brief description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-black text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Subtasks ({subtasks.length + 1})
            </div>
          </label>
          <div className="space-y-3">
            {subtasks.map((subtask, index) => (
              <div key={index} className="flex gap-3 items-center">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Subtask title"
                    value={subtask.title}
                    onChange={(e) => handleSubtaskTitleChange(index, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all duration-200"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={subtask.weight}
                    onChange={(e) => updateSubtask(index, 'weight', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all duration-200 text-center"
                  />
                </div>
              </div>
            ))}
            {/* Always show one empty input for new subtask */}
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Add new subtask..."
                  value=""
                  onChange={(e) => handleSubtaskTitleChange(subtasks.length, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all duration-200"
                />
              </div>
              <div className="w-20">
                <input
                  type="number"
                  min="1"
                  max="5"
                  value="1"
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-center"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addSubtask}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus-ring rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Subtask
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Notes
            </div>
          </label>
          <textarea
            placeholder="Additional notes or details (optional)"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-black text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent resize-none transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
              </svg>
              Status
            </div>
          </label>
          <select
            value={formData.status_id}
            onChange={(e) => setFormData({ ...formData, status_id: Number.parseInt(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all duration-200"
          >
            <option value={1}>📋 Pending</option>
            <option value={2}>⚡ In Progress</option>
            <option value={3}>✅ Completed</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !formData.title.trim()}
            className="flex-1 px-6 py-3 text-sm font-semibold text-white dark:text-black bg-black dark:bg-white rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 btn-hover flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {editingTodo ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  {editingTodo ? (
                    <path fillRule="evenodd" d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  )}
                </svg>
                {editingTodo ? 'Update Todo' : 'Create Todo'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 text-sm font-semibold text-black dark:text-white bg-gray-100 dark:bg-gray-900 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-200 btn-hover flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}