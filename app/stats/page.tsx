"use client"

import { useState, useEffect } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface TodoStats {
  period: string
  created: number
  inProgress: number
  completed: number
}

interface LongestTodo {
  id: string
  title: string
  days: number
  status_name: string
}

interface FastestTodo {
  id: string
  title: string
  hours: number
}

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TodoStats[]>([])
  const [longestTodos, setLongestTodos] = useState<LongestTodo[]>([])
  const [fastestTodos, setFastestTodos] = useState<FastestTodo[]>([])
  
  const supabase = createBrowserSupabaseClient()
  const router = useRouter()

  useEffect(() => {    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    checkAuthAndFetchStats()    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuthAndFetchStats = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error) throw error
      if (!user) {
        router.push("/")
        return
      }

      await Promise.all([
        fetchPeriodStats(user.id),
        fetchLongestTodos(user.id),
        fetchFastestTodos(user.id),
      ])
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPeriodStats = async (userId: string) => {
    const periods = [
      { name: "Past Day", days: 1 },
      { name: "Past 7 Days", days: 7 },
      { name: "Past 30 Days", days: 30 },
    ]

    const periodStats: TodoStats[] = []

    for (const period of periods) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - period.days)

      // Get todos created in this period
      const { data: createdTodos } = await supabase
        .from("todos")
        .select("status_id")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString())

      // Get todos in progress (status_id = 2)
      const inProgress = createdTodos?.filter(todo => todo.status_id === 2).length || 0
      
      // Get todos completed (status_id = 3)
      const completed = createdTodos?.filter(todo => todo.status_id === 3).length || 0
      
      // Total created
      const created = createdTodos?.length || 0

      periodStats.push({
        period: period.name,
        created,
        inProgress,
        completed,
      })
    }

    setStats(periodStats)
  }

  const fetchLongestTodos = async (userId: string) => {
    const { data } = await supabase
      .from("todos")
      .select(`
        id,
        title,
        created_at,
        updated_at,
        status_id,
        todo_status!inner(name)
      `)
      .eq("user_id", userId)
      .neq("status_id", 3) // Exclude completed todos
      .order("created_at", { ascending: true })
      .limit(3)

    if (data) {
      const longest = data.map(todo => {
        const createdDate = new Date(todo.created_at)
        const updatedDate = new Date(todo.updated_at)
        const diffTime = Math.abs(updatedDate.getTime() - createdDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return {
          id: todo.id,
          title: todo.title,
          days: diffDays,
          status_name: (todo.todo_status as any).name,
        }
      })

      setLongestTodos(longest)
    }
  }

  const fetchFastestTodos = async (userId: string) => {
    const { data } = await supabase
      .from("todos")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .eq("status_id", 3) // Only completed todos
      .order("updated_at", { ascending: false })
      .limit(10) // Get more to filter the fastest

    if (data) {
      const fastest = data
        .map(todo => {
          const createdDate = new Date(todo.created_at)
          const updatedDate = new Date(todo.updated_at)
          const diffTime = Math.abs(updatedDate.getTime() - createdDate.getTime())
          const diffHours = diffTime / (1000 * 60 * 60)

          return {
            id: todo.id,
            title: todo.title,
            hours: Math.round(diffHours * 10) / 10, // Round to 1 decimal
          }
        })
        .sort((a, b) => a.hours - b.hours) // Sort by fastest first
        .slice(0, 3) // Take top 3

      setFastestTodos(fastest)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="skeleton rounded-2xl h-8 w-48"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton rounded-2xl h-48"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in-down">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-black dark:text-white">Statistics</h1>
          </div>

          <Link  href="/" className="text-xl font-bold text-black dark:text-white">
            Back
          </Link>
          </div>

          <div className="space-y-8">
            {/* Period Stats */}
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-white mb-6">Todo Activity</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                  <div
                    key={stat.period}
                    className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl animate-slide-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <h3 className="text-lg font-semibold text-black dark:text-white mb-4">{stat.period}</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Created</span>
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{stat.created}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">In Progress</span>
                        </div>
                        <span className="font-bold text-yellow-600 dark:text-yellow-400">{stat.inProgress}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
                        </div>
                        <span className="font-bold text-green-600 dark:text-green-400">{stat.completed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Longest Running Todos */}
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-white mb-6">Longest Running Todos</h2>
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
                {longestTodos.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No active todos found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {longestTodos.map((todo, index) => (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl animate-slide-in-up"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-black dark:text-white truncate">{todo.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{todo.status_name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{todo.days}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">days</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Fastest Completed Todos */}
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-white mb-6">Fastest Completed Todos</h2>
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl">
                {fastestTodos.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No completed todos found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fastestTodos.map((todo, index) => (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl animate-slide-in-up"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-black dark:text-white truncate">{todo.title}</h3>
                          <div className="flex items-center gap-1 mt-1">
                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-green-600 dark:text-green-400">Completed</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">{todo.hours}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">hours</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}