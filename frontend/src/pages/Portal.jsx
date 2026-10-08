import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  Search,
  Plus,
  Inbox,
  CheckCircle2,
  CircleDot,
  Timer,
  CalendarDays,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  Mail,
  ShieldOff,
  Copy,
  ListTodo,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TypeBadge, StatusBadge, ProjectStatusBadge } from '@/components/shared/Badges';
import Pagination from '@/components/shared/Pagination';
import PortalChrome, { readIdentity, saveIdentity } from '@/components/portal/PortalChrome';
import RequestForm from '@/components/portal/RequestForm';
import PortalPlan from '@/components/portal/PortalPlan';
import { TICKET_STATUSES } from '@/lib/constants';
import { cn, formatDate, timeAgo, formatDuration } from '@/lib/utils';

export default function Portal() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'requests';
  const [portal, setPortal] = useState(null);
  const [error, setError] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const loadPortal = useCallback(
    () =>
      api
        .getPortal(token)
        .then((res) => setPortal(res.data))
        .catch(() => setError(true)),
    [token]
  );

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (portal) document.title = `${portal.projectName} · ${portal.companyName} client portal`;
  }, [portal]);

  const setView = (v) => {
    setSubmitted(null);
    setParams(v === 'requests' ? {} : { view: v }, { replace: true });
  };

  if (error) {
    return (
      <PortalChrome>
        <Card className="mx-auto max-w-md p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <ShieldOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-display text-lg font-bold">Portal not available</p>
          <p className="mt-2 text-sm text-muted-foreground">This link is invalid or has been turned off by the project team.</p>
        </Card>
      </PortalChrome>
    );
  }

  if (!portal) {
    return (
      <PortalChrome>
        <div className="space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-96" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </PortalChrome>
    );
  }

  const { stats, project, settings } = portal;
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <PortalChrome companyName={portal.companyName}>
      {/* Hero */}
      <div className="mb-8 animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{portal.clientName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{portal.projectName}</h1>
          {project && <ProjectStatusBadge status={project.status} />}
        </div>
        {portal.welcomeMessage ? (
          <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[15px] text-muted-foreground">{portal.welcomeMessage}</p>
        ) : (
          <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">
            Report bugs, request features and follow every request from submission to resolution — all in one place.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PortalStat icon={CircleDot} label="Open requests" value={stats.open} tone="text-sky-600 dark:text-sky-400 bg-sky-500/10" />
        <PortalStat icon={CheckCircle2} label="Resolved" value={stats.done} tone="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" />
        <PortalStat icon={Timer} label="Avg. resolution" value={formatDuration(stats.avgResolutionHours)} tone="text-amber-600 dark:text-amber-400 bg-amber-500/10" />
        {project?.deadline ? (
          <PortalStat icon={CalendarDays} label="Target date" value={formatDate(project.deadline).replace(/, \d{4}$/, '')} tone="text-violet-600 dark:text-violet-400 bg-violet-500/10" />
        ) : (
          <PortalStat icon={Inbox} label="Total requests" value={stats.total} tone="text-violet-600 dark:text-violet-400 bg-violet-500/10" />
        )}
      </div>

      {project && stats.total > 0 && (
        <Card className="mb-8 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm font-semibold">Overall progress</p>
            <p className="text-sm font-bold tabular-nums text-primary">{pct}% of requests resolved</p>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
            {TICKET_STATUSES.map((s) => {
              const n = stats.statuses[s.value] || 0;
              return n ? <div key={s.value} className={cn('h-full', s.dot)} style={{ width: `${(n / stats.total) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {TICKET_STATUSES.filter((s) => stats.statuses[s.value]).map((s) => (
              <span key={s.value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', s.dot)} /> {s.label} <span className="font-semibold text-foreground">{stats.statuses[s.value]}</span>
              </span>
            ))}
          </div>
          {project.liveUrl && (
            <a
              href={project.liveUrl.startsWith('http') ? project.liveUrl : `https://${project.liveUrl}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Visit live site <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm sm:w-fit">
        {[
          { value: 'requests', label: 'Requests', icon: Inbox },
          ...(settings.showTodos ? [{ value: 'plan', label: 'Plan', icon: ListTodo }] : []),
          { value: 'new', label: 'New request', icon: Plus },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setView(t.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none',
              view === t.value ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {view === 'plan' && settings.showTodos ? (
        <PortalPlan token={token} />
      ) : view === 'new' ? (
        submitted ? (
          <SubmittedCard result={submitted} onAnother={() => setSubmitted(null)} onViewAll={() => setView('requests')} />
        ) : (
          <Card className="p-5 sm:p-7 animate-fade-in">
            <h2 className="font-display text-xl font-bold">Submit a new request</h2>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">
              The team is notified instantly. You'll get a tracking link to follow progress and reply.
            </p>
            <RequestForm
              token={token}
              onSubmitted={(r) => {
                setSubmitted(r);
                loadPortal();
              }}
            />
          </Card>
        )
      ) : (
        <RequestList token={token} showAll={settings.showAllTickets} onNew={() => setView('new')} />
      )}
    </PortalChrome>
  );
}

function PortalStat({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-soft backdrop-blur">
      <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function SubmittedCard({ result, onAnother, onViewAll }) {
  const link = `${window.location.origin}/public/ticket/${result.trackingToken}`;
  return (
    <Card className="mx-auto max-w-lg p-8 text-center animate-fade-in">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <h2 className="font-display text-2xl font-bold">Request received!</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your reference is <span className="font-mono font-bold text-foreground">#{result.ticketNumber}</span>. We've emailed you a
        confirmation (if email is set up) — bookmark the tracking link below.
      </p>
      <div className="mt-5 flex gap-2">
        <input readOnly value={link} className="min-w-0 flex-1 rounded-lg border border-input bg-secondary/40 px-3 font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success('Link copied');
          }}
          aria-label="Copy tracking link"
        >
          <Copy />
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="gradient" className="flex-1">
          <Link to={`/public/ticket/${result.trackingToken}`}>
            Track this request <ArrowRight />
          </Link>
        </Button>
        <Button variant="outline" className="flex-1" onClick={onAnother}>
          Submit another
        </Button>
      </div>
      <button onClick={onViewAll} className="mt-4 text-sm font-semibold text-primary hover:underline">
        View all requests
      </button>
    </Card>
  );
}

function RequestList({ token, showAll, onNew }) {
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [identity, setIdentity] = useState(readIdentity);
  const [emailInput, setEmailInput] = useState(identity.email || '');
  const [onlyMine, setOnlyMine] = useState(!showAll);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [status, q, onlyMine, identity.email]);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 10 };
    if (status !== 'all') params.status = status;
    if (q) params.search = q;
    if ((onlyMine || !showAll) && identity.email) params.email = identity.email;
    api
      .getPortalTickets(token, params)
      .then((res) => setData(res.data))
      .catch(() => setData({ items: [], total: 0, totalPages: 1, page: 1, limit: 10 }))
      .finally(() => setLoading(false));
  }, [token, status, q, page, onlyMine, identity.email, showAll]);

  const needsEmail = !showAll && !identity.email;

  const saveEmail = (e) => {
    e.preventDefault();
    const next = { ...identity, email: emailInput.trim().toLowerCase() };
    saveIdentity(next);
    setIdentity(next);
  };

  if (needsEmail) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center animate-fade-in">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="font-display text-xl font-bold">Find your requests</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter the email you used when submitting to see your requests.</p>
        <form onSubmit={saveEmail} className="mt-5 flex gap-2">
          <Input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="you@company.com" />
          <Button type="submit" variant="gradient">
            Continue
          </Button>
        </form>
        <button onClick={onNew} className="mt-4 text-sm font-semibold text-primary hover:underline">
          Or submit a new request
        </button>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          {[
            { v: 'active', l: 'In progress' },
            { v: 'done', l: 'Resolved' },
            { v: 'all', l: 'All' },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setStatus(f.v)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                status === f.v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search or #number" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {showAll && identity.email && (
        <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Only show my requests ({identity.email})
        </label>
      )}
      {!showAll && (
        <p className="mb-3 text-sm text-muted-foreground">
          Showing requests for <span className="font-semibold text-foreground">{identity.email}</span> ·{' '}
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => {
              const next = { ...identity, email: '' };
              saveIdentity(next);
              setIdentity(next);
            }}
          >
            change
          </button>
        </p>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-semibold">No requests here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Something not working, or have an idea? Let the team know.</p>
          <Button variant="gradient" className="mt-5" onClick={onNew}>
            <Plus /> New request
          </Button>
        </Card>
      ) : (
        <>
          <Card className={cn('divide-y divide-border overflow-hidden transition-opacity', loading && 'opacity-60')}>
            {data.items.map((t) => (
              <Link
                key={t.trackingToken}
                to={`/public/ticket/${t.trackingToken}`}
                className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/30 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">#{t.ticketNumber}</span>
                    <p className="truncate font-semibold group-hover:text-primary">{t.title}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <TypeBadge type={t.type} short />
                    {t.submitterName && <span>by {t.submitterName}</span>}
                    <span>· updated {timeAgo(t.updatedAt)}</span>
                    {t.replies > 1 && (
                      <span className="inline-flex items-center gap-1">
                        · <MessageSquare className="h-3 w-3" /> {t.replies - 1}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={t.status} />
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            ))}
          </Card>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
        </>
      )}
      {loading && data && (
        <div className="mt-3 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
