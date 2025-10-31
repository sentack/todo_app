"use client"

import React, { useState } from "react"
import Sidebar from "./Sidebar"
import ThemeToggle from "./ThemeToggle"
import SignOutButton from "./SignOutButton"
import TodoList from "./TodoList";
import LoginForm from "./LoginForm";
import Footer from "./Footer";

import { User } from "@supabase/supabase-js";

interface HomeClientProps {
  user: User | null;
}


const HomeClient: React.FC<HomeClientProps> = ({user}) => {
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

 return (
    <div className="min-h-screen w-full bg-white dark:bg-black flex">
      {user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      
      <div className={`h-screen w-full overflow-y-auto`}>
        <header className="bg-white dark:bg-black shadow-lg border-b border-gray-200 dark:border-gray-800 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3">                
                <div className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center">
                  {user && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="rounded-lg text-gray-600 dark:text-gray-400 focus-none transition-all duration-200"
                  >
                    <img className="w-full"  
                    src="/favicon.ico" 
                    />
                  </button>
                )}
                </div>
                <h1 className="text-2xl font-bold text-black dark:text-white">TodoFlow</h1>
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                {user && <SignOutButton user={user} />}
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {user ? (
            <div className="animate-fade-in">
              <TodoList loading={loading} setLoading={setLoading} />
            </div>
          ) : (
            <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
              <div className="w-full max-w-md animate-slide-in-up">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-black dark:bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                    <img className="w-20 h-20"  
                    src="/favicon.ico" 
                    />
                  </div>
                  <h2 className="text-3xl font-bold text-black dark:text-white mb-3">Welcome to TodoFlow</h2>
                  <p className="text-gray-600 dark:text-gray-400">Organize your tasks with style and efficiency</p>
                </div>
                <LoginForm />
              </div>
            </div>
          )}
        </main>
        
        <Footer loading={loading} />
      </div>
    </div>
 )
};

export default HomeClient;