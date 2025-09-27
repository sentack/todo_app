import { createServerSupabaseClient } from "@/lib/supabaseServer";
import LoginForm from "@/components/LoginForm"
import ThemeToggle from "@/components/ThemeToggle"
import TodoList from "@/components/TodoList"
import "./globals.css"
import SignOutButton from "@/components/SignOutButton";

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header className="bg-white dark:bg-black shadow-lg border-b border-gray-200 dark:border-gray-800 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-black dark:text-white">TodoFlow</h1>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              {user && 
              <SignOutButton user={user} />
              }
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <div className="animate-fade-in">
            <TodoList />
          </div>
        ) : (
          <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
            <div className="w-full max-w-md animate-slide-in-up">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-black dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-white dark:text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-black dark:text-white mb-3">Welcome to TodoFlow</h2>
                <p className="text-gray-600 dark:text-gray-400">Organize your tasks with style and efficiency</p>
              </div>
              <LoginForm />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
