"use client"

import { useState } from "react"
import TodoList from "@/components/TodoList"
import Footer from "@/components/Footer"

export default function HomePage() {
  const [loading, setLoading] = useState(true)

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10">
        <div className="animate-fade-in">
          <TodoList setLoading={setLoading} />
        </div>
      </main>
      <Footer loading={loading} />
    </>
  )
}
