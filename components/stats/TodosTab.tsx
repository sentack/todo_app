"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser"
import { type Period, type TodoRow, type Delta, todoAnalytics, todoInsights, deltaOf } from "@/lib/analytics"
import { CARD, IN_BAR, DIM_BAR, SectionTitle, Hero, HeroStat, StatTile, InsightList, ColumnChart, EmptyState, QuickAddButton } from "./ui"

const fmtDuration = (h: number) =>
  h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 24 ? `${h.toFixed(h < 10 ? 1 : 0)}h` : `${(h / 24).toFixed(h < 240 ? 1 : 0)}d`

export default function TodosTab({ userId, period }: { userId: string; period: Period }) {
  const [todos, setTodos]     = useState<TodoRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const cols = "id, title, created_at, updated_at, completed, due_date"
      const full = await supabase.from("todos").select(`${cols}, completed_at`).eq("user_id", userId)
      // completed_at not migrated yet — analytics fall back to updated_at
      const rows = full.error
        ? (await supabase.from("todos").select(cols).eq("user_id", userId)).data
        : full.data
      if (cancelled) return
      setTodos((rows ?? []) as TodoRow[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: Event) => { if ((e as CustomEvent).detail?.type === "todo") setRefreshKey(k => k + 1) }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, [])

  const a = useMemo(() => todos ? todoAnalytics(period, todos) : null, [todos, period])
  const insights = useMemo(() => a ? todoInsights(a) : [], [a])

  if (!a) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton rounded-3xl h-32" />)}</div>

  if (todos!.length === 0) {
    return <EmptyState action={<QuickAddButton type="todo">Add a todo</QuickAddButton>}>No todos yet. Add one to start tracking your progress.</EmptyState>
  }

  const backlog: Delta = a.backlogChange === 0
    ? { text: "Added as many as you finished", tone: "neutral" }
    : { text: a.backlogChange > 0 ? `Grew by ${a.backlogChange}` : `Shrank by ${-a.backlogChange}`, tone: a.backlogChange > 0 ? "bad" : "good" }

  return (
    <div className={`space-y-8 transition-opacity ${loading ? "opacity-60" : ""}`}>

      <Hero label="Completed" value={String(a.completed)} delta={deltaOf(a.completed, a.completedPrev, true, period.compareLabel)}>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <HeroStat label="Added" value={String(a.created)} />
          <HeroStat label="Open now" value={String(a.openCount)} />
          <HeroStat label="Overdue" value={String(a.overdue.length)} />
        </div>
      </Hero>

      <InsightList insights={insights} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile label="Backlog" value={`${a.backlogChange > 0 ? "+" : ""}${a.backlogChange}`} delta={backlog} sub="added − finished" />
        <StatTile label="On time" value={a.onTimeRate !== null ? `${Math.round(a.onTimeRate)}%` : "—"}
          sub={a.onTimeBase > 0 ? `of ${a.onTimeBase} with a due date` : "no due dates in this period"} />
        <StatTile label="Typical time to finish" value={a.medianHours !== null ? fmtDuration(a.medianHours) : "—"} sub="median, created → done" />
        <StatTile label="Completion streak" value={`${a.streak.current}d`} sub={`best ${a.streak.longest}d`} />
      </div>

      <div>
        <SectionTitle>Added vs completed</SectionTitle>
        <ColumnChart
          title={period.months.length > 3 ? "Month" : "Week of"}
          series={[{ name: "Added", bar: DIM_BAR }, { name: "Completed", bar: IN_BAR }]}
          data={a.chart.map(b => ({ label: b.label, values: [b.created, b.completed] }))}
          format={v => String(v)}
        />
      </div>

      {(a.overdue.length > 0 || a.oldestOpen.length > 0) && (
        <div>
          <SectionTitle action={<Link href="/" className="text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white">Todos →</Link>}>Needs attention</SectionTitle>
          <div className={`${CARD} divide-y divide-black/[0.05] dark:divide-white/[0.05] overflow-hidden`}>
            {a.overdue.slice(0, 5).map(t => (
              <AttentionRow key={`o-${t.id}`} title={t.title} value={`${t.days}d`} label="overdue" bad />
            ))}
            {a.oldestOpen.filter(t => !a.overdue.some(o => o.id === t.id)).map(t => (
              <AttentionRow key={`a-${t.id}`} title={t.title} value={`${t.days}d`} label="open" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AttentionRow({ title, value, label, bad }: { title: string; value: string; label: string; bad?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-5 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
      <span className="flex-1 min-w-0 text-sm font-semibold text-black dark:text-white truncate">{title}</span>
      <span className="text-right shrink-0">
        <span className="block text-sm font-bold text-black dark:text-white">{value}</span>
        <span className={`block text-[0.6875rem] font-semibold ${bad ? "text-rose-600 dark:text-rose-400" : "text-gray-500 dark:text-gray-400"}`}>{label}</span>
      </span>
    </Link>
  )
}
