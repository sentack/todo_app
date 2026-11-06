"use client"

import { cleanWeightInput, stepWeight, WEIGHT_MIN, WEIGHT_MAX } from "@/lib/subtasks"

/** Subtask weight: − / + buttons around a field that takes any whole number from 0 up */
export default function WeightStepper({ value, onChange, invalid = false }: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const n = Number(value) || 0
  const btn = "w-8 h-full grid place-items-center text-lg font-bold leading-none text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors"
  return (
    <div
      title={`Weight (${WEIGHT_MIN}–${WEIGHT_MAX})`}
      className={`shrink-0 flex items-center h-12 rounded-2xl border overflow-hidden bg-gray-50 dark:bg-white/[0.04] focus-within:ring-4 transition-all ${invalid
        ? "border-rose-400 dark:border-rose-500 focus-within:ring-rose-500/15"
        : "border-gray-200 dark:border-white/[0.08] focus-within:border-black dark:focus-within:border-volt focus-within:ring-black/5 dark:focus-within:ring-volt/15"}`}
    >
      <button type="button" aria-label="Decrease weight" disabled={n <= 0} onClick={() => onChange(stepWeight(value, -1))} className={btn}>−</button>
      <input
        type="text" inputMode="numeric" aria-label="Weight" aria-invalid={invalid}
        value={value} onChange={e => onChange(cleanWeightInput(e.target.value))}
        className={`w-8 h-full bg-transparent text-center font-semibold text-[0.9375rem] focus:outline-none ${invalid ? "text-rose-600 dark:text-rose-400" : "text-black dark:text-white"}`}
      />
      <button type="button" aria-label="Increase weight" disabled={n >= WEIGHT_MAX} onClick={() => onChange(stepWeight(value, 1))} className={btn}>+</button>
    </div>
  )
}
