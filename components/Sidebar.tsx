"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

interface Badges {
  todos: number
  finances: number
}

export default function Sidebar({ isOpen, onClose, userId }: SidebarProps) {
  const pathname  = usePathname()
  const [mounted, setMounted] = useState(false)
  const [badges, setBadges]   = useState<Badges>({ todos: 0, finances: 0 })
  const supabase  = createBrowserSupabaseClient()
  const today     = new Date().toISOString().split("T")[0]

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !userId) return
    const load = async () => {
      const { count: todosCount } = await supabase.from("todos").select("*", { count: "exact", head: true })
        .eq("user_id", userId).eq("completed", false)
        .lt("due_date", today).not("due_date", "is", null)

      const [{ data: debtItems }, { data: lendingItems }] = await Promise.all([
        supabase.from("debts").select("amount, amount_paid, deadline")
          .eq("user_id", userId).lt("deadline", today).not("deadline", "is", null),
        supabase.from("lendings").select("amount, amount_paid, deadline")
          .eq("user_id", userId).lt("deadline", today).not("deadline", "is", null),
      ])

      const overdueDebts   = (debtItems ?? []).filter(i => Number(i.amount_paid) < Number(i.amount)).length
      const overdueLending = (lendingItems ?? []).filter(i => Number(i.amount_paid) < Number(i.amount)).length

      setBadges({
        todos:    todosCount ?? 0,
        finances: overdueDebts + overdueLending,
      })
    }
    load()
  }, [mounted, userId, today]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => { document.body.style.overflow = "unset" }
  }, [isOpen])

  if (!mounted) return null

  const navigationItems = [
    {
      name: "Todo",
      href: "/",
      badge: badges.todos,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
        </svg>
      ),
    },
    {
      name: "Expenses",
      href: "/expenses",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "To Buy",
      href: "/to-buy",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      ),
    },
    {
      name: "Finances",
      href: "/debts",
      badge: badges.finances,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      name: "Friends",
      href: "/friends",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    },
    {
      name: "Stats",
      href: "/stats",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: "/settings",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      ),
    },
  ]

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black dark:bg-white rounded-xl flex items-center justify-center">
                <img className="w-full" src="/favicon.ico" alt="" />
              </div>
              <h2 className="text-lg font-bold text-black dark:text-white">TodoFlow</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring rounded-lg p-1 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) || (item.href === "/debts" && pathname.startsWith("/lending"))
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => { if (window.innerWidth < 1024) onClose() }}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 focus-ring
                        ${isActive
                          ? "bg-black dark:bg-white text-white dark:text-black shadow-lg"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900"}
                      `}
                    >
                      {item.icon}
                      <span className="font-medium flex-1">{item.name}</span>
                      {item.badge > 0 && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white dark:bg-black text-black dark:text-white" : "bg-red-500 text-white"}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">Made with ❤️ by SENTACK</div>
          </div>
        </div>
      </div>
    </>
  )
}
