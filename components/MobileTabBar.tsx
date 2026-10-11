"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface MobileTabBarProps {
  onMenu: () => void
}

const TABS = [
  {
    name: "Todo",
    href: "/",
    icon: <path d="M9 6.75h10.5M9 12h10.5M9 17.25h10.5M4.5 6.75h.01M4.5 12h.01M4.5 17.25h.01" />,
  },
  {
    name: "Expenses",
    href: "/expenses",
    icon: <path d="M3 8.25h18M6 15.75h3M4.5 4.5h15A1.5 1.5 0 0121 6v12a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V6a1.5 1.5 0 011.5-1.5z" />,
  },
  {
    name: "Finances",
    href: "/debts",
    icon: <path d="M7.5 7.5h11.25m0 0L15 3.75m3.75 3.75L15 11.25M16.5 16.5H5.25m0 0L9 12.75M5.25 16.5L9 20.25" />,
  },
]

// Floating bottom navigation for phones; the Quick Add FAB docks in its centre slot
export default function MobileTabBar({ onMenu }: MobileTabBarProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href)) || (href === "/debts" && pathname.startsWith("/lending"))

  const item = (label: string, active: boolean, icon: React.ReactNode) => (
    <span className="flex flex-col items-center justify-center gap-1 h-full">
      <span
        className={`flex items-center justify-center h-8 w-14 rounded-full transition-all duration-300 ${
          active ? "bg-volt text-black shadow-md shadow-volt/30" : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
          {icon}
        </svg>
      </span>
      <span className={`text-[10.5px] font-semibold leading-none ${active ? "text-black dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
        {label}
      </span>
    </span>
  )

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-[80] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none"
    >
      <div className="relative mx-auto max-w-md pointer-events-auto rounded-[1.75rem] border border-black/[0.06] dark:border-white/[0.08] shadow-xl shadow-black/10">
        <div aria-hidden className="absolute inset-0 rounded-[inherit] bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl backdrop-saturate-150" />
        <ul className="relative grid grid-cols-5 h-[4.25rem]">
          {TABS.slice(0, 2).map(t => (
            <li key={t.href}>
              <Link href={t.href} className="block h-full" aria-current={isActive(t.href) ? "page" : undefined}>
                {item(t.name, isActive(t.href), t.icon)}
              </Link>
            </li>
          ))}
          {/* Centre slot — Quick Add FAB floats here */}
          <li aria-hidden />
          <li>
            <Link href={TABS[2].href} className="block h-full" aria-current={isActive(TABS[2].href) ? "page" : undefined}>
              {item(TABS[2].name, isActive(TABS[2].href), TABS[2].icon)}
            </Link>
          </li>
          <li>
            <button onClick={onMenu} className="block w-full h-full" aria-label="Open menu">
              {item("More", false, <path d="M4.5 6.75h15M4.5 12h15M4.5 17.25h9" />)}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}
