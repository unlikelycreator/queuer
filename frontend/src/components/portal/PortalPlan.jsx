import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCheck, CalendarDays, ListTodo } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { TODO_PRIORITIES, findMeta } from '@/lib/constants';
import { cn, dayKey, addDaysKey, keyToDate, storedDayKey, friendlyDay } from '@/lib/utils';

function weekStart(key) {
  const offset = (keyToDate(key).getDay() + 6) % 7; // weeks start on Monday
  return addDaysKey(key, -offset);
}

/** Read-only view of the team's day-by-day plan, shown in the client portal when enabled. */
export default function PortalPlan({ token }) {
  const today = dayKey();
  const [start, setStart] = useState(weekStart(today));
  const [selected, setSelected] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const end = addDaysKey(start, 6);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(start, i)), [start]);

  useEffect(() => {
    setLoading(true);
    api
      .getPortalTodos(token, { from: start, to: end })
      .then((res) => {
        setData(res.data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token, start, end]);

  const byDay = useMemo(() => {
    const map = {};
    (data?.todos || []).forEach((t) => {
      const k = storedDayKey(t.date);
      (map[k] ||= []).push(t);
    });
    return map;
  }, [data]);

  if (error) {
    return (
      <Card className="px-6 py-12 text-center text-sm text-muted-foreground">The project plan isn't available right now.</Card>
    );
  }

  const dayTodos = byDay[selected] || [];
  const weekTodos = data?.todos || [];
  const weekDone = weekTodos.filter((t) => t.completed).length;
  const overallPct = data?.totals.total ? Math.round((data.totals.done / data.totals.total) * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-medium text-muted-foreground">This week</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {weekDone}
            <span className="text-base text-muted-foreground">/{weekTodos.length} tasks done</span>
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-muted-foreground">All planned work</p>
            <p className="text-sm font-bold tabular-nums text-primary">{overallPct}%</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {data?.totals.done ?? 0} of {data?.totals.total ?? 0} tasks completed
          </p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="mb-3 flex items-center gap-2 px-1">
          <CalendarDays className="h-4 w-4 text-primary" />
          <p className="font-display text-sm font-semibold">
            {keyToDate(start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setStart(addDaysKey(start, -7))} aria-label="Previous week">
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selected === today && start === weekStart(today)}
              onClick={() => {
                setStart(weekStart(today));
                setSelected(today);
              }}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setStart(addDaysKey(start, 7))} aria-label="Next week">
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((key) => {
            const items = byDay[key] || [];
            const done = items.filter((t) => t.completed).length;
            const isSel = key === selected;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cn(
                  'relative flex flex-col items-center rounded-xl border px-1 py-2.5 transition-all',
                  isSel ? 'border-primary bg-primary text-primary-foreground shadow-soft' : 'border-transparent hover:bg-secondary/60'
                )}
              >
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', !isSel && 'text-muted-foreground')}>
                  {keyToDate(key).toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="mt-0.5 font-display text-xl font-bold tabular-nums">{keyToDate(key).getDate()}</span>
                <span className="mt-1 flex h-3 items-center gap-0.5">
                  {items.length > 0 &&
                    (done === items.length ? (
                      <CheckCheck className={cn('h-3 w-3', isSel ? 'text-spark' : 'text-emerald-500')} />
                    ) : (
                      Array.from({ length: Math.min(items.length, 4) }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            i < done ? (isSel ? 'bg-spark' : 'bg-emerald-500') : isSel ? 'bg-white/40' : 'bg-muted-foreground/30'
                          )}
                        />
                      ))
                    ))}
                </span>
                {key === today && !isSel && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-spark" />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            {keyToDate(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h3 className="font-display text-lg font-bold">{friendlyDay(selected)}&apos;s plan</h3>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : dayTodos.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <ListTodo className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Nothing planned for {friendlyDay(selected).toLowerCase()}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dayTodos.map((t) => {
              const pr = findMeta(TODO_PRIORITIES, t.priority);
              return (
                <div key={t._id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      t.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/30'
                    )}
                    aria-label={t.completed ? 'Done' : 'Not done yet'}
                  >
                    {t.completed && <CheckCheck className="h-3 w-3" />}
                  </span>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', pr.color)} title={`${pr.label} priority`} />
                  <p className={cn('min-w-0 flex-1 truncate text-sm', t.completed && 'text-muted-foreground line-through')}>{t.title}</p>
                  {t.assignee && (
                    <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                      <UserAvatar user={t.assignee} size="xs" /> {t.assignee.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
