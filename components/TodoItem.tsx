"use client"

import { useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import ConfirmModal from "./ConfirmModal"

interface Todo {
  id: string
  title: string
  description: string | null
  notes: string | null
  status_id: number 
  completed: boolean
  created_at: string
}

interface TodoItemProps {
  todo: Todo
  onTodoUpdated: () => void
}

export default function TodoItem({ todo, onTodoUpdated }: TodoItemProps) {
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const supabase = createBrowserSupabaseClient()

  const toggleCompleted = async () => {
    setLoading(true)
    try {
      console.log("[v0] Toggling todo completion:", { todoId: todo.id, currentCompleted: todo.completed })

      const { data, error } = await supabase
        .from("todos")
        .update({
          completed: !todo.completed,
          status_id: !todo.completed ? 3 : 1, // 3 = completed, 1 = pending
          updated_at: new Date().toISOString(),
        })
        .eq("id", todo.id)
        .select()

      console.log("[v0] Update result:", { data, error })

      if (error) {
        console.error("[v0] Supabase error details:", error)
        throw error
      }

      onTodoUpdated()
    } catch (error) {
      console.error("Error updating todo:", error)
      console.error("[v0] Full error object:", JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatusId: number) => {
    setLoading(true)
    try {
      console.log("[v0] Updating status:", { todoId: todo.id, newStatusId })

      const { data, error } = await supabase
        .from("todos")
        .update({
          status_id: newStatusId,
          completed: newStatusId === 3, // 3 = completed
          updated_at: new Date().toISOString(),
        })
        .eq("id", todo.id)
        .select()

      console.log("[v0] Status update result:", { data, error })

      if (error) {
        console.error("[v0] Supabase error details:", error)
        throw error
      }

      onTodoUpdated()
    } catch (error) {
      console.error("Error updating status:", error)
      console.error("[v0] Full error object:", JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const deleteTodo = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.from("todos").delete().eq("id", todo.id)

      if (error) throw error
      onTodoUpdated()
      setShowDeleteModal(false)
    } catch (error) {
      console.error("Error deleting todo:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (statusId: number) => {
    switch (statusId) {
      case 3:
        return {
          name: "Completed",
          color: "status-completed",
          icon: "✅",
        }
      case 2:
        return {
          name: "In Progress",
          color: "status-progress",
          icon: "⚡",
        }
      default:
        return {
          name: "Pending",
          color: "status-pending",
          icon: "📋",
        }
    }
  }

  const statusInfo = getStatusInfo(todo.status_id)

  return (
    <>
      <div
        className={`p-6 border rounded-2xl transition-all duration-300 hover:shadow-lg ${
          todo.completed 
            ? "bg-gray-50 dark:bg-gray-950 opacity-75 border-gray-200 dark:border-gray-800" 
            : "bg-white dark:bg-black border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
        }`}
      >
        <div className="flex items-start gap-4">
          <button
            onClick={toggleCompleted}
            disabled={loading}
            className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center focus-ring transition-all duration-200 btn-hover ${
              todo.completed
                ? "bg-green-500 border-green-500 text-white shadow-lg"
                : "border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950"
            }`}
          >
            {todo.completed && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className={`font-semibold text-lg ${
                todo.completed 
                  ? "line-through text-gray-500 dark:text-gray-400" 
                  : "text-black dark:text-white"
              }`}>
                {todo.title}
              </h3>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${statusInfo.color}`}>
                  <span>{statusInfo.icon}</span>
                  <span>{statusInfo.name}</span>
                </span>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={loading}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 focus-ring p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-all duration-200 btn-hover"
                  aria-label="Delete todo"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M10 5a1 1 0 011 1v6a1 1 0 11-2 0V6a1 1 0 011-1zM6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {todo.description && (
              <p className={`text-sm mt-2 ${
                todo.completed 
                  ? "text-gray-400 dark:text-gray-500" 
                  : "text-gray-600 dark:text-gray-300"
              }`}>
                {todo.description}
              </p>
            )}

            {todo.notes && (
              <div className="mt-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus-ring px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200 flex items-center gap-1"
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  {isExpanded ? "Hide notes" : "Show notes"}
                </button>
                {isExpanded && (
                  <div
                    className={`mt-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-950 text-sm border border-gray-200 dark:border-gray-800 animate-slide-in-down ${
                      todo.completed 
                        ? "text-gray-400 dark:text-gray-500" 
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{todo.notes}</pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-900">
              <select
                value={todo.status_id}
                onChange={(e) => updateStatus(Number.parseInt(e.target.value))}
                disabled={loading}
                className="text-sm px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white focus-ring transition-all duration-200"
              >
                <option value={1}>📋 Pending</option>
                <option value={2}>⚡ In Progress</option>
                <option value={3}>✅ Completed</option>
              </select>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>{new Date(todo.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={deleteTodo}
        title="Delete Todo"
        message={`Are you sure you want to delete "${todo.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={loading}
        confirmationText="DELETE"
      />
    </>
  )
}
