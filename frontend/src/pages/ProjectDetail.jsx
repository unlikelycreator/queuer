import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Github,
  Globe,
  Calendar,
  Ticket as TicketIcon,
  Pencil,
  ListTodo,
  LayoutGrid,
  ExternalLink,
  Copy,
  CircleDot,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProjectStatusBadge, TypeBadge, StatusBadge, PriorityIndicator } from '@/components/shared/Badges';
import { UserAvatar, AvatarStack } from '@/components/shared/UserAvatar';
import { EmptyState, StatTile } from '@/components/shared/Common';
import TicketFormDialog from '@/components/shared/TicketFormDialog';
import ProjectFormDialog from '@/components/shared/ProjectFormDialog';
import PortalShareDialog, { portalUrl } from '@/components/shared/PortalShareDialog';
import ProjectTodos from '@/components/projects/ProjectTodos';
import { ACTIVE_STATUSES, TICKET_STATUSES } from '@/lib/constants';
import { formatDate, timeAgo, cn } from '@/lib/utils';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('active');

  const load = () =>
    api
      .getProject(id)
      .then((res) => setProject(res.data))
      .catch(() => toast.error('Project not found'))
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stats = useMemo(() => {
    const tickets = project?.tickets || [];
    const active = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
    const done = tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length;
    return { total: tickets.length, active, done, pct: tickets.length ? Math.round((done / tickets.length) * 100) : 0 };
  }, [project]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (!project) return null;

  const setTab = (v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true });
  const tickets = (project.tickets || []).filter((t) =>
    ticketFilter === 'active' ? ACTIVE_STATUSES.includes(t.status) : ticketFilter === 'done' ? !ACTIVE_STATUSES.includes(t.status) : true
  );
  const link = portalUrl(project.publicToken);

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/projects')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Projects
      </button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to={`/clients/${project.client?._id}`} className="text-xs font-bold uppercase tracking-[0.14em] text-primary hover:underline">
            {project.client?.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {project.deadline && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Due {formatDate(project.deadline)}
              </span>
            )}
            {project.members?.length > 0 && (
              <span className="flex items-center gap-2">
                <AvatarStack users={project.members} /> {project.members.length} member{project.members.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="outline" onClick={() => setPortalOpen(true)}>
            <Globe /> Client portal
          </Button>
          <Button variant="gradient" onClick={() => setTicketDialogOpen(true)}>
            <Plus /> New ticket
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <TicketIcon className="h-3.5 w-3.5" /> Tickets
            <span className="rounded-full bg-secondary px-1.5 text-[10px] tabular-nums">{stats.active}</span>
          </TabsTrigger>
          <TabsTrigger value="todos" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" /> To-dos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Open tickets" value={stats.active} icon={CircleDot} tone="info" />
            <StatTile label="Resolved" value={stats.done} icon={CheckCircle2} />
            <StatTile label="Completion" value={`${stats.pct}%`} icon={Clock} tone="spark" hint={`${stats.done} of ${stats.total} tickets`} />
            <StatTile label="Started" value={project.startDate ? formatDate(project.startDate).replace(/, \d{4}$/, '') : '—'} icon={Calendar} tone="warn" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">About this project</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {project.description || 'No description yet.'}
                </p>
                {project.techStack?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.techStack.map((t) => (
                      <span key={t} className="rounded-md border border-border bg-secondary/60 px-2 py-1 font-mono text-[11px] font-semibold">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {project.repoUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={project.repoUrl.startsWith('http') ? project.repoUrl : `https://${project.repoUrl}`} target="_blank" rel="noreferrer">
                        <Github /> Repository
                      </a>
                    </Button>
                  )}
                  {project.liveUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={project.liveUrl.startsWith('http') ? project.liveUrl : `https://${project.liveUrl}`} target="_blank" rel="noreferrer">
                        <Globe /> Live site
                      </a>
                    </Button>
                  )}
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted-foreground">
                    <span>Ticket progress</span>
                    <span className="tabular-nums">{stats.pct}%</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
                    {TICKET_STATUSES.map((s) => {
                      const n = (project.tickets || []).filter((t) => t.status === s.value).length;
                      return n ? <div key={s.value} className={cn(s.dot, 'h-full')} style={{ width: `${(n / stats.total) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="overflow-hidden">
                <div className="relative bg-sidebar p-5 text-white">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/30 blur-2xl" />
                  <p className="relative flex items-center gap-2 text-sm font-bold">
                    <Globe className="h-4 w-4 text-spark" /> Client portal
                  </p>
                  <p className="relative mt-1 text-xs text-white/70">
                    {project.publicFormEnabled === false
                      ? 'Disabled — clients cannot access it.'
                      : 'Your client submits & tracks requests here.'}
                  </p>
                </div>
                <div className="flex gap-2 p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(link);
                      toast.success('Portal link copied');
                    }}
                  >
                    <Copy /> Copy link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={link} target="_blank" rel="noreferrer">
                      <ExternalLink />
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPortalOpen(true)}>
                    Manage
                  </Button>
                </div>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Team</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.members?.length ? (
                    <div className="space-y-3">
                      {project.members.map((m) => (
                        <div key={m._id} className="flex items-center gap-2.5">
                          <UserAvatar user={m} size="sm" />
                          <span className="text-sm font-medium">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <div className="mb-3 flex gap-1">
            {[
              { v: 'active', l: 'Active' },
              { v: 'done', l: 'Resolved & closed' },
              { v: 'all', l: 'All' },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setTicketFilter(f.v)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  ticketFilter === f.v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                {f.l}
              </button>
            ))}
            <Link to={`/tickets?project=${project._id}&status=all`} className="ml-auto self-center text-xs font-semibold text-primary hover:underline">
              Open in inbox →
            </Link>
          </div>
          {tickets.length === 0 ? (
            <EmptyState
              compact
              icon={TicketIcon}
              title="No tickets here"
              description="Log a bug, feature request or support ticket for this project."
              action={
                <Button variant="gradient" onClick={() => setTicketDialogOpen(true)}>
                  <Plus /> New ticket
                </Button>
              }
            />
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {tickets.map((t) => (
                <Link key={t._id} to={`/tickets/${t._id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30">
                  <span className="w-12 shrink-0 font-mono text-xs font-semibold text-muted-foreground">#{t.ticketNumber}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold group-hover:text-primary">{t.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <TypeBadge type={t.type} short />
                      <span className="text-xs text-muted-foreground">{timeAgo(t.createdAt)}</span>
                    </div>
                  </div>
                  <PriorityIndicator priority={t.priority} className="hidden sm:inline-flex" />
                  <StatusBadge status={t.status} />
                  <UserAvatar user={t.assignedTo} size="sm" />
                </Link>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="todos">
          <ProjectTodos projectId={project._id} />
        </TabsContent>
      </Tabs>

      <TicketFormDialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen} defaultProjectId={project._id} lockProject onSaved={load} />
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} editing={project} onSaved={load} />
      <PortalShareDialog open={portalOpen} onOpenChange={setPortalOpen} project={project} onChanged={load} />
    </div>
  );
}
