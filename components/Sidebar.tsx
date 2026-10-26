"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { todayStr } from "@/lib/dates"
import { BrandMark, Wordmark } from "./BrandMark"

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
  const today     = todayStr()

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
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M9 6.75h10.5M9 12h10.5M9 17.25h10.5M4.5 6.75h.01M4.5 12h.01M4.5 17.25h.01" />
        </svg>
      ),
    },
    {
      name: "Expenses",
      href: "/expenses",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 8.25h18M6 15.75h3M4.5 4.5h15A1.5 1.5 0 0121 6v12a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V6a1.5 1.5 0 011.5-1.5z" />
        </svg>
      ),
    },
    {
      name: "To Buy",
      href: "/to-buy",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M2.25 3h1.39c.51 0 .95.34 1.09.83l.38 1.42m0 0L6.75 12h10.5l2.25-6.75H5.11zM6.75 12l-1.5 3.75h13.5M8.25 20.25a.75.75 0 100-1.5.75.75 0 000 1.5zm9 0a.75.75 0 100-1.5.75.75 0 000 1.5z" />
        </svg>
      ),
    },
    {
      name: "Finances",
      href: "/debts",
      badge: badges.finances,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M7.5 7.5h11.25m0 0L15 3.75m3.75 3.75L15 11.25M16.5 16.5H5.25m0 0L9 12.75M5.25 16.5L9 20.25" />
        </svg>
      ),
    },
    {
      name: "Friends",
      href: "/friends",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M15 19.13a9.38 9.38 0 002.63.37 9.34 9.34 0 004.12-.95 4.13 4.13 0 00-7.53-2.49M15 19.13v-.01c0-1.12-.29-2.17-.78-3.08M15 19.13A12.32 12.32 0 018.62 21c-2.33 0-4.51-.65-6.37-1.77v-.11a6.37 6.37 0 0111.96-3.07M12 6.38a3.38 3.38 0 11-6.75 0 3.38 3.38 0 016.75 0zm8.25 2.25a2.63 2.63 0 11-5.25 0 2.63 2.63 0 015.25 0z" />
        </svg>
      ),
    },
    {
      name: "Stats",
      href: "/stats",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 20.25h18M6.75 16.5v-4.5M12 16.5V7.5M17.25 16.5v-7.5" />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: "/settings",
      badge: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M9.59 3.94c.09-.54.56-.94 1.11-.94h2.59c.55 0 1.02.4 1.11.94l.21 1.28c.06.37.31.68.64.87.07.04.15.09.22.13.32.2.72.26 1.07.13l1.22-.46a1.13 1.13 0 011.37.49l1.3 2.25c.27.47.16 1.07-.26 1.42l-1 .83c-.29.24-.43.6-.42.97v.26c-.01.37.13.73.42.97l1 .83c.42.35.53.95.26 1.42l-1.3 2.25a1.13 1.13 0 01-1.37.49l-1.22-.46c-.35-.13-.75-.07-1.07.13l-.22.13c-.33.19-.58.5-.64.87l-.21 1.28c-.09.54-.56.94-1.11.94h-2.59c-.55 0-1.02-.4-1.11-.94l-.21-1.28a1.24 1.24 0 00-.64-.87l-.22-.13a1.24 1.24 0 00-1.07-.13l-1.22.46a1.13 1.13 0 01-1.37-.49l-1.3-2.25a1.13 1.13 0 01.26-1.42l1-.83c.29-.24.43-.6.42-.97v-.26c.01-.37-.13-.73-.42-.97l-1-.83a1.13 1.13 0 01-.26-1.42l1.3-2.25c.27-.47.85-.68 1.37-.49l1.22.46c.35.13.75.07 1.07-.13l.22-.13c.33-.19.58-.5.64-.87l.21-1.28zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[165] bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 left-0 z-[170] h-[100dvh] w-[18rem] max-w-[85vw] bg-white dark:bg-gray-950 lg:bg-white/60 lg:dark:bg-white/[0.02] border-r border-black/[0.06] dark:border-white/[0.06] rounded-r-[2rem] lg:rounded-none shadow-2xl lg:shadow-none transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          lg:translate-x-0 lg:static lg:z-auto lg:h-screen lg:w-72 shrink-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between px-6 h-16 lg:h-[4.5rem]">
            <div className="flex items-center gap-2.5">
              <BrandMark className="w-9 h-9" />
              <h2><Wordmark className="text-xl" /></h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="lg:hidden w-9 h-9 grid place-items-center rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-500 hover:text-black dark:hover:text-white focus-ring transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 overflow-y-auto">
            <p className="px-3 mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Workspace</p>
            <ul className="space-y-1">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) || (item.href === "/debts" && pathname.startsWith("/lending"))
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => { if (window.innerWidth < 1024) onClose() }}
                      className={`
                        group flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 focus-ring
                        ${isActive
                          ? "bg-black dark:bg-volt text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-volt/15"
                          : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}
                      `}
                    >
                      <span className={`w-9 h-9 grid place-items-center rounded-xl transition-colors ${isActive ? "bg-white/10 dark:bg-black/10 text-volt dark:text-black" : "bg-black/[0.04] dark:bg-white/[0.05] group-hover:bg-black/[0.07] dark:group-hover:bg-white/[0.09]"}`}>
                        {item.icon}
                      </span>
                      <span className="font-semibold text-[0.9375rem] flex-1">{item.name}</span>
                      {item.badge > 0 && (
                        <span className={`min-w-[1.375rem] h-[1.375rem] px-1.5 grid place-items-center text-[0.6875rem] font-bold rounded-full ${isActive ? "bg-volt dark:bg-black text-black dark:text-volt" : "bg-rose-500 text-white shadow-sm shadow-rose-500/40"}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="p-4">
            <div className="rounded-2xl px-4 py-3 bg-black/[0.03] dark:bg-white/[0.04] text-xs text-gray-500 dark:text-gray-400 text-center">Made with ❤️ by <span className="font-bold text-black dark:text-white">SENTACK</span></div>
          </div>
        </div>
      </div>
    </>
  )
}
