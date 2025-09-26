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
          name: "completed",
          color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        }
      case 2:
        return {
          name: "in-progress",
          color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        }
      default:
        return {
          name: "pending",
          color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
        }
    }
  }

  const statusInfo = getStatusInfo(todo.status_id)

  return (
    <>
      <div
        className={`p-4 border rounded-lg ${todo.completed ? "bg-gray-50 dark:bg-gray-800 opacity-75" : "bg-white dark:bg-gray-700"} border-gray-200 dark:border-gray-600`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={toggleCompleted}
            disabled={loading}
            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center focus-ring ${
              todo.completed
                ? "bg-green-500 border-green-500 text-white"
                : "border-gray-300 dark:border-gray-600 hover:border-green-500"
            }`}
          >
            {todo.completed && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-medium ${todo.completed ? "line-through text-gray-500 dark:text-gray-400" : ""}`}>
                {todo.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                  {statusInfo.name}
                </span>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={loading}
                  className="text-red-500 hover:text-red-700 focus-ring p-1 rounded"
                  aria-label="Delete todo"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {todo.description && (
              <p
                className={`text-sm mt-1 ${todo.completed ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300"}`}
              >
                {todo.description}
              </p>
            )}

            {todo.notes && (
              <div className="mt-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus-ring"
                >
                  {isExpanded ? "Hide notes" : "Show notes"}
                </button>
                {isExpanded && (
                  <div
                    className={`mt-2 p-3 rounded bg-gray-50 dark:bg-gray-800 text-sm ${todo.completed ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{todo.notes}</pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <select
                value={todo.status_id}
                onChange={(e) => updateStatus(Number.parseInt(e.target.value))}
                disabled={loading}
                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 focus-ring"
              >
                <option value={1}>Pending</option>
                <option value={2}>In Progress</option>
                <option value={3}>Completed</option>
              </select>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(todo.created_at).toLocaleDateString()}
              </span>
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
      />
    </>
  )
}
