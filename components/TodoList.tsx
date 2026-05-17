"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";
import TodoItem from "./TodoItem";
import TodoForm from "./TodoForm";

const PAGE_SIZE = 10;

interface Subtask { id: string; title: string; completed: boolean; weight: number; created_at: string }
interface Todo { id: string; title: string; description: string | null; notes: string | null; completed: boolean; created_at: string; status_id: number; subtasks?: Subtask[] }
interface TodoListProps { loading: boolean; setLoading: React.Dispatch<React.SetStateAction<boolean>> }

const TodoList: React.FC<TodoListProps> = ({ loading, setLoading }) => {
  const [todos, setTodos]         = useState<Todo[]>([]);
  const [filter, setFilter]       = useState<"all" | "pending" | "completed">("all");
  const [page, setPage]           = useState(1);
  const [counts, setCounts]       = useState({ all: 0, pending: 0, completed: 0 });
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const supabase   = useMemo(() => createBrowserSupabaseClient(), []);
  const userIdRef  = useRef<string | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      if (!userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        userIdRef.current = user.id;
      }
      if (cancelled) return;
      const uid = userIdRef.current!;

      // Lightweight count query for accurate tab totals (unaffected by search)
      const { data: countData } = await supabase
        .from("todos")
        .select("completed")
        .eq("user_id", uid);

      if (!cancelled && countData) {
        setCounts({
          all:       countData.length,
          pending:   countData.filter(t => !t.completed).length,
          completed: countData.filter(t =>  t.completed).length,
        });
      }

      // Paginated display query with search + exact count for pagination
      const from = (page - 1) * PAGE_SIZE;
      let q = supabase
        .from("todos")
        .select("*, subtasks(id, title, completed, weight, created_at)", { count: "exact" })
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (filter === "pending")   q = q.eq("completed", false);
      if (filter === "completed") q = q.eq("completed", true);

      if (debouncedSearch.trim()) {
        q = q.or(`title.ilike.%${debouncedSearch.trim()}%,description.ilike.%${debouncedSearch.trim()}%`);
      }

      const { data, count } = await q;
      if (!cancelled) {
        setTodos((data ?? []) as Todo[]);
        setTotalFiltered(count ?? 0);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [filter, page, refreshKey, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeFilter = (f: "all" | "pending" | "completed") => {
    setFilter(f);
    setPage(1);
  };

  const refresh = () => setRefreshKey(k => k + 1);

  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton rounded-2xl h-16" />
        <div className="flex justify-center gap-2">
          {[16, 20, 24].map(w => <div key={w} className="skeleton rounded-lg h-8 w-20" />)}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-slide-in-down">
        <TodoForm
          onTodoAdded={() => { setPage(1); refresh(); }}
          editingTodo={editingTodo}
          onEditComplete={() => { setEditingTodo(null); setPage(1); refresh(); }}
        />
      </div>

      {/* Search */}
      <div className="relative animate-fade-in">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search todos..."
          className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-center animate-fade-in w-full min-w-0 gap-2">
        {(["all", "pending", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl capitalize focus-ring transition-all duration-200 ${filter === f ? "bg-black dark:bg-white text-white dark:text-black shadow-lg" : "bg-gray-100 dark:bg-gray-900 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-800"}`}
          >
            <div className={`w-3 h-3 rounded-full ${f === "pending" ? "bg-yellow-400" : f === "completed" ? "bg-green-400" : "hidden"}`} />
            {f}
            {f === "pending"   && <span className="font-bold text-green-600 dark:text-green-400">{counts.pending}</span>}
            {f === "completed" && <span className="font-bold text-green-600 dark:text-green-400">{counts.completed}</span>}
            {f === "all"       && `(${counts.all})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4 w-full max-w-full overflow-x-hidden">
        {todos.length === 0 ? (
          <div className="text-center py-8 sm:py-16 px-4 animate-fade-in">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm sm:text-lg font-semibold text-black dark:text-white mb-2">
              {debouncedSearch ? "No results found" : filter === "all" ? "No todos yet" : `No ${filter} todos`}
            </h3>
            <p className="text-xs sm:text-base text-gray-600 dark:text-gray-400">
              {debouncedSearch ? `No todos match "${debouncedSearch}".` : filter === "all" ? "Create your first todo to get started!" : `You don't have any ${filter} todos right now.`}
            </p>
            {debouncedSearch && (
              <button onClick={() => setSearch("")} className="mt-3 text-sm font-semibold text-black dark:text-white underline underline-offset-2">Clear search</button>
            )}
          </div>
        ) : (
          todos.map((todo, index) => (
            <div key={todo.id} className="animate-slide-in-up w-full max-w-full" style={{ animationDelay: `${Math.min(index, 6) * 0.05}s` }}>
              <TodoItem todo={todo} onTodoUpdated={refresh} onEditTodo={setEditingTodo} />
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
