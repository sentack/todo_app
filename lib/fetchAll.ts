import type { PostgrestError } from "@supabase/supabase-js"

type Page<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null; count?: number | null }>

/**
 * Load every row of a query. Supabase caps each response (1,000 rows by
 * default), so a plain select silently drops everything past the cap.
 *
 * `page(from, to)` must build the query with `{ count: "exact" }`, a stable
 * order ending in a unique column (e.g. `.order("date").order("id")`) and
 * `.range(from, to)`. Paging stops once the exact count is reached, so it is
 * also correct when the server's cap is smaller than `pageSize`.
 */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, pageSize = 1000) {
  const rows: T[] = []
  let total: number | null = null
  for (;;) {
    const { data, error, count } = await page(rows.length, rows.length + pageSize - 1)
    if (error) return { data: rows, error }
    total ??= count ?? null
    const got = data ?? []
    rows.push(...got)
    const done = got.length === 0 || (total !== null ? rows.length >= total : got.length < pageSize)
    if (done) return { data: rows, error: null }
  }
}
