"use client"

import { useState, useEffect } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";
import TodoItem from "./TodoItem"
import TodoForm from "./TodoForm"

interface Subtask {
  id: string
  title: string
  completed: boolean
  weight: number
  created_at: string
}

interface Todo {
  id: string
  title: string
  description: string | null
  notes: string | null
  status: string
  completed: boolean
  created_at: string
  status_id: number
  subtasks?: Subtask[]
}

interface TodoListProps {
  loading: boolean 
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
}

const TodoList: React.FC<TodoListProps>= ({ loading, setLoading }) => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all")
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const supabase = createBrowserSupabaseClient()

  const fetchTodos = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("todos")
      .select(`
        *,
        subtasks (
          id,
          title,
          completed,
          weight,
          created_at
        )
      `)
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

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo)
  }

  const handleEditComplete = () => {
    setEditingTodo(null)
    fetchTodos()
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
      <div className="space-y-6">
        {/* Loading skeleton for form */}
        <div className="skeleton rounded-2xl h-16"></div>
        
        {/* Loading skeleton for stats */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <div className="skeleton rounded-lg h-6 w-24"></div>
            <div className="skeleton rounded-lg h-6 w-28"></div>
          </div>
          <div className="flex gap-1">
            <div className="skeleton rounded-lg h-8 w-16"></div>
            <div className="skeleton rounded-lg h-8 w-20"></div>
            <div className="skeleton rounded-lg h-8 w-24"></div>
          </div>
        </div>
        
        {/* Loading skeleton for todos */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-24"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="animate-slide-in-down">
        <TodoForm 
          onTodoAdded={fetchTodos} 
          editingTodo={editingTodo}
          onEditComplete={handleEditComplete}
        />
      </div>

      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-black dark:text-white font-medium">
              Pending: <span className="font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-black dark:text-white font-medium">
              Completed: <span className="font-bold text-green-600 dark:text-green-400">{completedCount}</span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {(["all", "pending", "completed"] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 text-sm font-medium rounded-xl capitalize focus-ring transition-all duration-200 btn-hover ${
                filter === filterOption
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-lg"
                  : "bg-gray-100 dark:bg-gray-900 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredTodos.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              {filter === "all" ? "No todos yet" : `No ${filter} todos`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filter === "all" ? "Create your first todo to get started!" : `You don't have any ${filter} todos right now.`}
            </p>
          </div>
        ) : (
          filteredTodos.map((todo, index) => (
            <div
              key={todo.id}
              className="animate-slide-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <TodoItem 
                todo={todo} 
                onTodoUpdated={fetchTodos} 
                onEditTodo={handleEditTodo}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}


export default TodoList;