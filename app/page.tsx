import { createServerSupabaseClient } from "@/lib/supabaseServer";
import AuthButton from "@/components/AuthButton"
import ThemeToggle from "@/components/ThemeToggle"
import TodoList from "@/components/TodoList"
import "./globals.css"

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Todo App</h1>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <AuthButton user={user} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <TodoList />
        ) : (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Todo App</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">Sign in with Google to start managing your todos</p>
              <div className="flex justify-center">
                <AuthButton user={user} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
