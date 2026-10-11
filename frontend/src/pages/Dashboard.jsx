import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {

  ArrowUpRight,
  Flame,
  MessageCircleWarning,
  CalendarX2,
  Timer,
  CheckCircle2,
  CircleDot,
  ListTodo,
  Sun,
  ArrowRight,
  Sparkles,
  BarChart3,
  FolderKanban,
  CheckCheck,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';
import * as api from '@/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { StatusBadge, TypeBadge, ProjectStatusBadge } from '@/components/shared/Badges';
import { StatTile } from '@/components/shared/Common';
import { timeAgo, formatDuration, cn, dayKey, friendlyDay, storedDayKey, apiError } from '@/lib/utils';
import { TICKET_STATUSES, TICKET_TYPES, ACTIVE_STATUSES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { TemplatePicker } from '@/components/settings/WorkspaceSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { workspace, terms } = useWorkspace();
  const [setupOpen, setSetupOpen] = useState(false);
  const [data, setData] = useState(null);
  const [myDay, setMyDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getMyDay({ date: dayKey() })])
      .then(([d, m]) => {
        setData(d.data);
        setMyDay(m.data);
      })
      .catch((err) => toast.error(apiError(err, 'Failed to load dashboard')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const activeTotal = ACTIVE_STATUSES.reduce((a, s) => a + (data.statusMap[s] || 0), 0);
  const createdTotal = data.trend.reduce((a, d) => a + d.created, 0);
  const resolvedTotal = data.trend.reduce((a, d) => a + d.resolved, 0);

  const toggleTodo = async (todo) => {
    try {
      const res = await api.updateTodo(todo._id, { completed: !todo.completed });
      setMyDay((prev) => ({
        ...prev,
        todos: prev.todos.map((t) => (t._id === todo._id ? res.data : t)),
        overdue: prev.overdue.filter((t) => t._id !== todo._id || !res.data.completed),
      }));
    } catch (err) {
      toast.error(apiError(err, 'Update failed'));
    }
  };

  const alerts = [
    data.openCritical > 0 && {
      to: '/tickets?priority=critical',
      icon: Flame,
      title: `${data.openCritical} critical issue${data.openCritical > 1 ? 's' : ''}`,
      text: 'Needs immediate attention',
      tone: 'border-rose-500/30 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300',
      iconTone: 'bg-rose-500 text-white',
    },
    data.awaitingReply > 0 && {
      to: '/tickets?quick=awaiting',
      icon: MessageCircleWarning,
      title: `${data.awaitingReply} client${data.awaitingReply > 1 ? 's' : ''} waiting`,
      text: 'New messages from the portal or email',
      tone: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300',
      iconTone: 'bg-amber-500 text-white',
    },
    data.overdueTickets > 0 && {
      to: '/tickets?quick=overdue',
      icon: CalendarX2,
      title: `${data.overdueTickets} overdue ticket${data.overdueTickets > 1 ? 's' : ''}`,
      text: 'Past their due date',
      tone: 'border-violet-500/30 bg-violet-500/[0.07] text-violet-700 dark:text-violet-300',
      iconTone: 'bg-violet-500 text-white',
    },
  ].filter(Boolean);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-white shadow-soft-lg sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-60" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-lime-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-sidebar-active-foreground">
              <Sun className="h-4 w-4" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting()}, {user?.name?.split(' ')[0]}.
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/70">
              {data.myOpenTickets > 0
                ? `You have ${data.myOpenTickets} open ticket${data.myOpenTickets > 1 ? 's' : ''} and ${(myDay?.todos || []).filter((t) => !t.completed).length} to-do${(myDay?.todos || []).filter((t) => !t.completed).length === 1 ? '' : 's'} today.`
                : "Nothing assigned to you right now — a great time to plan ahead."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="spark">
              <Link to="/tickets?quick=mine">
                My {terms.tickets.toLowerCase()} <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link to="/insights">
                <BarChart3 /> Insights
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {isAdmin && !workspace?.configured && (
        <button
          onClick={() => setSetupOpen(true)}
          className="flex w-full items-center gap-4 rounded-2xl border border-primary/30 bg-accent/40 p-4 text-left transition-colors hover:bg-accent/60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Tailor ZoopDesk to your team</span>
            <span className="block text-sm text-muted-foreground">Software, QA, support, marketing or agency — pick one to set wording, request types, fields and SLAs in one click.</span>
          </span>
          <ArrowRight className="h-4 w-4 text-primary" />
        </button>
      )}

      {alerts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((a) => (
            <Link key={a.to} to={a.to} className={cn('group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:-translate-y-0.5', a.tone)}>
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', a.iconTone)}>
                <a.icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{a.title}</p>
                <p className="text-xs opacity-80">{a.text}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open tickets" value={activeTotal} icon={CircleDot} tone="info" hint={`${data.totals.totalTickets} total`} />
        <StatTile label="Resolved · 14 days" value={resolvedTotal} icon={CheckCircle2} hint={`${createdTotal} new in the same period`} />
        <StatTile label="Avg. resolution" value={formatDuration(data.avgResolutionHours)} icon={Timer} tone="warn" hint="Last 90 days" />
        <StatTile
          label="Today's to-dos"
          value={`${data.todayTodos.done}/${data.todayTodos.total}`}
          icon={ListTodo}
          tone="spark"
          hint="Across all projects"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Ticket flow</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Created vs. resolved over the last 14 days</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-3" /> Created
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-1" /> Resolved
              </span>
            </div>
          </CardHeader>
          <CardContent className="pl-0 pt-2">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.trend} margin={{ left: 0, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="created" name="Created" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#gCreated)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#gResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* My day */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">My day</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Your to-dos across projects</p>
            </div>
            <ListTodo className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 space-y-1 px-3">
            {!myDay?.todos.length && !myDay?.overdue.length ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <CheckCheck className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold">No to-dos for today</p>
                <p className="mt-1 text-xs text-muted-foreground">Plan your day from any project's To-dos tab.</p>
              </div>
            ) : (
              <>
                {[...(myDay?.overdue || []), ...(myDay?.todos || [])].slice(0, 8).map((t) => {
                  const late = storedDayKey(t.date) < dayKey();
                  return (
                    <div key={t._id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50">
                      <button
                        onClick={() => toggleTodo(t)}
                        className={cn(
                          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          t.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40 hover:border-primary'
                        )}
                        aria-label="Toggle done"
                      >
                        {t.completed && <CheckCheck className="h-2.5 w-2.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm', t.completed && 'text-muted-foreground line-through')}>{t.title}</p>
                        <Link to={`/projects/${t.project?._id}?tab=todos`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                          <FolderKanban className="h-3 w-3" /> {t.project?.name}
                          {late && <span className="font-semibold text-rose-600 dark:text-rose-400">· {friendlyDay(storedDayKey(t.date))}</span>}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Link to="/tickets?sort=updated" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentTickets.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No tickets yet</p>
            ) : (
              <div className="divide-y divide-border">
                {data.recentTickets.map((t) => (
                  <Link key={t._id} to={`/tickets/${t._id}`} className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent/30">
                    <span className="w-10 shrink-0 font-mono text-xs font-semibold text-muted-foreground">#{t.ticketNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold group-hover:text-primary">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.client?.name} · {t.project?.name}
                      </p>
                    </div>
                    <span className="hidden sm:block">
                      <TypeBadge type={t.type} short />
                    </span>
                    <StatusBadge status={t.status} />
                    <UserAvatar user={t.assignedTo} size="sm" />
                    <span className="hidden w-14 shrink-0 text-right text-xs text-muted-foreground md:block">
                      {timeAgo(t.lastActivityAt || t.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
                {TICKET_STATUSES.map((s) =>
                  data.statusMap[s.value] ? (
                    <div
                      key={s.value}
                      className={cn('h-full', s.dot)}
                      style={{ width: `${(data.statusMap[s.value] / Math.max(1, data.totals.totalTickets)) * 100}%` }}
                    />
                  ) : null
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {TICKET_STATUSES.map((s) => (
                  <Link key={s.value} to={`/tickets?status=${s.value}`} className="flex items-center gap-2 text-xs hover:text-primary">
                    <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="ml-auto font-semibold tabular-nums">{data.statusMap[s.value] || 0}</span>
                  </Link>
                ))}
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                {TICKET_TYPES.map((t) => {
                  const n = data.typeMap[t.value] || 0;
                  const max = Math.max(1, ...Object.values(data.typeMap));
                  return (
                    <div key={t.value}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <t.icon className="h-3 w-3" style={{ color: t.color }} /> {t.label}
                        </span>
                        <span className="font-semibold tabular-nums">{n}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, backgroundColor: t.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {data.workload?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Team workload</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.workload.map((w) => (
                  <div key={w._id} className="flex items-center gap-3">
                    <UserAvatar user={w} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{w.name}</span>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(w.count / data.workload[0].count) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs font-semibold tabular-nums">{w.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>What will your team use ZoopDesk for?</DialogTitle>
            <DialogDescription>We'll set the wording, request types, custom fields and SLA targets. Everything stays editable in Settings → Workspace.</DialogDescription>
          </DialogHeader>
          <TemplatePicker compact onApplied={() => setSetupOpen(false)} />
        </DialogContent>
      </Dialog>

      {data.recentProjects.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Active projects</h2>
            <Link to="/projects" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              All projects <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.recentProjects.map((p) => (
              <Link key={p._id} to={`/projects/${p._id}`} className="card-hover rounded-xl border border-border bg-card p-4 shadow-soft">
                <p className="truncate text-xs font-semibold text-muted-foreground">{p.client?.name}</p>
                <p className="mt-0.5 truncate font-display font-semibold">{p.name}</p>
                <div className="mt-3">
                  <ProjectStatusBadge status={p.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
