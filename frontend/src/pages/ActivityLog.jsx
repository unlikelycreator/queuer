import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { History, Ticket, FolderKanban, Users2, Receipt, Clock, Zap, Settings2, ListTodo, UserCog, Bot } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PageHeader, EmptyState } from '@/components/shared/Common';
import { UserAvatar } from '@/components/shared/UserAvatar';
import Pagination from '@/components/shared/Pagination';
import { cn, timeAgo, formatDateTime, dayKey, friendlyDay } from '@/lib/utils';

const ENTITY = {
  ticket: { icon: Ticket, tone: 'text-sky-600 dark:text-sky-400' },
  project: { icon: FolderKanban, tone: 'text-emerald-600 dark:text-emerald-400' },
  client: { icon: Users2, tone: 'text-teal-600 dark:text-teal-400' },
  invoice: { icon: Receipt, tone: 'text-violet-600 dark:text-violet-400' },
  time: { icon: Clock, tone: 'text-amber-600 dark:text-amber-400' },
  automation: { icon: Zap, tone: 'text-lime-700 dark:text-spark' },
  workspace: { icon: Settings2, tone: 'text-slate-500' },
  todo: { icon: ListTodo, tone: 'text-emerald-600' },
  user: { icon: UserCog, tone: 'text-slate-500' },
};

/** Full audit trail of the workspace — who did what, when. */
export default function ActivityLog() {
  const { terms } = useWorkspace();
  const [type, setType] = useState('all');
  const [actor, setActor] = useState('all');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getUsers().then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => setPage(1), [type, actor]);

  useEffect(() => {
    const params = { page, limit: 40 };
    if (type !== 'all') params.entityType = type;
    if (actor !== 'all') params.actor = actor;
    api
      .getActivity(params)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load activity'));
  }, [type, actor, page]);

  // Group by calendar day for readability.
  const groups = [];
  (data?.items || []).forEach((a) => {
    const k = dayKey(new Date(a.createdAt));
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, items: [] });
    groups[groups.length - 1].items.push(a);
  });

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Audit" title="Activity log" description="Every change across the workspace — by people, clients, automations and the SLA monitor." />
      <div className="flex flex-wrap gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            <SelectItem value="ticket">{terms.tickets}</SelectItem>
            <SelectItem value="project">{terms.projects}</SelectItem>
            <SelectItem value="client">{terms.clients}</SelectItem>
            <SelectItem value="time">Time</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
            <SelectItem value="automation">Automations</SelectItem>
            <SelectItem value="workspace">Settings</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {users.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : !data.items.length ? (
        <EmptyState icon={History} title="Nothing yet" description="Activity appears here as your team works." />
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{friendlyDay(g.key)}</p>
              <Card className="divide-y divide-border">
                {g.items.map((a) => {
                  const meta = ENTITY[a.entityType] || ENTITY.workspace;
                  const isPerson = !!a.actor;
                  return (
                    <div key={a._id} className="flex items-center gap-3 px-4 py-3">
                      {isPerson ? (
                        <UserAvatar user={a.actor} size="sm" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
                          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      )}
                      <p className="min-w-0 flex-1 text-sm">
                        <span className="font-semibold">{a.actor?.name || a.actorName}</span>{' '}
                        {a.link ? (
                          <Link to={a.link} className="text-muted-foreground hover:text-foreground">
                            {a.summary}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{a.summary}</span>
                        )}
                      </p>
                      <meta.icon className={cn('h-4 w-4 shrink-0', meta.tone)} />
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
