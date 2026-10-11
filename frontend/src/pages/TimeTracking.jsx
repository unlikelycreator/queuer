import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, Play, Square, Trash2, Clock, DollarSign, Gauge, Receipt, Loader2 } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useTimer } from '@/context/TimerContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, StatTile, EmptyState } from '@/components/shared/Common';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { cn, dayKey, addDaysKey, keyToDate, formatMinutes, formatClock, formatMoney, apiError } from '@/lib/utils';

function weekStart(key) {
  const offset = (keyToDate(key).getDay() + 6) % 7;
  return addDaysKey(key, -offset);
}

// "1h 30m", "1:30", "1.5h", "90" (minutes) → minutes
export function parseDuration(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return NaN;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/);
  if (m && (m[1] || m[2])) return Math.round((Number(m[1]) || 0) * 60 + (Number(m[2]) || 0));
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  return NaN;
}

// Local-time ISO day string for an entry's start.
const entryDay = (e) => dayKey(new Date(e.startedAt));

export default function TimeTracking() {
  const { user, isAdmin } = useAuth();
  const { billing, terms } = useWorkspace();
  const timer = useTimer();
  const today = dayKey();
  const [start, setStart] = useState(weekStart(today));
  const [who, setWho] = useState('me');
  const [users, setUsers] = useState([]);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [logDay, setLogDay] = useState(today);

  const end = addDaysKey(start, 6);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(start, i)), [start]);

  const load = () => {
    setLoading(true);
    const from = keyToDate(start).toISOString();
    const to = new Date(keyToDate(end).getTime() + 864e5 - 1).toISOString();
    const params = { from, to };
    if (who !== 'all') params.user = who;
    Promise.all([api.getTimeEntries(params), isAdmin ? api.getTimeSummary({ from, to }) : Promise.resolve({ data: { users: [] } })])
      .then(([e, s]) => {
        setData(e.data);
        setSummary(s.data.users);
      })
      .catch((err) => toast.error(apiError(err, 'Failed to load time')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, who, timer.version]);

  useEffect(() => {
    if (isAdmin) api.getUsers().then((r) => setUsers(r.data)).catch(() => {});
  }, [isAdmin]);

  const entries = data?.entries || [];
  const byDay = useMemo(() => {
    const m = {};
    entries.forEach((e) => (m[entryDay(e)] ||= []).push(e));
    return m;
  }, [entries]);
  const dayTotals = week.map((k) => (byDay[k] || []).reduce((a, e) => a + e.minutes, 0));
  const maxDay = Math.max(60, ...dayTotals);
  const value = entries.filter((e) => e.billable).reduce((a, e) => a + (e.minutes / 60) * (e.hourlyRate || billing.defaultHourlyRate || 0), 0);

  const update = async (entry, patch) => {
    try {
      await api.updateTimeEntry(entry._id, patch);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Update failed'));
    }
  };

  const remove = async (entry) => {
    try {
      await api.deleteTimeEntry(entry._id);
      toast.success('Entry removed');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Delete failed'));
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Time" title="Time tracking" description={`Track every minute against ${terms.tickets.toLowerCase()} and ${terms.projects.toLowerCase()} — then turn billable time into invoices.`}>
        {isAdmin && (
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">My time</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
              {users
                .filter((u) => u._id !== user?._id)
                .map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="gradient"
          onClick={() => {
            setLogDay(week.includes(today) ? today : start);
            setLogOpen(true);
          }}
        >
          <Plus /> Log time
        </Button>
      </PageHeader>

      <QuickTimer />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="This week" value={formatMinutes(data?.totalMinutes || 0)} icon={Clock} tone="info" />
        <StatTile label="Billable" value={formatMinutes(data?.billableMinutes || 0)} icon={DollarSign} />
        <StatTile
          label="Billable share"
          value={data?.totalMinutes ? `${Math.round((data.billableMinutes / data.totalMinutes) * 100)}%` : '—'}
          icon={Gauge}
          tone="spark"
        />
        <StatTile label="Billable value" value={formatMoney(value, billing.currency)} icon={Receipt} tone="warn" hint={`at ${formatMoney(billing.defaultHourlyRate, billing.currency)}/h default`} />
      </div>

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <p className="font-display text-sm font-semibold">
            {keyToDate(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {keyToDate(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setStart(addDaysKey(start, -7))} aria-label="Previous week">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" disabled={start === weekStart(today)} onClick={() => setStart(weekStart(today))}>
              This week
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setStart(addDaysKey(start, 7))} aria-label="Next week">
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {week.map((k, i) => (
            <button
              key={k}
              onClick={() => {
                setLogDay(k);
                setLogOpen(true);
              }}
              className={cn('group rounded-xl border p-2 text-left transition-colors hover:border-primary/40', k === today ? 'border-primary/40 bg-accent/30' : 'border-border')}
              title={`Log time on ${k}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {keyToDate(k).toLocaleDateString('en-US', { weekday: 'short' })} {keyToDate(k).getDate()}
              </p>
              <div className="mt-2 flex h-16 items-end rounded-md bg-secondary/50">
                <div className="w-full rounded-md bg-[var(--viz-2)] transition-all" style={{ height: `${(dayTotals[i] / maxDay) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-sm font-bold tabular-nums">{dayTotals[i] ? formatMinutes(dayTotals[i]) : '—'}</p>
            </button>
          ))}
        </div>
      </Card>

      <div className={cn('grid gap-5', isAdmin && summary.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_300px]')}>
        <div className="space-y-4">
          {loading && !data ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No time logged this week"
              description={`Start a timer from any ${terms.ticket.toLowerCase()}, or log time manually.`}
              action={
                <Button variant="gradient" onClick={() => setLogOpen(true)}>
                  <Plus /> Log time
                </Button>
              }
            />
          ) : (
            [...week].reverse().filter((k) => byDay[k]?.length).map((k) => (
              <Card key={k} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2.5">
                  <p className="text-sm font-bold">{keyToDate(k).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                  <p className="text-sm font-bold tabular-nums">{formatMinutes(byDay[k].reduce((a, e) => a + e.minutes, 0))}</p>
                </div>
                <div className="divide-y divide-border">
                  {byDay[k].map((e) => (
                    <EntryRow key={e._id} entry={e} showUser={who !== 'me'} onUpdate={update} onDelete={remove} />
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>

        {isAdmin && summary.length > 0 && (
          <Card className="h-fit">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-bold">Team this week</p>
              {summary.map((s) => (
                <div key={s.user?._id} className="flex items-center gap-3">
                  <UserAvatar user={s.user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.user?.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-[var(--viz-2)]" style={{ width: `${Math.min(100, (s.minutes / (40 * 60)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-right text-xs tabular-nums">
                    <span className="block font-bold">{formatMinutes(s.minutes)}</span>
                    <span className="text-muted-foreground">{formatMinutes(s.billableMinutes)} bill.</span>
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">Bars show progress toward a 40h week.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <LogTimeDialog open={logOpen} onOpenChange={setLogOpen} defaultDate={logDay} onSaved={load} />
    </div>
  );
}

function EntryRow({ entry: e, showUser, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [dur, setDur] = useState(formatMinutes(e.minutes));
  const locked = !!e.invoice;

  const saveDur = () => {
    setEditing(false);
    const m = parseDuration(dur);
    if (Number.isFinite(m) && m > 0 && m !== e.minutes) onUpdate(e, { minutes: m });
    else setDur(formatMinutes(e.minutes));
  };

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      {showUser && <UserAvatar user={e.user} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.description || <span className="text-muted-foreground">No description</span>}</p>
        <p className="truncate text-xs text-muted-foreground">
          {e.ticket ? (
            <Link to={`/tickets/${e.ticket._id}`} className="font-semibold hover:text-primary">
              #{e.ticket.ticketNumber} {e.ticket.title}
            </Link>
          ) : (
            e.project?.name
          )}
          {e.client?.name && ` · ${e.client.name}`}
          {' · '}
          {new Date(e.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
      {locked ? (
        <Badge variant="success" title={`On invoice ${e.invoice.number}`}>
          <Receipt className="h-3 w-3" /> {e.invoice.number}
        </Badge>
      ) : (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground" title="Billable">
          <Switch checked={e.billable} onCheckedChange={(v) => onUpdate(e, { billable: v })} />
          <span className="hidden sm:inline">Billable</span>
        </label>
      )}
      {editing ? (
        <Input autoFocus className="h-8 w-20 text-right text-sm" value={dur} onChange={(ev) => setDur(ev.target.value)} onBlur={saveDur} onKeyDown={(ev) => ev.key === 'Enter' && saveDur()} />
      ) : (
        <button
          disabled={locked}
          onClick={() => setEditing(true)}
          className="w-20 rounded-md px-2 py-1 text-right font-mono text-sm font-bold tabular-nums hover:bg-secondary disabled:hover:bg-transparent"
          title={locked ? 'Invoiced time is locked' : 'Click to edit'}
        >
          {formatMinutes(e.minutes)}
        </button>
      )}
      {!locked && (
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100" onClick={() => onDelete(e)} aria-label="Delete entry">
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

// Start a timer on a project (no ticket needed) right from the time page.
function QuickTimer() {
  const timer = useTimer();
  const { terms } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    api.getProjects({ limit: 200 }).then((r) => setProjects(r.data.items || [])).catch(() => {});
  }, []);

  if (timer.running) {
    const r = timer.running;
    return (
      <Card className="flex flex-col gap-3 border-primary/30 bg-accent/30 p-4 sm:flex-row sm:items-center">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{r.description || (r.ticket ? `#${r.ticket.ticketNumber} ${r.ticket.title}` : r.project?.name)}</p>
          <p className="truncate text-xs text-muted-foreground">{r.ticket ? `#${r.ticket.ticketNumber} · ${r.project?.name}` : r.project?.name}</p>
        </div>
        <span className="font-mono text-2xl font-bold tabular-nums">{formatClock(timer.elapsed)}</span>
        <Button className="bg-rose-500 text-white hover:bg-rose-500/90" onClick={timer.stop}>
          <Square className="fill-current" /> Stop
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <Input placeholder="What are you working on?" value={desc} onChange={(e) => setDesc(e.target.value)} className="flex-1" />
      <Select value={project} onValueChange={setProject}>
        <SelectTrigger className="sm:w-56">
          <SelectValue placeholder={`Choose ${terms.project.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p._id} value={p._id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="gradient"
        disabled={!project}
        onClick={async () => {
          if (await timer.start({ project, description: desc })) setDesc('');
        }}
      >
        <Play className="fill-current" /> Start timer
      </Button>
    </Card>
  );
}

export function LogTimeDialog({ open, onOpenChange, defaultDate, ticket, onSaved }) {
  const { terms } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ project: '', date: defaultDate || dayKey(), duration: '', description: '', billable: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ project: '', date: defaultDate || dayKey(), duration: '', description: '', billable: true });
    if (!ticket) api.getProjects({ limit: 200 }).then((r) => setProjects(r.data.items || [])).catch(() => {});
  }, [open, defaultDate, ticket]);

  const minutes = parseDuration(form.duration);

  const submit = async (e) => {
    e.preventDefault();
    if (!Number.isFinite(minutes) || minutes <= 0) return toast.error('Enter a duration like 1h 30m, 1:30 or 45');
    setSaving(true);
    try {
      await api.createTimeEntry({
        ticket: ticket?._id,
        project: ticket ? undefined : form.project,
        date: form.date,
        minutes,
        description: form.description,
        billable: form.billable,
      });
      toast.success(`Logged ${formatMinutes(minutes)}`);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not log time'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
          <DialogDescription>{ticket ? `On #${ticket.ticketNumber} ${ticket.title}` : `Record time against a ${terms.project.toLowerCase()}.`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!ticket && (
            <div className="space-y-1.5">
              <Label>{terms.project}</Label>
              <Select value={form.project} onValueChange={(v) => setForm({ ...form, project: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose a ${terms.project.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name} <span className="text-muted-foreground">· {p.client?.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} max={dayKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Input autoFocus placeholder="1h 30m" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              <p className="h-4 text-[11px] text-muted-foreground">{Number.isFinite(minutes) && minutes > 0 ? `= ${formatMinutes(minutes)}` : 'e.g. 1h 30m, 1:30, 45'}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>What did you work on?</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Fixed checkout validation" />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Billable</span>
            <Switch checked={form.billable} onCheckedChange={(v) => setForm({ ...form, billable: v })} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={saving || (!ticket && !form.project)}>
              {saving && <Loader2 className="animate-spin" />} Log time
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
