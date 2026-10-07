import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarDays,
  ArrowRightToLine,
  MoreHorizontal,
  Pencil,
  AlarmClock,
  Ticket as TicketIcon,
  CheckCheck,
  StickyNote,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { TODO_PRIORITIES, findMeta } from '@/lib/constants';
import { cn, dayKey, addDaysKey, keyToDate, storedDayKey, friendlyDay, apiError } from '@/lib/utils';

// Start of the 7-day strip that contains `key` (weeks start on Monday).
function weekStart(key) {
  const d = keyToDate(key);
  const offset = (d.getDay() + 6) % 7;
  return addDaysKey(key, -offset);
}

export default function ProjectTodos({ projectId }) {
  const today = dayKey();
  const [selected, setSelected] = useState(today);
  const [start, setStart] = useState(weekStart(today));
  const [todos, setTodos] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const end = addDaysKey(start, 6);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(start, i)), [start]);

  const load = useCallback(async () => {
    try {
      const res = await api.getProjectTodos(projectId, { from: start, to: end });
      setTodos(res.data.todos);
      setOverdue(res.data.overdue);
      setDays(res.data.days);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load to-dos'));
    } finally {
      setLoading(false);
    }
  }, [projectId, start, end]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    api
      .getUsers()
      .then((r) => setUsers(r.data.filter((u) => u.isActive !== false)))
      .catch(() => {});
  }, []);

  const goTo = (key) => {
    setSelected(key);
    const ws = weekStart(key);
    if (ws !== start) setStart(ws);
  };

  const dayStats = useMemo(() => {
    const map = {};
    days.forEach((d) => (map[storedDayKey(d.date)] = d));
    return map;
  }, [days]);

  const dayTodos = todos.filter((t) => storedDayKey(t.date) === selected);
  const open = dayTodos.filter((t) => !t.completed);
  const done = dayTodos.filter((t) => t.completed);
  const pct = dayTodos.length ? Math.round((done.length / dayTodos.length) * 100) : 0;

  const upsert = (todo) => {
    setTodos((prev) => {
      const exists = prev.some((t) => t._id === todo._id);
      const next = exists ? prev.map((t) => (t._id === todo._id ? todo : t)) : [...prev, todo];
      // Drop it from the visible week if it was moved outside of it.
      return next.filter((t) => storedDayKey(t.date) >= start && storedDayKey(t.date) <= end);
    });
    setOverdue((prev) => prev.filter((t) => t._id !== todo._id || (!todo.completed && storedDayKey(todo.date) < today)));
  };

  const refreshSummary = () =>
    api
      .getProjectTodos(projectId, { from: start, to: end })
      .then((res) => {
        setDays(res.data.days);
        setOverdue(res.data.overdue);
      })
      .catch(() => {});

  const updateTodo = async (todo, data, msg) => {
    try {
      const res = await api.updateTodo(todo._id, data);
      upsert(res.data);
      refreshSummary();
      if (msg) toast.success(msg);
    } catch (err) {
      toast.error(apiError(err, 'Update failed'));
    }
  };

  const removeTodo = async (todo) => {
    try {
      await api.deleteTodo(todo._id);
      setTodos((prev) => prev.filter((t) => t._id !== todo._id));
      setOverdue((prev) => prev.filter((t) => t._id !== todo._id));
      refreshSummary();
    } catch (err) {
      toast.error(apiError(err, 'Delete failed'));
    }
  };

  const moveAllOverdueToToday = async () => {
    try {
      await Promise.all(overdue.map((t) => api.updateTodo(t._id, { date: today })));
      toast.success(`Moved ${overdue.length} to-do${overdue.length === 1 ? '' : 's'} to today`);
    } catch (err) {
      toast.error(apiError(err, 'Some to-dos could not be moved'));
    }
    goTo(today);
    load();
  };

  const monthLabel = keyToDate(start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {/* Week strip */}
        <Card className="p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-primary" />
            <p className="font-display text-sm font-semibold">{monthLabel}</p>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setStart(addDaysKey(start, -7))} aria-label="Previous week">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => goTo(today)} disabled={selected === today && start === weekStart(today)}>
                Today
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setStart(addDaysKey(start, 7))} aria-label="Next week">
                <ChevronRight />
              </Button>
              <label className="relative" title="Jump to a date">
                <span className="sr-only">Pick a date</span>
                <input
                  type="date"
                  value={selected}
                  onChange={(e) => e.target.value && goTo(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-md border border-input bg-card text-transparent [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                />
                <CalendarDays className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((key) => {
              const d = keyToDate(key);
              const stat = dayStats[key];
              const isSel = key === selected;
              const isToday = key === today;
              const allDone = stat && stat.total > 0 && stat.done === stat.total;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={cn(
                    'relative flex flex-col items-center rounded-xl border px-1 py-2.5 transition-all',
                    isSel
                      ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                      : 'border-transparent hover:border-border hover:bg-secondary/60',
                    !isSel && key < today && 'opacity-70'
                  )}
                >
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', !isSel && 'text-muted-foreground')}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="mt-0.5 font-display text-xl font-bold tabular-nums">{d.getDate()}</span>
                  <span className="mt-1 flex h-3 items-center gap-0.5">
                    {stat?.total ? (
                      allDone ? (
                        <CheckCheck className={cn('h-3 w-3', isSel ? 'text-spark' : 'text-emerald-500')} />
                      ) : (
                        Array.from({ length: Math.min(stat.total, 4) }).map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              i < stat.done ? (isSel ? 'bg-spark' : 'bg-emerald-500') : isSel ? 'bg-white/40' : 'bg-muted-foreground/30'
                            )}
                          />
                        ))
                      )
                    ) : null}
                  </span>
                  {isToday && !isSel && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-spark ring-2 ring-card" />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Day panel */}
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {keyToDate(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <h3 className="font-display text-xl font-bold">{friendlyDay(selected)}&apos;s plan</h3>
              </div>
              {dayTodos.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {done.length}/{dayTodos.length} done
                  </span>
                </div>
              )}
            </div>
          </div>

          <QuickAdd
            projectId={projectId}
            date={selected}
            users={users}
            onCreated={(t) => {
              upsert(t);
              refreshSummary();
            }}
          />

          <div className="p-2">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 rounded-lg" />
                ))}
              </div>
            ) : dayTodos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold">Nothing planned for {friendlyDay(selected).toLowerCase()}</p>
                <p className="mt-1 text-xs text-muted-foreground">Add a to-do above to plan the day.</p>
              </div>
            ) : (
              <>
                {open.map((t) => (
                  <TodoItem key={t._id} todo={t} users={users} today={today} onUpdate={updateTodo} onDelete={removeTodo} />
                ))}
                {done.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Completed · {done.length}
                    </p>
                    {done.map((t) => (
                      <TodoItem key={t._id} todo={t} users={users} today={today} onUpdate={updateTodo} onDelete={removeTodo} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Side: carried over + week summary */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-bold">
              <AlarmClock className="h-4 w-4 text-rose-500" /> Carried over
            </p>
            <span className="rounded-full bg-rose-500/10 px-2 text-xs font-bold text-rose-600 dark:text-rose-300">{overdue.length}</span>
          </div>
          {overdue.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">No unfinished to-dos from previous days. 🌿</p>
          ) : (
            <>
              <div className="max-h-72 divide-y divide-border overflow-y-auto scrollbar-thin">
                {overdue.map((t) => (
                  <div key={t._id} className="flex items-center gap-2 px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      onChange={() => updateTodo(t, { completed: true }, 'Done!')}
                      aria-label={`Complete ${t.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.title}</p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{friendlyDay(storedDayKey(t.date))}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" title="Move to today" onClick={() => updateTodo(t, { date: today }, 'Moved to today')}>
                      <ArrowRightToLine />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <Button variant="outline" size="sm" className="w-full" onClick={moveAllOverdueToToday}>
                  Move all to today
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-bold">This week</p>
          <div className="space-y-2">
            {week.map((key) => {
              const s = dayStats[key];
              const p = s?.total ? Math.round((s.done / s.total) * 100) : 0;
              return (
                <button key={key} onClick={() => setSelected(key)} className="flex w-full items-center gap-3 text-left">
                  <span className={cn('w-10 text-xs font-semibold', key === selected ? 'text-primary' : 'text-muted-foreground')}>
                    {keyToDate(key).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${p}%` }} />
                  </div>
                  <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{s ? `${s.done}/${s.total}` : '—'}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAdd({ projectId, date, users, onCreated }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('none');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.createTodo(projectId, {
        title,
        date,
        priority,
        assignedTo: assignee === 'none' ? undefined : assignee,
      });
      onCreated(res.data);
      setTitle('');
    } catch (err) {
      toast.error(apiError(err, 'Could not add to-do'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-b border-border bg-secondary/20 p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Plus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Add a to-do for ${friendlyDay(date).toLowerCase()}…`}
          className="pl-9"
          maxLength={300}
        />
      </div>
      <div className="flex gap-2">
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TODO_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <span className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', p.color)} /> {p.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Anyone</SelectItem>
            {users.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="gradient" disabled={saving || !title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
}

function TodoItem({ todo, users, today, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: todo.title, notes: todo.notes || '' });
  const [showNotes, setShowNotes] = useState(false);
  const pr = findMeta(TODO_PRIORITIES, todo.priority);
  const key = storedDayKey(todo.date);

  useEffect(() => setDraft({ title: todo.title, notes: todo.notes || '' }), [todo.title, todo.notes]);

  if (editing) {
    return (
      <div className="m-1 space-y-2 rounded-lg border border-primary/30 bg-accent/30 p-3">
        <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <Textarea rows={2} placeholder="Notes (optional)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-8 w-[150px] text-xs"
            defaultValue={key}
            onChange={(e) => e.target.value && onUpdate(todo, { date: e.target.value }, 'Moved')}
          />
          <Select value={todo.assignedTo?._id || 'none'} onValueChange={(v) => onUpdate(todo, { assignedTo: v === 'none' ? null : v })}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Anyone</SelectItem>
              {users.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={todo.priority} onValueChange={(v) => onUpdate(todo, { priority: v })}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TODO_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onUpdate(todo, draft);
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-lg px-3 py-2 transition-colors hover:bg-secondary/50">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onUpdate(todo, { completed: !todo.completed })}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
            todo.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40 hover:border-primary hover:bg-accent'
          )}
          aria-label={todo.completed ? 'Mark as not done' : 'Mark as done'}
        >
          {todo.completed && <CheckCheck className="h-3 w-3" />}
        </button>
        <span className={cn('h-2 w-2 shrink-0 rounded-full', pr.color)} title={`${pr.label} priority`} />
        <div className="min-w-0 flex-1" onDoubleClick={() => setEditing(true)}>
          <p className={cn('truncate text-sm font-medium', todo.completed && 'text-muted-foreground line-through')}>{todo.title}</p>
          {(todo.ticket || (todo.completed && todo.completedBy)) && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {todo.ticket && (
                <Link to={`/tickets/${todo.ticket._id}`} className="inline-flex items-center gap-1 hover:text-primary">
                  <TicketIcon className="h-3 w-3" /> #{todo.ticket.ticketNumber}
                </Link>
              )}
              {todo.completed && todo.completedBy && <span>Done by {todo.completedBy.name}</span>}
            </div>
          )}
        </div>
        {todo.notes && (
          <button onClick={() => setShowNotes((v) => !v)} className="text-muted-foreground hover:text-foreground" title="Notes">
            <StickyNote className="h-3.5 w-3.5" />
          </button>
        )}
        {todo.assignedTo && <UserAvatar user={todo.assignedTo} size="xs" />}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 text-muted-foreground outline-none transition-opacity hover:bg-secondary sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            {key !== today && (
              <DropdownMenuItem onClick={() => onUpdate(todo, { date: today }, 'Moved to today')}>
                <ArrowRightToLine className="mr-2 h-4 w-4" /> Move to today
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onUpdate(todo, { date: addDaysKey(key, 1) }, 'Pushed to next day')}>
              <ChevronRight className="mr-2 h-4 w-4" /> Push to next day
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(todo)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showNotes && todo.notes && (
        <p className="ml-[52px] mt-1.5 whitespace-pre-wrap rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{todo.notes}</p>
      )}
    </div>
  );
}
