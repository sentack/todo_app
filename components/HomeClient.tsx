"use client"

import React, { useState } from "react";
import TodoList from "./TodoList";
import LoginForm from "./LoginForm";
import Footer from "./Footer";

import { User } from "@supabase/supabase-js";

interface HomeClientProps {
  user: User | null;
}


const HomeClient: React.FC<HomeClientProps> = ({user}) => {
  const [loading, setLoading] = useState(true)

 return (
    <>
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <div className="animate-fade-in">
            <TodoList loading={loading} setLoading={setLoading} />
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
      <Footer loading={loading} />
      </>
 )
};

export default HomeClient;