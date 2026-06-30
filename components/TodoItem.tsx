"use client";

import { useState, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabaseBrowser";

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  weight: number;
  created_at: string;
}

interface Todo {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status_id: number;
  completed: boolean;
  created_at: string;
  due_date?: string | null;
  subtasks?: Subtask[];
}

interface TodoItemProps {
  todo: Todo;
  onTodoUpdated: () => void;
}

const INPUT = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-black dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm";

export default function TodoItem({ todo, onTodoUpdated }: TodoItemProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  // ── view state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]             = useState(false);
  const [isExpanded, setIsExpanded]       = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  // ── inline edit state ───────────────────────────────────────────────────────
  const [isEditing, setIsEditing]         = useState(false);
  const [editTitle, setEditTitle]         = useState("");
  const [editDesc, setEditDesc]           = useState("");
  const [editNotes, setEditNotes]         = useState("");
  const [editStatusId, setEditStatusId]   = useState(1);
  const [editDueDate, setEditDueDate]     = useState("");
  const [editSubtasks, setEditSubtasks]   = useState<{ id?: string; title: string; weight: number; completed?: boolean }[]>([]);
  const [saving, setSaving]               = useState(false);

  const startEdit = () => {
    setEditTitle(todo.title);
    setEditDesc(todo.description ?? "");
    setEditNotes(todo.notes ?? "");
    setEditStatusId(todo.status_id);
    setEditDueDate(todo.due_date ?? "");
    setEditSubtasks(todo.subtasks?.map(s => ({ id: s.id, title: s.title, weight: s.weight, completed: s.completed })) ?? []);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("todos").update({
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      notes: editNotes.trim() || null,
      status_id: editStatusId,
      completed: editStatusId === 3,
      due_date: editDueDate || null,
      updated_at: new Date().toISOString(),
    }).eq("id", todo.id);

    if (!error) {
      // Delete all existing subtasks and re-insert
      await supabase.from("subtasks").delete().eq("todo_id", todo.id);
      const valid = editSubtasks.filter(s => s.title.trim());
      if (valid.length > 0) {
        await supabase.from("subtasks").insert(
          valid.map(s => ({ todo_id: todo.id, title: s.title.trim(), weight: s.weight, completed: s.completed ?? false }))
        );
      }
      setIsEditing(false);
      onTodoUpdated();
    }
    setSaving(false);
  };

  // ── view-mode mutations ─────────────────────────────────────────────────────

  const calculateProgress = () => {
    if (!todo.subtasks || todo.subtasks.length === 0) return todo.completed ? 100 : 0;
    const total    = todo.subtasks.reduce((sum, s) => sum + s.weight, 0);
    const done     = todo.subtasks.filter(s => s.completed).reduce((sum, s) => sum + s.weight, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const updateTodoStatusBasedOnSubtasks = async () => {
    const { data: subtasks } = await supabase.from("subtasks").select("*").eq("todo_id", todo.id);
    if (!subtasks) return;
    const allDone  = subtasks.every(s => s.completed);
    const someDone = subtasks.some(s => s.completed);
    const newStatusId  = allDone ? 3 : someDone ? 2 : 1;
    const newCompleted = allDone;
    if (newStatusId !== todo.status_id || newCompleted !== todo.completed) {
      await supabase.from("todos").update({ status_id: newStatusId, completed: newCompleted, updated_at: new Date().toISOString() }).eq("id", todo.id);
    }
  };

  const toggleCompleted = async () => {
    setLoading(true);
    try {
      const newCompleted = !todo.completed;
      const newStatusId  = newCompleted ? 3 : 1;
      await supabase.from("todos").update({ completed: newCompleted, status_id: newStatusId, updated_at: new Date().toISOString() }).eq("id", todo.id);
      if (newCompleted && todo.subtasks?.length) {
        await supabase.from("subtasks").update({ completed: true, updated_at: new Date().toISOString() }).eq("todo_id", todo.id);
      }
      onTodoUpdated();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleSubtask = async (subtaskId: string, current: boolean) => {
    setLoading(true);
    try {
      await supabase.from("subtasks").update({ completed: !current, updated_at: new Date().toISOString() }).eq("id", subtaskId);
      await updateTodoStatusBasedOnSubtasks();
      onTodoUpdated();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStatus = async (newStatusId: number) => {
    setLoading(true);
    try {
      await supabase.from("todos").update({ status_id: newStatusId, completed: newStatusId === 3, updated_at: new Date().toISOString() }).eq("id", todo.id);
      onTodoUpdated();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const deleteTodo = async () => {
    setLoading(true);
    try {
      await supabase.from("todos").delete().eq("id", todo.id);
      onTodoUpdated();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getStatusInfo = (id: number) => {
    if (id === 3) return { name: "Completed", color: "status-completed", icon: "✅" };
    if (id === 2) return { name: "In Progress", color: "status-progress", icon: "⚡" };
    return { name: "Pending", color: "status-pending", icon: "📋" };
  };

  const today     = new Date().toISOString().split("T")[0];
  const isOverdue = !todo.completed && todo.due_date && todo.due_date < today;
  const isDueToday = !todo.completed && todo.due_date === today;
  const overdueDays = isOverdue
    ? Math.ceil((new Date(today).getTime() - new Date(todo.due_date!).getTime()) / 86400000)
    : 0;

  const statusInfo = getStatusInfo(todo.status_id);
  const progress   = calculateProgress();

  // ── inline edit mode ────────────────────────────────────────────────────────

  if (isEditing) {
    return (
      <div className="w-full max-w-full overflow-hidden p-4 sm:p-6 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-black shadow-lg animate-slide-in-up">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-black dark:text-white">Editing Todo</p>
            <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Title *</label>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required autoFocus className={INPUT} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Description</label>
            <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Brief description" className={INPUT} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Subtasks ({editSubtasks.length})</label>
            <div className="space-y-2 mb-2">
              {editSubtasks.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={s.title} onChange={e => {
                    const next = [...editSubtasks];
                    if (!e.target.value) next.splice(i, 1);
                    else next[i] = { ...next[i], title: e.target.value };
                    setEditSubtasks(next);
                  }} placeholder="Subtask" className={`${INPUT} flex-1`} />
                  <input type="number" min="1" max="5" value={s.weight} onChange={e => {
                    const next = [...editSubtasks]; next[i] = { ...next[i], weight: parseInt(e.target.value) || 1 }; setEditSubtasks(next);
                  }} className={`${INPUT} w-14 text-center`} />
                  <button type="button" onClick={() => setEditSubtasks(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setEditSubtasks(prev => [...prev, { title: "", weight: 1 }])} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              + Add subtask
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Notes</label>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} placeholder="Additional notes" className={`${INPUT} resize-none`} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Due date</label>
              <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className={INPUT} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
              <select value={editStatusId} onChange={e => setEditStatusId(Number(e.target.value))} className={INPUT}>
                <option value={1}>📋 Pending</option>
                <option value={2}>⚡ In Progress</option>
                <option value={3}>✅ Completed</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !editTitle.trim()} className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-900 text-black dark:text-white text-sm font-semibold rounded-xl hover:opacity-80 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── view mode ───────────────────────────────────────────────────────────────

  return (
    <div className={`w-full max-w-full overflow-hidden p-4 sm:p-6 border rounded-2xl transition-all duration-300 hover:shadow-lg ${
      isOverdue
        ? "bg-white dark:bg-black border-l-4 border-l-red-500 border-t border-r border-b border-gray-200 dark:border-gray-800"
        : todo.completed
          ? "bg-gray-50 dark:bg-gray-950 opacity-75 border-gray-200 dark:border-gray-800"
          : "bg-white dark:bg-black border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
    }`}>
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Checkbox */}
        <button
          onClick={toggleCompleted}
          disabled={loading}
          className={`mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 focus-ring transition-all duration-200 ${todo.completed ? "bg-green-500 border-green-500 text-white shadow-lg" : "border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950"}`}
        >
          {todo.completed && (
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 mb-2">
            <h3 className={`font-semibold text-base sm:text-lg break-words ${todo.completed ? "line-through text-gray-500 dark:text-gray-400" : "text-black dark:text-white"}`}>
              {todo.title}
            </h3>
            <div className="flex items-center justify-start sm:justify-end gap-2 flex-wrap">
              <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${statusInfo.color}`}>
                <span>{statusInfo.icon}</span>
                <span>{statusInfo.name}</span>
              </span>
              <button
                onClick={startEdit}
                disabled={loading}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus-ring p-1.5 sm:p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200"
                aria-label="Edit todo"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                onClick={deleteTodo}
                disabled={loading}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 focus-ring p-1.5 sm:p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-all duration-200"
                aria-label="Delete todo"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 8a1 1 0 011-1h6a1 1 0 011 1v7a2 2 0 01-2 2H8a2 2 0 01-2-2V8zM9 4a1 1 0 011-1h0a1 1 0 011 1h5a1 1 0 110 2H4a1 1 0 110-2h5z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Due date badge */}
          {isDueToday && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                Due today
              </span>
            </div>
          )}
          {isOverdue && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                Overdue · {overdueDays} day{overdueDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {todo.due_date && !isDueToday && !isOverdue && !todo.completed && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              Due {new Date(todo.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}

          {/* Progress bar */}
          {todo.subtasks && todo.subtasks.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Subtasks */}
          {todo.subtasks && todo.subtasks.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus-ring px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200 flex items-center gap-1"
              >
                <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                {isExpanded ? "Hide subtasks" : `Show subtasks (${todo.subtasks.length})`}
              </button>
              {isExpanded && (
                <div className="mt-3 space-y-2 animate-slide-in-down">
                  {todo.subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
                      <button
                        onClick={() => toggleSubtask(subtask.id, subtask.completed)}
                        disabled={loading}
                        className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center flex-shrink-0 focus-ring transition-all duration-200 ${subtask.completed ? "bg-green-500 border-green-500 text-white shadow-lg" : "border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950"}`}
                      >
                        {subtask.completed && (
                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0 break-words">
                        <span className={`text-xs sm:text-sm ${subtask.completed ? "line-through text-gray-500 dark:text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                          {subtask.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400">W:</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{subtask.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {todo.description && (
            <p className={`text-xs sm:text-sm mt-2 break-words ${todo.completed ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-300"}`}>
              {todo.description}
            </p>
          )}

          {/* Notes */}
          {todo.notes && (
            <div className="mt-3">
              <button
                onClick={() => setIsNoteExpanded(!isNoteExpanded)}
                className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus-ring px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200 flex items-center gap-1"
              >
                <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 ${isNoteExpanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                {isNoteExpanded ? "Hide notes" : "Show notes"}
              </button>
              {isNoteExpanded && (
                <div className={`mt-3 p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 animate-slide-in-down ${todo.completed ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>
                  <pre className="whitespace-pre-wrap font-sans break-words">{todo.notes}</pre>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-900 gap-3">
            <select
              value={todo.status_id}
              onChange={e => updateStatus(Number(e.target.value))}
              disabled={loading}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-black text-black dark:text-white focus-ring transition-all duration-200"
            >
              <option value={1}>📋 Pending</option>
              <option value={2}>⚡ In Progress</option>
              <option value={3}>✅ Completed</option>
            </select>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span>{new Date(todo.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
