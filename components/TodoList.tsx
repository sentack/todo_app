"use client"

import { useState, useEffect } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";
import TodoItem from "./TodoItem"
import TodoForm from "./TodoForm"

interface Todo {
  id: string
  title: string
  description: string | null
  notes: string | null
  status: string
  completed: boolean
  created_at: string
  status_id: number 
}

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all")
  const supabase = createBrowserSupabaseClient()

  const fetchTodos = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTodos(data || [])
    } catch (error) {
      console.error("Error fetching todos:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const filteredTodos = todos.filter((todo) => {
    if (filter === "pending") return !todo.completed
    if (filter === "completed") return todo.completed
    return true
  })

  const pendingCount = todos.filter((todo) => !todo.completed).length
  const completedCount = todos.filter((todo) => todo.completed).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TodoForm onTodoAdded={fetchTodos} />

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Pending: <span className="font-semibold text-yellow-600 dark:text-yellow-400">{pendingCount}</span>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            Completed: <span className="font-semibold text-green-600 dark:text-green-400">{completedCount}</span>
          </span>
        </div>

        <div className="flex gap-1">
          {(["all", "pending", "completed"] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-3 py-1 text-sm rounded-lg capitalize focus-ring ${
                filter === filterOption
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredTodos.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {filter === "all" ? "No todos yet. Add one above!" : `No ${filter} todos.`}
          </div>
        ) : (
          filteredTodos.map((todo) => <TodoItem key={todo.id} todo={todo} onTodoUpdated={fetchTodos} />)
        )}
      </div>
    </div>
  )
}
