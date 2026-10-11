import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Inbox,
  CheckCircle2,
  Layers,
  MessageSquareReply,
  Timer,
  ShieldCheck,
  Star,
  RotateCcw,
  Clock,
  Gauge,
  Coins,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/Common';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { cn, dayKey, addDaysKey, formatDuration, formatMoney, apiError, downloadBlob } from '@/lib/utils';

const RANGES = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
  { key: 'custom', label: 'Custom' },
];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
  boxShadow: '0 12px 32px -12px rgba(0,0,0,.25)',
};
const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

function shortDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Insights() {
  const { isAdmin } = useAuth();
  const { terms } = useWorkspace();
  const [rangeKey, setRangeKey] = useState('30');
  const [custom, setCustom] = useState({ from: addDaysKey(dayKey(), -29), to: dayKey() });
  const [client, setClient] = useState('all');
  const [clients, setClients] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (rangeKey === 'custom') return custom;
    return { from: addDaysKey(dayKey(), -(Number(rangeKey) - 1)), to: dayKey() };
  }, [rangeKey, custom]);

  useEffect(() => {
    api
      .getClients({ limit: 500 })
      .then((r) => setClients(r.data.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { ...range, tz: -new Date().getTimezoneOffset() };
    if (client !== 'all') params.client = client;
    api
      .getReport(params)
      .then((r) => setData(r.data))
      .catch((err) => toast.error(apiError(err, 'Failed to load insights')))
      .finally(() => setLoading(false));
  }, [range, client]);

  const exportCsv = async (type) => {
    try {
      const params = { ...range, type };
      if (client !== 'all') params.client = client;
      const res = await api.exportReport(params);
      downloadBlob(res.data, `zoopdesk-${type}-${range.from}-to-${range.to}.csv`);
    } catch (err) {
      toast.error(apiError(err, 'Export failed'));
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Analytics" title="Insights" description={`KPIs for your ${terms.tickets.toLowerCase()}, team, time and revenue — compared with the previous period.`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download /> Export CSV
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportCsv('tickets')}>{terms.tickets}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportCsv('time')}>Time entries</DropdownMenuItem>
            {isAdmin && <DropdownMenuItem onClick={() => exportCsv('invoices')}>Invoices</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Filters — one row above all charts */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                rangeKey === r.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {rangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" className="h-9 w-[150px]" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" className="h-9 w-[150px]" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {terms.clients.toLowerCase()}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {shortDate(range.from)} – {shortDate(range.to)} · vs previous {Math.round((new Date(range.to) - new Date(range.from)) / 864e5) + 1} days
          </span>
        )}
      </div>

      {loading && !data ? (
        <InsightsSkeleton />
      ) : data ? (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
          <KpiGrid data={data} terms={terms} isAdmin={isAdmin} />

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <ChartHeader title="Throughput" subtitle={`${terms.tickets} created vs. resolved${data.range.bucketDays > 1 ? ' per week' : ' per day'}`}>
                <Legend items={[{ label: 'Created', color: 'var(--viz-1)' }, { label: 'Resolved', color: 'var(--viz-2)' }]} />
              </ChartHeader>
              <CardContent className="pl-0">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.trend} barGap={2} barCategoryGap="22%" margin={{ left: 0, right: 12, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--secondary))' }} labelFormatter={shortDate} />
                    <Bar dataKey="created" name="Created" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="resolved" name="Resolved" fill="var(--viz-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <ChartHeader title="Backlog aging" subtitle={`How long open ${terms.tickets.toLowerCase()} have waited`} />
              <CardContent className="space-y-2.5">
                {data.aging.map((a, i) => {
                  const max = Math.max(1, ...data.aging.map((x) => x.count));
                  return (
                    <div key={a.label} className="flex items-center gap-3" title={`${a.label}: ${a.count}`}>
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">{a.label}</span>
                      <div className="h-5 flex-1 overflow-hidden rounded-md bg-secondary/60">
                        <div
                          className="h-full rounded-r-md transition-all duration-500"
                          style={{ width: `${(a.count / max) * 100}%`, backgroundColor: i >= 4 ? '#e11d48' : i >= 3 ? '#d97706' : 'var(--viz-2)' }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold tabular-nums">{a.count}</span>
                    </div>
                  );
                })}
                <p className="pt-2 text-xs text-muted-foreground">
                  {data.kpis.atRiskSla > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> {data.kpis.atRiskSla} at risk of breaching SLA in the next 4h
                    </span>
                  ) : (
                    'No SLA breaches expected in the next 4 hours.'
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <ChartHeader title={`${terms.tickets} by type`} subtitle="Created in this period" />
              <CardContent className="space-y-3">
                {data.byType.length === 0 && <Empty />}
                {data.byType.map((t) => {
                  const max = Math.max(1, ...data.byType.map((x) => x.count));
                  return (
                    <div key={t.value}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} /> {t.label}
                        </span>
                        <span className="font-semibold tabular-nums">{t.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full" style={{ width: `${(t.count / max) * 100}%`, backgroundColor: t.color }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <ChartHeader title="Open by priority" subtitle="Current backlog" />
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {data.byPriority.map((p) => (
                    <div key={p.priority} className="rounded-xl border border-border p-3 text-center">
                      <p className={cn('font-display text-2xl font-bold tabular-nums', p.priority === 'critical' && p.open > 0 && 'text-rose-600 dark:text-rose-400')}>
                        {p.open}
                      </p>
                      <p className="text-[11px] font-semibold capitalize text-muted-foreground">{p.priority}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-1.5 text-xs">
                  {data.bySource.map((s) => (
                    <div key={s.source} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {s.source === 'public_form' ? 'Client portal' : s.source === 'email' ? 'Email' : 'Created by team'}
                      </span>
                      <span className="font-semibold tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 xl:col-span-1">
              <ChartHeader title="When requests arrive" subtitle="Created by weekday and hour (your timezone)" />
              <CardContent>
                <Heatmap grid={data.heatmap} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <ChartHeader title="Hours logged" subtitle={`${data.kpis.hoursLogged ?? 0}h total · ${data.kpis.billableHours ?? 0}h billable`} />
              <CardContent className="pl-0">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.trend} margin={{ left: 0, right: 12, top: 8 }}>
                    <defs>
                      <linearGradient id="gHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--viz-2)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--viz-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={34} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={shortDate} formatter={(v) => [`${v}h`, 'Logged']} />
                    <Area type="monotone" dataKey="hours" stroke="var(--viz-2)" strokeWidth={2} fill="url(#gHours)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {isAdmin ? (
              <Card>
                <ChartHeader title="Revenue" subtitle="Invoiced vs. collected, last 6 months">
                  <Legend items={[{ label: 'Invoiced', color: 'var(--viz-1)' }, { label: 'Collected', color: 'var(--viz-2)' }]} />
                </ChartHeader>
                <CardContent className="pl-0">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.revenue} barGap={2} barCategoryGap="28%" margin={{ left: 8, right: 12, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => formatMoney(v, data.kpis.currency).replace(/\.00$/, '')} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--secondary))' }} formatter={(v, n) => [formatMoney(v, data.kpis.currency), n]} />
                      <Bar dataKey="invoiced" name="Invoiced" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="collected" name="Collected" fill="var(--viz-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ChartHeader title="Satisfaction" subtitle="Client ratings after resolution" />
                <CardContent>
                  <p className="font-display text-4xl font-bold">{data.kpis.csatAverage ?? '—'}<span className="text-lg text-muted-foreground">/5</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">{data.kpis.csatResponses} rating{data.kpis.csatResponses === 1 ? '' : 's'}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <ChartHeader title="Team leaderboard" subtitle="Resolved, workload, time and satisfaction" />
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border bg-secondary/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-2">Member</th>
                      <th className="px-2 py-2 text-right">Resolved</th>
                      <th className="px-2 py-2 text-right">Open</th>
                      <th className="px-2 py-2 text-right">Avg res.</th>
                      <th className="px-2 py-2 text-right">Hours</th>
                      <th className="px-5 py-2 text-right">CSAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byMember.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <Empty />
                        </td>
                      </tr>
                    )}
                    {data.byMember.map((m) => (
                      <tr key={m._id}>
                        <td className="px-5 py-2.5">
                          <span className="flex items-center gap-2">
                            <UserAvatar user={m} size="sm" /> <span className="truncate font-medium">{m.name}</span>
                          </span>
                        </td>
                        <td className="px-2 text-right font-semibold tabular-nums">{m.resolved}</td>
                        <td className="px-2 text-right tabular-nums">{m.open}</td>
                        <td className="px-2 text-right tabular-nums text-muted-foreground">{formatDuration(m.avgResolutionHours)}</td>
                        <td className="px-2 text-right tabular-nums">
                          {m.hours}h <span className="text-xs text-muted-foreground">({m.billableHours}h bill.)</span>
                        </td>
                        <td className="px-5 text-right tabular-nums">{m.csat ? `${m.csat}★` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <ChartHeader title={`Top ${terms.clients.toLowerCase()}`} subtitle="Volume, effort and billing" />
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border bg-secondary/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-2">{terms.client}</th>
                      <th className="px-2 py-2 text-right">New</th>
                      <th className="px-2 py-2 text-right">Open</th>
                      <th className="px-2 py-2 text-right">Hours</th>
                      {isAdmin && <th className="px-5 py-2 text-right">Invoiced</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byClient.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <Empty />
                        </td>
                      </tr>
                    )}
                    {data.byClient.map((c) => (
                      <tr key={c._id}>
                        <td className="px-5 py-2.5 font-medium">
                          <Link to={`/clients/${c._id}`} className="hover:text-primary">
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-2 text-right tabular-nums">{c.created}</td>
                        <td className="px-2 text-right tabular-nums">{c.open}</td>
                        <td className="px-2 text-right tabular-nums">{c.hours}h</td>
                        {isAdmin && <td className="px-5 text-right tabular-nums">{formatMoney(c.invoiced, data.kpis.currency)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartHeader({ title, subtitle, children }) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </CardHeader>
  );
}

function Legend({ items }) {
  return (
    <div className="flex shrink-0 gap-3 text-xs">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-xs text-muted-foreground">No data in this period</p>;
}

// Lower is better for these metrics, so a decrease is shown as good news.
const LOWER_IS_BETTER = new Set(['avgFirstResponseHours', 'avgResolutionHours', 'reopenRate']);

function KpiGrid({ data, terms, isAdmin }) {
  const k = data.kpis;
  const d = data.deltas;
  const cur = k.currency;
  const tiles = [
    { key: 'created', label: `New ${terms.tickets.toLowerCase()}`, value: k.created, icon: Inbox },
    { key: 'resolved', label: 'Resolved', value: k.resolved, icon: CheckCircle2 },
    { key: 'backlog', label: 'Open backlog', value: k.backlog, icon: Layers, hint: k.overdueTickets ? `${k.overdueTickets} overdue` : 'none overdue' },
    { key: 'avgFirstResponseHours', label: 'Avg first response', value: formatDuration(k.avgFirstResponseHours), icon: MessageSquareReply },
    { key: 'avgResolutionHours', label: 'Avg resolution', value: formatDuration(k.avgResolutionHours), icon: Timer, hint: k.medianResolutionHours !== null ? `median ${formatDuration(k.medianResolutionHours)}` : undefined },
    { key: 'slaCompliance', label: 'SLA compliance', value: k.slaCompliance === null ? '—' : `${k.slaCompliance}%`, icon: ShieldCheck, hint: `${k.slaMeasured} measured` },
    { key: 'csatAverage', label: 'Client satisfaction', value: k.csatAverage === null ? '—' : `${k.csatAverage}/5`, icon: Star, hint: k.csatResponses ? `${k.csatSatisfied}% satisfied · ${k.csatResponses} ratings` : 'no ratings yet' },
    { key: 'reopenRate', label: 'Reopen rate', value: k.reopenRate === null ? '—' : `${k.reopenRate}%`, icon: RotateCcw },
    { key: 'hoursLogged', label: 'Hours logged', value: `${k.hoursLogged ?? 0}h`, icon: Clock, hint: `${k.billableHours ?? 0}h billable` },
    { key: 'utilization', label: 'Billable utilization', value: k.utilization === null ? '—' : `${k.utilization}%`, icon: Gauge },
    ...(isAdmin
      ? [
          { key: 'billableValue', label: 'Billable value', value: formatMoney(k.billableValue, cur), icon: Coins, hint: 'time × rates' },
          { key: 'collected', label: 'Collected', value: formatMoney(k.collected, cur), icon: Wallet, hint: `${formatMoney(k.outstanding, cur)} outstanding${k.overdueAmount ? ` · ${formatMoney(k.overdueAmount, cur)} overdue` : ''}` },
        ]
      : []),
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.key} className="rounded-xl border border-border/80 bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <t.icon className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="mt-2 truncate font-display text-[22px] font-bold tabular-nums tracking-tight">{t.value}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <Delta value={d[t.key]} lowerIsBetter={LOWER_IS_BETTER.has(t.key)} />
            {t.hint && <span className="truncate text-muted-foreground">{t.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Delta({ value, lowerIsBetter }) {
  if (value === null || value === undefined) return null;
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  const good = lowerIsBetter ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 font-semibold', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}
      title="vs previous period"
    >
      <Icon className="h-3 w-3" /> {Math.abs(value)}%
    </span>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Heatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div>
      <div className="grid grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[2px]">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9px] text-muted-foreground">
            {h % 6 === 0 ? h : ''}
          </span>
        ))}
        {grid.map((row, d) => (
          <React.Fragment key={d}>
            <span className="text-[10px] font-semibold leading-[14px] text-muted-foreground">{DAYS[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00 — ${v} created`}
                className="h-3.5 rounded-[3px] bg-secondary"
                style={v ? { backgroundColor: 'var(--viz-2)', opacity: 0.18 + 0.82 * (v / max) } : undefined}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        Fewer
        {[0.18, 0.4, 0.6, 0.8, 1].map((o) => (
          <span key={o} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'var(--viz-2)', opacity: o }} />
        ))}
        More
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
