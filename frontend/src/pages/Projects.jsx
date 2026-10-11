import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, FolderKanban, Ticket, MoreVertical, Pencil, Trash2, Calendar, ListTodo } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader, EmptyState, ConfirmDialog } from '@/components/shared/Common';
import { ProjectStatusBadge } from '@/components/shared/Badges';
import ProjectFormDialog from '@/components/shared/ProjectFormDialog';
import Pagination from '@/components/shared/Pagination';
import ViewToggle from '@/components/shared/ViewToggle';
import { PROJECT_STATUSES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

const LIMIT = 12;

export default function Projects() {
  const { terms } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: LIMIT });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('grid');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    const params = { page, limit: LIMIT };
    if (search) params.search = search;
    if (statusFilter !== 'all') params.status = statusFilter;
    api
      .getProjects(params)
      .then((res) => {
        setProjects(res.data.items);
        setMeta(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProject(deleteTarget._id);
      toast.success('Project removed');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Delivery" title={terms.projects} description="Track every project you're building for your clients">
        <Button
          variant="gradient"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search projects..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Create your first project to start tracking tickets and features."
          action={
            <Button variant="gradient" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Project
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project._id} className="card-hover group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/projects/${project._id}`} className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary truncate">{project.client?.name}</p>
                    <p className="mt-0.5 font-display text-[17px] font-semibold truncate group-hover:text-primary">{project.name}</p>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-secondary outline-none shrink-0">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(project);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(project)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                  {project.description || 'No description provided'}
                </p>

                {project.techStack?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {project.techStack.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {project.totalTickets > 0 && (
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Tickets resolved</span>
                      <span className="tabular-nums">
                        {project.totalTickets - project.openTickets}/{project.totalTickets}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
                        style={{ width: `${((project.totalTickets - project.openTickets) / project.totalTickets) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <ProjectStatusBadge status={project.status} />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {project.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {formatDate(project.deadline)}
                      </span>
                    )}
                    <span className="flex items-center gap-1" title="Open tickets">
                      <Ticket className="h-3.5 w-3.5" /> {project.openTickets}
                    </span>
                    {project.totalTodos > 0 && (
                      <Link
                        to={`/projects/${project._id}?tab=todos`}
                        className="flex items-center gap-1 hover:text-primary"
                        title="To-dos done"
                      >
                        <ListTodo className="h-3.5 w-3.5" /> {project.doneTodos}/{project.totalTodos}
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-center">Tickets</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project._id}>
                <TableCell>
                  <Link to={`/projects/${project._id}`} className="font-medium hover:text-primary">
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{project.client?.name || '—'}</TableCell>
                <TableCell><ProjectStatusBadge status={project.status} /></TableCell>
                <TableCell className="text-muted-foreground">{project.deadline ? formatDate(project.deadline) : '—'}</TableCell>
                <TableCell className="text-center">{project.openTickets}/{project.totalTickets}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-secondary outline-none">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(project);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(project)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />

      <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete this project?"
        description={`This will permanently delete "${deleteTarget?.name}" and all of its tickets.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
