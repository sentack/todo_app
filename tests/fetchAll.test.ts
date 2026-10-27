import { describe, it, expect } from "vitest"
import { fetchAll } from "@/lib/fetchAll"
import { fakeSupabase } from "./fixtures"

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, user_id: "u1" }))

const pager = (client: ReturnType<typeof fakeSupabase>) => (from: number, to: number) =>
  client.from("t").select("*", { count: "exact" }).eq("user_id", "u1").order().range(from, to) as never

describe("fetchAll", () => {
  it("a single request stops at the 1,000-row cap (the original bug)", async () => {
    const client = fakeSupabase({ t: rows(1137) })
    const { data } = await (client.from("t").select("*").eq("user_id", "u1") as unknown as Promise<{ data: unknown[] }>)
    expect(data).toHaveLength(1000)
  })

  it.each([0, 1, 999, 1000, 1001, 1137, 2537, 5000])("returns all %i rows", async n => {
    const client = fakeSupabase({ t: rows(n) })
    const { data, error } = await fetchAll<{ id: number }>(pager(client))
    expect(error).toBeNull()
    expect(data).toHaveLength(n)
    expect(new Set(data.map(r => r.id)).size).toBe(n)   // no duplicates
  })

  it("is still complete when the server cap is smaller than the page size", async () => {
    const client = fakeSupabase({ t: rows(1234) }, 300)
    const { data } = await fetchAll(pager(client))
    expect(data).toHaveLength(1234)
  })

  it("stops after one request when everything fits", async () => {
    const client = fakeSupabase({ t: rows(1000) })
    await fetchAll(pager(client))
    expect(client.requests).toHaveLength(1)
  })

  it("returns the error and the rows fetched so far", async () => {
    let call = 0
    const { data, error } = await fetchAll<number>(() => Promise.resolve(
      ++call === 1
        ? { data: Array(1000).fill(1), error: null, count: 2000 }
        : { data: null, error: { message: "boom" } as never, count: null },
    ))
    expect(error).toEqual({ message: "boom" })
    expect(data).toHaveLength(1000)
  })
})
