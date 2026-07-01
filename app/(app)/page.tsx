"use client"

import { useState } from "react"
import TodoList from "@/components/TodoList"
import Footer from "@/components/Footer"

export default function HomePage() {
  const [loading, setLoading] = useState(true)

  return (
    <>
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          <TodoList setLoading={setLoading} />
        </div>
      </main>
      <Footer loading={loading} />
    </>
  )
}
