import { createServerSupabaseClient } from "@/lib/supabaseServer";
import ThemeToggle from "@/components/ThemeToggle"
import "./globals.css"
import SignOutButton from "@/components/SignOutButton";
import HomeClient from "@/components/HomeClient";

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

      <HomeClient user={user} />

    </div>
  )
}
