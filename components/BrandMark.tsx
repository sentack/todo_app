interface BrandMarkProps {
  className?: string
}

// TodoFlow logo mark — ink squircle with a volt check (inverts in dark mode)
export function BrandMark({ className = "w-10 h-10" }: BrandMarkProps) {
  return (
    <span
      className={`${className} inline-grid place-items-center shrink-0 rounded-[32%] bg-black text-volt dark:bg-volt dark:text-black shadow-lg shadow-black/15 dark:shadow-volt/20 ring-1 ring-inset ring-white/10 dark:ring-black/10`}
    >
      <svg viewBox="0 0 24 24" className="w-[56%] h-[56%]" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4.5 12.75l4.75 4.75L19.5 6.75" />
      </svg>
    </span>
  )
}

// TodoFlow wordmark
export function Wordmark({ className = "text-xl" }: BrandMarkProps) {
  return (
    <span className={`${className} font-display font-extrabold tracking-tight text-black dark:text-white`}>
      Todo<span className="text-volt-700 dark:text-volt">Flow</span>
    </span>
  )
}
