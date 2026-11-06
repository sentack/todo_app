// Subtask weights. While editing, the field accepts any whole number from 0
// up (so typing never fights you); on submit it must be 1–5, which is all the
// database accepts.

export const WEIGHT_MIN = 1
export const WEIGHT_MAX = 5

/** Keep digits only and drop leading zeros ("007" → "7", "0" stays) */
export const cleanWeightInput = (raw: string) => raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "")

/** − / + buttons: one step at a time, never below 0 */
export const stepWeight = (raw: string, delta: number) => String(Math.max(0, (Number(raw) || 0) + delta))

/** The weight to save, or null if it isn't a whole number from 1 to 5 */
export function parseWeight(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= WEIGHT_MIN && n <= WEIGHT_MAX ? n : null
}

/** Indexes of subtasks that will be saved (have a title) but whose weight isn't 1–5 */
export const invalidWeightIndexes = (subtasks: { title: string; weight: string }[]) =>
  subtasks.flatMap((s, i) => s.title.trim() && parseWeight(s.weight) === null ? [i] : [])
