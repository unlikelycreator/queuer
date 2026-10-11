import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Ticket as TicketIcon,
  LayoutList,
  Columns3,
  UserRound,
  UserX,
  MessageCircleWarning,
  CalendarX2,
  X,
  ArrowDownUp,
  SlidersHorizontal,
  CalendarClock,
  MessageSquare,
  ListChecks,
  Clock,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PageHeader, EmptyState } from '@/components/shared/Common';
import { TypeBadge, StatusBadge, PriorityIndicator, SourceIcon, SlaBadge } from '@/components/shared/Badges';
import { useWorkspace } from '@/context/WorkspaceContext';
import { UserAvatar } from '@/components/shared/UserAvatar';
import TicketFormDialog from '@/components/shared/TicketFormDialog';
import Pagination from '@/components/shared/Pagination';
import { TICKET_TYPES, TICKET_STATUSES, TICKET_PRIORITIES, findMeta } from '@/lib/constants';
import { cn, timeAgo, formatDate, isOverdue, apiError, formatMinutes } from '@/lib/utils';

const LIMIT = 20;

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  ...TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label, dot: s.dot })),
  { value: 'all', label: 'All' },
];

const QUICK_VIEWS = [
  { key: 'mine', label: 'Assigned to me', icon: UserRound, param: { assignedTo: 'me' } },
  { key: 'unassigned', label: 'Unassigned', icon: UserX, param: { assignedTo: 'unassigned' } },
  { key: 'awaiting', label: 'Awaiting reply', icon: MessageCircleWarning, param: { view: 'awaiting' } },
  { key: 'overdue', label: 'Overdue', icon: CalendarX2, param: { view: 'overdue' } },
];

const SORTS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'due', label: 'Due date' },
];

export default function Tickets() {
  const navigate = useNavigate();
  const { terms } = useWorkspace();
  const [params, setParams] = useSearchParams();

  // All filter state lives in the URL so views are shareable and survive refresh.
  const status = params.get('status') || 'active';
  const quick = params.get('quick') || '';
  const search = params.get('q') || '';
  const type = params.get('type') || 'all';
  const priority = params.get('priority') || 'all';
  const project = params.get('project') || 'all';
  const sort = params.get('sort') || 'updated';
  const mode = params.get('mode') || 'list';
  const page = Number(params.get('page')) || 1;

  const [searchInput, setSearchInput] = useState(search);
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: LIMIT });
  const [counts, setCounts] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');
  const [selected, setSelected] = useState(new Set());
  const [showFilters, setShowFilters] = useState(type !== 'all' || priority !== 'all' || project !== 'all');

  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '' || v === 'all' || (k === 'status' && v === 'active')) next.delete(k);
        else next.set(k, v);
      });
      if (resetPage && !('page' in patch)) next.delete('page');
      next.delete('new');
      next.delete('open');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  // The global "New ticket" button links to ?new=1 — open the dialog even if we're already here.
  useEffect(() => {
    if (params.get('new') === '1') setCreateOpen(true);
  }, [params]);

  // Back-compat: old links used /tickets?open=<id>.
  useEffect(() => {
    const legacy = params.get('open');
    if (legacy) navigate(`/tickets/${legacy}`, { replace: true });
  }, [params, navigate]);

  useEffect(() => {
    const t = setTimeout(() => searchInput !== search && update({ q: searchInput }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    Promise.all([api.getProjects({ limit: 200 }), api.getUsers()])
      .then(([p, u]) => {
        setProjects(p.data.items || []);
        setUsers(u.data || []);
      })
      .catch(() => {});
  }, []);

  const queryParams = useMemo(() => {
    const qp = { sort };
    if (search) qp.search = search;
    if (type !== 'all') qp.type = type;
    if (priority !== 'all') qp.priority = priority;
    if (project !== 'all') qp.project = project;
    const qv = QUICK_VIEWS.find((v) => v.key === quick);
    if (qv) Object.assign(qp, qv.param);
    return qp;
  }, [search, type, priority, project, sort, quick]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const listParams = { ...queryParams };
      if (mode === 'board') {
        listParams.limit = 200;
      } else {
        listParams.page = page;
        listParams.limit = LIMIT;
        if (status !== 'all') listParams.status = status;
      }
      const [list, c] = await Promise.all([api.getTickets(listParams), api.getTicketCounts(queryParams)]);
      setTickets(Array.isArray(list.data?.items) ? list.data.items : []);
      setMeta({
        page: list.data?.page || 1,
        totalPages: list.data?.totalPages || 1,
        total: list.data?.total || 0,
        limit: list.data?.limit || LIMIT,
      });
      setCounts(c.data);
    } catch (err) {
      toast.error(apiError(err, 'Failed to load tickets'));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams, status, page, mode]);

  useEffect(() => {
    load();
    setSelected(new Set());
  }, [load]);

  const countFor = (value) => {
    if (!counts) return null;
    if (value === 'active') return counts.active;
    if (value === 'all') return counts.all;
    return counts.statuses?.[value] ?? 0;
  };

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = tickets.length > 0 && tickets.every((t) => selected.has(t._id));

  const bulk = async (patch) => {
    try {
      const res = await api.bulkUpdateTickets({ ids: [...selected], ...patch });
      toast.success(`Updated ${res.data.updated} ticket${res.data.updated === 1 ? '' : 's'}`);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(apiError(err, 'Bulk update failed'));
    }
  };

  const moveTicket = async (ticket, newStatus) => {
    if (ticket.status === newStatus) return;
    setTickets((prev) => prev.map((t) => (t._id === ticket._id ? { ...t, status: newStatus } : t)));
    try {
      await api.updateTicket(ticket._id, { status: newStatus });
      toast.success(`#${ticket.ticketNumber} → ${findMeta(TICKET_STATUSES, newStatus).label}`);
      api.getTicketCounts(queryParams).then((c) => setCounts(c.data));
    } catch (err) {
      toast.error(apiError(err, 'Could not move ticket'));
      load();
    }
  };

  const filtersActive = type !== 'all' || priority !== 'all' || project !== 'all' || !!search || !!quick;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Support"
        title={terms.tickets}
        description={`Every ${terms.ticket.toLowerCase()} across your ${terms.clients.toLowerCase()} — in one inbox.`}
      >
        <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
          {[
            { value: 'list', icon: LayoutList, label: 'List' },
            { value: 'board', icon: Columns3, label: 'Board' },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => update({ mode: m.value === 'list' ? '' : m.value })}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                mode === m.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <m.icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          ))}
        </div>
        <Button variant="gradient" onClick={() => setCreateOpen(true)}>
          <Plus /> New {terms.ticket.toLowerCase()}
        </Button>
      </PageHeader>

      {/* Status tabs */}
      {mode === 'list' && (
        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            const n = countFor(tab.value);
            return (
              <button
                key={tab.value}
                onClick={() => update({ status: tab.value })}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-all',
                  active
                    ? 'border-primary/30 bg-accent text-accent-foreground shadow-soft'
                    : 'border-transparent text-muted-foreground hover:bg-card hover:text-foreground'
                )}
              >
                {tab.dot && <span className={cn('h-2 w-2 rounded-full', tab.dot)} />}
                {tab.label}
                {n !== null && (
                  <span
                    className={cn(
                      'min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums',
                      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Search, quick views, filters */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, email, tag or #number…"
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-1.5 xl:flex-nowrap">
            {QUICK_VIEWS.map((v) => {
              const active = quick === v.key;
              const n = counts?.views?.[v.key];
              return (
                <button
                  key={v.key}
                  onClick={() => update({ quick: active ? '' : v.key })}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  <v.icon className="h-3.5 w-3.5" />
                  {v.label}
                  {n > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[10px] tabular-nums',
                        active ? 'bg-white/20' : v.key === 'overdue' || v.key === 'awaiting' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : 'bg-secondary'
                      )}
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal /> Filters
            </Button>
            <Select value={sort} onValueChange={(v) => update({ sort: v === 'updated' ? '' : v })}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <ArrowDownUp className="mr-1 h-3.5 w-3.5 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-2 animate-fade-in">
            <FilterSelect value={type} onChange={(v) => update({ type: v })} placeholder="All types" items={TICKET_TYPES} />
            <FilterSelect value={priority} onChange={(v) => update({ priority: v })} placeholder="All priorities" items={TICKET_PRIORITIES} />
            <FilterSelect
              value={project}
              onChange={(v) => update({ project: v })}
              placeholder="All projects"
              items={projects.map((p) => ({ value: p._id, label: p.name }))}
              width="w-52"
            />
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  update({ type: '', priority: '', project: '', q: '', quick: '' });
                }}
              >
                <X /> Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && mode === 'list' && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card p-2 pl-4 shadow-soft-lg animate-fade-in">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="mx-1 h-5 w-px bg-border" />
          <BulkSelect placeholder="Set status" items={TICKET_STATUSES} onChange={(v) => bulk({ status: v })} />
          <BulkSelect placeholder="Set priority" items={TICKET_PRIORITIES} onChange={(v) => bulk({ priority: v })} />
          <BulkSelect
            placeholder="Assign to"
            items={[{ value: 'unassigned', label: 'Unassigned' }, ...users.map((u) => ({ value: u._id, label: u.name }))]}
            onChange={(v) => bulk({ assignedTo: v })}
          />
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X /> Clear
          </Button>
        </div>
      )}

      {loading ? (
        mode === 'board' ? (
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[60vh] w-72 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-12" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </Card>
        )
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={filtersActive ? 'No tickets match these filters' : 'Inbox zero 🎉'}
          description={
            filtersActive
              ? 'Try clearing a filter or searching for something else.'
              : 'No tickets here. New requests from your client portal and support inbox will land here.'
          }
          action={
            <Button variant="gradient" onClick={() => setCreateOpen(true)}>
              <Plus /> New ticket
            </Button>
          }
        />
      ) : mode === 'board' ? (
        <TicketBoard tickets={tickets} onOpen={(t) => navigate(`/tickets/${t._id}`)} onMove={moveTicket} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="hidden items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:flex">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => setSelected(v ? new Set(tickets.map((t) => t._id)) : new Set())}
                aria-label="Select all"
              />
              <span className="w-16">ID</span>
              <span className="flex-1">Ticket</span>
              <span className="w-24">Priority</span>
              <span className="w-28">Status</span>
              <span className="w-24">Due</span>
              <span className="w-8" />
              <span className="w-16 text-right">Updated</span>
            </div>
            <div className="divide-y divide-border">
              {tickets.map((t) => (
                <TicketRow
                  key={t._id}
                  ticket={t}
                  selected={selected.has(t._id)}
                  onSelect={() => toggleSelect(t._id)}
                  onOpen={() => navigate(`/tickets/${t._id}`)}
                />
              ))}
            </div>
          </Card>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={(p) => update({ page: p > 1 ? String(p) : '' }, { resetPage: false })}
          />
        </>
      )}

      <TicketFormDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v && params.get('new')) update({}, { resetPage: false });
        }}
        defaultProjectId={project !== 'all' ? project : undefined}
        onSaved={(t) => (t?._id ? navigate(`/tickets/${t._id}`) : load())}
      />
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, items, width = 'w-40' }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('h-8 text-xs', width, value !== 'all' && 'border-primary/40 bg-accent/40')}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BulkSelect({ placeholder, items, onChange }) {
  return (
    <Select value="" onValueChange={onChange}>
      <SelectTrigger className="h-8 w-36 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TicketRow({ ticket: t, selected, onSelect, onOpen }) {
  const overdue = isOverdue(t.dueDate, t.status);
  const requester = t.submitterName || t.reportedBy?.name;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={cn(
        'group flex cursor-pointer items-start gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-accent/30 focus-visible:bg-accent/40 md:items-center',
        selected && 'bg-accent/40'
      )}
    >
      <div onClick={(e) => e.stopPropagation()} className="pt-0.5 md:pt-0">
        <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Select ticket ${t.ticketNumber}`} />
      </div>
      <span className="hidden w-16 shrink-0 font-mono text-xs font-semibold text-muted-foreground md:block">
        #{t.ticketNumber}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {t.awaitingTeamReply && (
            <span className="relative flex h-2 w-2 shrink-0" title="Client is waiting for a reply">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
          )}
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{t.title}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono md:hidden">#{t.ticketNumber}</span>
          <TypeBadge type={t.type} short />
          <span className="truncate">{t.project?.name}</span>
          <span className="opacity-40">·</span>
          <span className="truncate">{t.client?.name}</span>
          {requester && (
            <>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1 truncate">
                <SourceIcon source={t.source} className="h-3 w-3" />
                {requester}
              </span>
            </>
          )}
          {t.checklist?.length > 0 && (
            <span className="inline-flex items-center gap-1" title="Checklist">
              <ListChecks className="h-3 w-3" /> {t.checklist.filter((c) => c.done).length}/{t.checklist.length}
            </span>
          )}
          {t.timeSpentMinutes > 0 && (
            <span className="inline-flex items-center gap-1" title="Time logged">
              <Clock className="h-3 w-3" /> {formatMinutes(t.timeSpentMinutes)}
            </span>
          )}
          <SlaBadge ticket={t} />
          {t.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded bg-secondary px-1.5 py-px text-[10px] font-semibold">
              {tag}
            </span>
          ))}
          <span className="md:hidden">
            <StatusBadge status={t.status} />
          </span>
        </div>
      </div>
      <div className="hidden w-24 shrink-0 md:block">
        <PriorityIndicator priority={t.priority} />
      </div>
      <div className="hidden w-28 shrink-0 md:block">
        <StatusBadge status={t.status} />
      </div>
      <div className="hidden w-24 shrink-0 text-xs md:block">
        {t.dueDate ? (
          <span className={cn('inline-flex items-center gap-1', overdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(t.dueDate).replace(/, \d{4}$/, '')}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>
      <div className="w-8 shrink-0">
        <UserAvatar user={t.assignedTo} size="sm" />
      </div>
      <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground md:block">
        {timeAgo(t.lastActivityAt || t.updatedAt || t.createdAt)}
      </span>
    </div>
  );
}

const BOARD_COLUMNS = ['open', 'in_progress', 'in_review', 'reopened', 'resolved', 'closed'];

function TicketBoard({ tickets, onOpen, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {BOARD_COLUMNS.map((col) => {
        const meta = findMeta(TICKET_STATUSES, col);
        const items = tickets.filter((t) => t.status === col);
        return (
          <div
            key={col}
            data-column={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const t = tickets.find((x) => x._id === dragId);
              if (t) onMove(t, col);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn(
              'flex max-h-[calc(100vh-280px)] min-h-[300px] w-[280px] shrink-0 flex-col rounded-xl border bg-secondary/40 transition-colors',
              overCol === col ? 'border-primary/50 bg-accent/50' : 'border-border/70'
            )}
          >
            <div className="flex items-center gap-2 px-3 py-3">
              <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
              <span className="text-sm font-bold">{meta.label}</span>
              <span className="ml-auto rounded-full bg-card px-2 text-xs font-semibold tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2 scrollbar-thin">
              {items.map((t) => (
                <div
                  key={t._id}
                  draggable
                  onDragStart={() => setDragId(t._id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen(t)}
                  className={cn(
                    'cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-soft active:cursor-grabbing',
                    dragId === t._id && 'opacity-40'
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">#{t.ticketNumber}</span>
                    <PriorityIndicator priority={t.priority} showLabel={false} />
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{t.project?.name}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <TypeBadge type={t.type} short />
                    <div className="flex items-center gap-2">
                      {t.awaitingTeamReply && <MessageSquare className="h-3.5 w-3.5 text-rose-500" />}
                      {t.dueDate && (
                        <span className={cn('text-[11px]', isOverdue(t.dueDate, t.status) ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                          {formatDate(t.dueDate).replace(/, \d{4}$/, '')}
                        </span>
                      )}
                      <UserAvatar user={t.assignedTo} size="xs" />
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  Drop tickets here
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
