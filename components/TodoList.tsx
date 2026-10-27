"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";
import { fetchAll } from "@/lib/fetchAll";
import { todayStr } from "@/lib/dates";
import TodoItem from "./TodoItem";

const PAGE_SIZE = 10;

interface Subtask { id: string; title: string; completed: boolean; weight: number; created_at: string }
interface Todo { id: string; title: string; description: string | null; notes: string | null; completed: boolean; created_at: string; status_id: number; due_date?: string | null; subtasks?: Subtask[] }
interface TodoListProps { setLoading: React.Dispatch<React.SetStateAction<boolean>> }

const TodoList: React.FC<TodoListProps> = ({ setLoading }) => {
  const [todos, setTodos]         = useState<Todo[]>([]);
  const [filter, setFilter]       = useState<"all" | "pending" | "completed" | "overdue">("all");
  const [page, setPage]           = useState(1);
  const [counts, setCounts]       = useState({ all: 0, pending: 0, completed: 0, overdue: 0 });
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [refreshKey, setRefreshKey]       = useState(0);
  // initialLoading: full skeleton shown only on the very first fetch
  // listLoading:    dims the list area on filter / page changes
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading]       = useState(false);

  const supabase    = useMemo(() => createBrowserSupabaseClient(), []);
  const userIdRef   = useRef<string | null>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Only the very first fetch shows the full-page skeleton.
      // All subsequent fetches (filter / search / page) dim just the list.
      if (!isFirstLoad.current) setListLoading(true);

      if (!userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInitialLoading(false); setLoading(false); return; }
        userIdRef.current = user.id;
      }
      if (cancelled) return;
      const uid = userIdRef.current!;

      // Lightweight count query — unaffected by search, always shows true totals in tabs
      const today = todayStr();
      const { data: countData } = await fetchAll<{ completed: boolean; due_date: string | null }>((from, to) => supabase
        .from("todos")
        .select("completed, due_date", { count: "exact" })
        .eq("user_id", uid)
        .order("id")
        .range(from, to));

      if (!cancelled && countData) {
        setCounts({
          all:       countData.length,
          pending:   countData.filter(t => !t.completed).length,
          completed: countData.filter(t =>  t.completed).length,
          overdue:   countData.filter(t => !t.completed && t.due_date && t.due_date < today).length,
        });
      }

      // Paginated display query — filtered by search, returns exact count for pagination
      const from = (page - 1) * PAGE_SIZE;
      let q = supabase
        .from("todos")
        .select("*, subtasks(id, title, completed, weight, created_at)", { count: "exact" })
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (filter === "pending")   q = q.eq("completed", false);
      if (filter === "completed") q = q.eq("completed", true);
      if (filter === "overdue")   q = q.eq("completed", false).lt("due_date", today).not("due_date", "is", null);

      const { data, count } = await q;
      if (!cancelled) {
        setTodos((data ?? []) as Todo[]);
        setTotalFiltered(count ?? 0);
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          setInitialLoading(false);
          setLoading(false); // tell parent to reveal the Footer
        } else {
          setListLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filter, page, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeFilter = (f: "all" | "pending" | "completed" | "overdue") => {
    setFilter(f);
    setPage(1);
  };

  const refresh = () => setRefreshKey(k => k + 1);

  // Listen for FAB-triggered adds from other pages
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent
      if (ce.detail?.type === "todo") { setPage(1); refresh() }
    }
    window.addEventListener("refresh-data", handler)
    return () => window.removeEventListener("refresh-data", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);

  // ── render ────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton rounded-3xl h-40" />
        <div className="skeleton rounded-full h-12" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero — progress overview */}
      <div className="hero-card rounded-3xl p-6 sm:p-7 shadow-xl animate-slide-in-down">
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/60 dark:text-black/60 mb-3">Your tasks</p>
            <p className="font-display text-5xl sm:text-6xl font-extrabold leading-none tracking-tight text-white dark:text-black">
              {counts.pending}
              <span className="ml-2 text-base sm:text-lg font-bold tracking-normal text-white/60 dark:text-black/60">open</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 dark:bg-black/10 text-white dark:text-black">
                <span className="w-1.5 h-1.5 rounded-full bg-volt dark:bg-black" />{counts.completed} done
              </span>
              {counts.overdue > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500 text-white">
                  {counts.overdue} overdue
                </span>
              )}
            </div>
          </div>
          {(() => {
            const pct = counts.all ? Math.round((counts.completed / counts.all) * 100) : 0
            const C = 2 * Math.PI * 34
            return (
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" strokeWidth="8" className="stroke-white/10 dark:stroke-black/10" />
                  <circle cx="40" cy="40" r="34" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-volt dark:stroke-black transition-[stroke-dashoffset] duration-700 ease-out" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-display text-xl sm:text-2xl font-extrabold text-white dark:text-black">{pct}%</span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-full p-1 w-fit min-w-full">
          {(["all", "pending", "completed", "overdue"] as const).map(f => {
            const isActive = filter === f
            const dot = f === "pending" ? "bg-amber-400" : f === "completed" ? "bg-volt-500" : f === "overdue" ? "bg-rose-500" : null
            const count = f === "all" ? counts.all : f === "pending" ? counts.pending : f === "completed" ? counts.completed : counts.overdue
            return (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                className={`flex-1 shrink-0 flex items-center justify-center gap-1.5 px-4 h-10 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all duration-200 ${isActive ? "bg-white dark:bg-gray-800 text-black dark:text-white shadow-md shadow-black/5" : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}
              >
                {dot && <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${f === "overdue" && counts.overdue === 0 ? "opacity-30" : ""}`} />}
                {f}
                <span className={`text-xs font-bold tabular-nums ${
                  f === "overdue" && count > 0 ? "text-rose-500 dark:text-rose-400" :
                  isActive ? "text-black dark:text-white opacity-60" :
                  "text-gray-400 dark:text-gray-600"
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* List — dims while fetching, no full-page flash */}
      <div className={`space-y-3 w-full max-w-full overflow-x-hidden transition-opacity duration-150 ${listLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        {todos.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 animate-fade-in">
            <div className="w-16 h-16 bg-volt rounded-3xl flex items-center justify-center mx-auto mb-5 rotate-3 shadow-lg shadow-volt/30">
              <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-black dark:text-white mb-2">
              {filter === "all" ? "No todos yet" : `No ${filter} todos`}
            </h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              {filter === "all" ? "Use the + button to create your first todo!" : `You don't have any ${filter} todos right now.`}
            </p>
          </div>
        ) : (
          todos.map((todo, index) => (
            <div key={todo.id} className="animate-slide-in-up w-full max-w-full" style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}>
              <TodoItem todo={todo} onTodoUpdated={refresh} />
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-10 px-4 rounded-full text-sm font-semibold bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-black dark:text-white disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-10 px-4 rounded-full text-sm font-semibold bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-black dark:text-white disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default TodoList;
