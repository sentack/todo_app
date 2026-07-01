"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";
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
      const today = new Date().toISOString().split("T")[0];
      const { data: countData } = await supabase
        .from("todos")
        .select("completed, due_date")
        .eq("user_id", uid);

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
        <div className="skeleton rounded-xl h-11" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-2xl p-1 w-fit min-w-full">
          {(["all", "pending", "completed", "overdue"] as const).map(f => {
            const isActive = filter === f
            const dot = f === "pending" ? "bg-yellow-400" : f === "completed" ? "bg-green-400" : f === "overdue" ? "bg-red-500" : null
            const count = f === "all" ? counts.all : f === "pending" ? counts.pending : f === "completed" ? counts.completed : counts.overdue
            return (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                className={`flex-1 shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold capitalize whitespace-nowrap transition-all duration-150 ${isActive ? "bg-white dark:bg-black text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"}`}
              >
                {dot && <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${f === "overdue" && counts.overdue === 0 ? "opacity-30" : ""}`} />}
                {f}
                <span className={`text-xs font-bold tabular-nums ${
                  f === "overdue" && count > 0 ? "text-red-500 dark:text-red-400" :
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
      <div className={`space-y-4 w-full max-w-full overflow-x-hidden transition-opacity duration-150 ${listLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        {todos.length === 0 ? (
          <div className="text-center py-8 sm:py-16 px-4 animate-fade-in">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm sm:text-lg font-semibold text-black dark:text-white mb-2">
              {filter === "all" ? "No todos yet" : `No ${filter} todos`}
            </h3>
            <p className="text-xs sm:text-base text-gray-600 dark:text-gray-400">
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
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-900 text-black dark:text-white disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default TodoList;
