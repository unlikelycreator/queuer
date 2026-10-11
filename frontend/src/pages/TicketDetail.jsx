import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Trash2,
  Link2,
  Lock,
  Globe,
  Mail,
  MailCheck,
  Send,
  Pencil,
  Check,
  X,
  Clock,
  CalendarPlus,
  ExternalLink,
  FolderKanban,
  Building2,
  UserRound,
  CircleDot,
  MoreHorizontal,
  Loader2,
  Tag as TagIcon,
  MessageCircleWarning,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TypeBadge, StatusBadge, PriorityBadge, SourceLabel, SlaBadge } from '@/components/shared/Badges';
import { CustomFieldsCard, ChecklistCard, TimeCard, BillingCard, CsatCard, SavedReplyPicker } from '@/components/tickets/TicketExtras';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ConfirmDialog, EmptyState } from '@/components/shared/Common';
import { AttachButton, PendingFiles, AttachmentGrid } from '@/components/shared/FileChips';
import useUploader from '@/lib/useUploader';
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_TYPES, findMeta } from '@/lib/constants';
import { cn, formatDateTime, timeAgo, isOverdue, apiError, dayKey, formatDuration } from '@/lib/utils';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    Promise.all([api.getTicket(id), api.getUsers()])
      .then(([t, u]) => {
        setTicket(t.data);
        setUsers(u.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const patch = async (data, successMsg) => {
    try {
      const res = await api.updateTicket(ticket._id, data);
      setTicket(res.data);
      if (successMsg) toast.success(successMsg);
    } catch (err) {
      toast.error(apiError(err, 'Update failed'));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteTicket(ticket._id);
      toast.success('Ticket deleted');
      navigate('/tickets');
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete'));
      setDeleting(false);
    }
  };

  const trackingUrl = ticket ? `${window.location.origin}/public/ticket/${ticket.publicToken}` : '';

  const addToToday = async () => {
    try {
      await api.createTodo(ticket.project._id, {
        title: `#${ticket.ticketNumber} ${ticket.title}`.slice(0, 300),
        date: dayKey(),
        priority: ticket.priority === 'critical' || ticket.priority === 'high' ? 'high' : 'medium',
        ticket: ticket._id,
        assignedTo: ticket.assignedTo?._id,
      });
      toast.success("Added to today's project to-dos");
    } catch (err) {
      toast.error(apiError(err, 'Could not add to-do'));
    }
  };

  if (loading) return <DetailSkeleton />;
  if (notFound || !ticket)
    return (
      <EmptyState
        icon={CircleDot}
        title="Ticket not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button asChild variant="outline">
            <Link to="/tickets">Back to tickets</Link>
          </Button>
        }
      />
    );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/tickets'))}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tickets
        </button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-bold">#{ticket.ticketNumber}</span>
              <TypeBadge type={ticket.type} />
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <SlaBadge ticket={ticket} />
              {ticket.awaitingTeamReply && (
                <Badge variant="danger">
                  <MessageCircleWarning className="h-3 w-3" /> Client waiting for reply
                </Badge>
              )}
            </div>
            <EditableTitle value={ticket.title} onSave={(title) => patch({ title }, 'Title updated')} />
            <p className="mt-1.5 text-sm text-muted-foreground">
              Opened {timeAgo(ticket.createdAt)} by{' '}
              <span className="font-medium text-foreground">
                {ticket.reportedBy?.name || ticket.submitterName || 'external submitter'}
              </span>{' '}
              in{' '}
              <Link to={`/projects/${ticket.project?._id}`} className="font-medium text-primary hover:underline">
                {ticket.project?.name}
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusQuickActions ticket={ticket} onChange={(status) => patch({ status }, `Marked ${findMeta(TICKET_STATUSES, status).label}`)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(trackingUrl);
                    toast.success('Client tracking link copied');
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" /> Copy client link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(trackingUrl, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" /> View as client
                </DropdownMenuItem>
                <DropdownMenuItem onClick={addToToday}>
                  <CalendarPlus className="mr-2 h-4 w-4" /> Add to today's to-dos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete ticket
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Conversation */}
        <div className="min-w-0 space-y-5">
          <Description ticket={ticket} onSave={(description) => patch({ description }, 'Description updated')} />
          <ChecklistCard ticket={ticket} onUpdated={setTicket} />
          <Timeline ticket={ticket} />
          <Composer ticket={ticket} onUpdated={setTicket} />
        </div>

        {/* Properties */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="divide-y divide-border">
            <PropRow label="Status">
              <InlineSelect
                value={ticket.status}
                items={TICKET_STATUSES}
                onChange={(v) => patch({ status: v }, 'Status updated')}
                render={(v) => <StatusBadge status={v} />}
              />
            </PropRow>
            <PropRow label="Priority">
              <InlineSelect
                value={ticket.priority}
                items={TICKET_PRIORITIES}
                onChange={(v) => patch({ priority: v }, 'Priority updated')}
                render={(v) => <PriorityBadge priority={v} />}
              />
            </PropRow>
            <PropRow label="Type">
              <InlineSelect
                value={ticket.type}
                items={TICKET_TYPES}
                onChange={(v) => patch({ type: v }, 'Type updated')}
                render={(v) => <TypeBadge type={v} />}
              />
            </PropRow>
            <PropRow label="Assignee">
              <InlineSelect
                value={ticket.assignedTo?._id || 'unassigned'}
                items={[{ value: 'unassigned', label: 'Unassigned' }, ...users.map((u) => ({ value: u._id, label: u.name }))]}
                onChange={(v) => patch({ assignedTo: v === 'unassigned' ? null : v }, 'Assignee updated')}
                render={() => (
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <UserAvatar user={ticket.assignedTo} size="xs" />
                    <span className="truncate">{ticket.assignedTo?.name || <span className="text-muted-foreground">Unassigned</span>}</span>
                  </span>
                )}
              />
            </PropRow>
            <PropRow label="Due date">
              <Input
                type="date"
                className={cn(
                  'h-8 w-[150px] text-xs',
                  isOverdue(ticket.dueDate, ticket.status) && 'border-rose-500/50 text-rose-600 dark:text-rose-400'
                )}
                value={ticket.dueDate ? ticket.dueDate.slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value || null }, 'Due date updated')}
              />
            </PropRow>
            <div className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <TagIcon className="h-3 w-3" /> Tags
              </p>
              <TagEditor tags={ticket.tags || []} onChange={(tags) => patch({ tags })} />
            </div>
          </Card>

          <CustomFieldsCard ticket={ticket} onPatch={patch} />
          <TimeCard ticket={ticket} onChanged={() => api.getTicket(ticket._id).then((r) => setTicket(r.data)).catch(() => {})} />
          <BillingCard ticket={ticket} onPatch={patch} />
          <CsatCard csat={ticket.csat} />

          <Card className="space-y-3 p-4 text-sm">
            <DetailLine icon={FolderKanban} label="Project">
              <Link to={`/projects/${ticket.project?._id}`} className="font-medium text-primary hover:underline">
                {ticket.project?.name}
              </Link>
            </DetailLine>
            <DetailLine icon={Building2} label="Client">
              <Link to={`/clients/${ticket.client?._id}`} className="font-medium hover:underline">
                {ticket.client?.name}
              </Link>
            </DetailLine>
            {(ticket.submitterName || ticket.submitterEmail) && (
              <DetailLine icon={UserRound} label="Requester">
                <div className="min-w-0 text-right">
                  <p className="truncate font-medium">{ticket.submitterName}</p>
                  {ticket.submitterEmail && (
                    <a href={`mailto:${ticket.submitterEmail}`} className="block truncate text-xs text-muted-foreground hover:text-primary">
                      {ticket.submitterEmail}
                    </a>
                  )}
                </div>
              </DetailLine>
            )}
            <DetailLine icon={Globe} label="Source">
              <SourceLabel source={ticket.source} />
            </DetailLine>
            <DetailLine icon={Clock} label="Created">
              <span className="text-muted-foreground">{formatDateTime(ticket.createdAt)}</span>
            </DetailLine>
            {ticket.firstResponseAt && (
              <DetailLine icon={MessageCircleWarning} label="First reply">
                <span className={cn('text-muted-foreground', ticket.slaResponseBreached && 'font-semibold text-rose-600 dark:text-rose-400')}>
                  {formatDuration((new Date(ticket.firstResponseAt) - new Date(ticket.createdAt)) / 36e5 < 1 ? 0 : Math.round((new Date(ticket.firstResponseAt) - new Date(ticket.createdAt)) / 36e5))} after opening
                </span>
              </DetailLine>
            )}
            {ticket.resolvedAt && (
              <DetailLine icon={Check} label="Resolved">
                <span className="text-muted-foreground">{formatDateTime(ticket.resolvedAt)}</span>
              </DetailLine>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="bg-brand p-4 text-white">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Globe className="h-4 w-4" /> Client view
              </p>
              <p className="mt-1 text-xs text-white/80">
                The client can track status and reply here. Internal notes are never shown.
              </p>
            </div>
            <div className="flex gap-2 p-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(trackingUrl);
                  toast.success('Link copied');
                }}
              >
                <Link2 /> Copy link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={trackingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open
                </a>
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ticket #${ticket.ticketNumber}?`}
        description="This permanently removes the ticket and its full conversation history."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

// One-click "next step" buttons so the common transitions are obvious.
function StatusQuickActions({ ticket, onChange }) {
  const s = ticket.status;
  if (s === 'resolved' || s === 'closed')
    return (
      <Button variant="outline" onClick={() => onChange('reopened')}>
        Reopen
      </Button>
    );
  return (
    <>
      {s !== 'in_progress' && (
        <Button variant="outline" onClick={() => onChange('in_progress')} className="hidden sm:inline-flex">
          Start work
        </Button>
      )}
      <Button variant="gradient" onClick={() => onChange('resolved')}>
        <Check /> Mark resolved
      </Button>
    </>
  );
}

function EditableTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editing)
    return (
      <h1
        onClick={() => setEditing(true)}
        title="Click to edit"
        className="group cursor-text font-display text-2xl font-bold leading-tight tracking-tight sm:text-[28px]"
      >
        {value}
        <Pencil className="ml-2 inline h-4 w-4 opacity-0 transition-opacity group-hover:opacity-40" />
      </h1>
    );
  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    else setDraft(value);
  };
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="h-auto py-1.5 font-display text-2xl font-bold"
    />
  );
}

function Description({ ticket, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ticket.description);
  useEffect(() => setDraft(ticket.description), [ticket.description]);
  const fromClient = ticket.source !== 'internal';
  const author = ticket.reportedBy || { name: ticket.submitterName || 'Client' };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-secondary/30 px-5 py-3">
        <UserAvatar user={ticket.reportedBy || { name: author.name, avatarColor: '#0f766e' }} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {author.name}
            {fromClient && (
              <Badge variant="lime" className="ml-2 align-middle">
                Client
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(ticket.createdAt)}</p>
        </div>
        {!editing && (
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Edit description">
            <Pencil />
          </Button>
        )}
      </div>
      <div className="p-5">
        {editing ? (
          <div className="space-y-2">
            <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(ticket.description);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/90">{ticket.description}</p>
        )}
        <AttachmentGrid
          files={[...(ticket.files || []).filter((f) => !isInUpdates(ticket, f)), ...(ticket.attachmentUrls || []).map((u) => ({ url: u, originalName: u.split('/').pop() }))]}
          className="mt-4"
        />
      </div>
    </Card>
  );
}

// Files posted with a specific update are shown inline in the timeline instead.
function isInUpdates(ticket, file) {
  return (ticket.updates || []).some((u) => (u.files || []).some((f) => f.url === file.url));
}

function Timeline({ ticket }) {
  const items = useMemo(() => (ticket.updates || []).filter((u, i) => !(i === 0 && /^(Ticket created|Submitted via|Auto-created)/.test(u.message))), [ticket.updates]);
  if (!items.length)
    return (
      <div className="flex items-center gap-3 px-2 text-sm text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> No activity yet <div className="h-px flex-1 bg-border" />
      </div>
    );

  return (
    <div className="relative space-y-4 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-border">
      {items.map((u) => (
        <TimelineItem key={u._id} update={u} ticket={ticket} />
      ))}
    </div>
  );
}

function TimelineItem({ update: u, ticket }) {
  const isSystem = !u.author && !u.fromClient && !u.authorName;
  const isEvent =
    isSystem || (u.statusChangeTo && /^Status changed to/.test(u.message)) || /^(Assigned to|Unassigned|Attached \d|Priority set to)/.test(u.message);

  // Compact event line (status changes, assignments, system messages)
  if (isEvent) {
    return (
      <div className="relative flex items-center gap-3 pl-1 text-xs text-muted-foreground">
        <div className="z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border bg-card">
          {u.statusChangeTo ? (
            <span className={cn('h-2.5 w-2.5 rounded-full', findMeta(TICKET_STATUSES, u.statusChangeTo).dot)} />
          ) : (
            <CircleDot className="h-3.5 w-3.5" />
          )}
        </div>
        <p className="min-w-0 flex-1">
          <span className="font-semibold text-foreground">{u.author?.name || u.authorName || 'System'}</span>{' '}
          {u.statusChangeTo ? (
            <>
              changed status to <StatusBadge status={u.statusChangeTo} className="mx-0.5" />
            </>
          ) : (
            u.message.charAt(0).toLowerCase() + u.message.slice(1)
          )}
          <span className="ml-1.5" title={formatDateTime(u.createdAt)}>
            · {timeAgo(u.createdAt)}
          </span>
        </p>
        {u.isInternal && <Lock className="h-3 w-3" title="Internal" />}
      </div>
    );
  }

  const kind = u.fromClient ? 'client' : u.isInternal ? 'internal' : u.sentAsEmail ? 'email' : 'public';
  const styles = {
    client: 'border-lime-500/30 bg-lime-400/[0.07]',
    internal: 'border-dashed border-amber-500/40 bg-amber-400/[0.07]',
    email: 'border-sky-500/25 bg-card',
    public: 'border-border bg-card',
  };
  const isAutomation = !u.author && !u.fromClient && !!u.authorName;
  const author = u.fromClient
    ? { name: u.authorName || ticket.submitterName || 'Client', avatarColor: '#4d7c0f' }
    : u.author || { name: u.authorName, avatarColor: '#7c3aed' };

  return (
    <div className="relative flex gap-3">
      <div className="z-10 shrink-0 rounded-full ring-4 ring-background">
        <UserAvatar user={author} />
      </div>
      <div className={cn('min-w-0 flex-1 rounded-xl border shadow-sm', styles[kind])}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3">
          <span className="text-sm font-semibold">{author?.name || 'Unknown'}</span>
          {kind === 'client' && <Badge variant="lime">Client</Badge>}
          {isAutomation && <Badge variant="purple">Automation</Badge>}
          {kind === 'internal' && (
            <Badge variant="warning">
              <Lock className="h-3 w-3" /> Internal note
            </Badge>
          )}
          {kind === 'email' && (
            <Badge variant="info">
              <MailCheck className="h-3 w-3" /> Emailed to client
            </Badge>
          )}
          {kind === 'public' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Globe className="h-3 w-3" /> Visible to client
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground" title={formatDateTime(u.createdAt)}>
            {timeAgo(u.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap px-4 pb-3 pt-1.5 text-sm leading-relaxed text-foreground/90">{u.message}</p>
        {u.statusChangeTo && (
          <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
            Status → <StatusBadge status={u.statusChangeTo} />
          </div>
        )}
        {u.files?.length > 0 && <AttachmentGrid files={u.files} className="px-4 pb-3" />}
      </div>
    </div>
  );
}

function Composer({ ticket, onUpdated }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('public'); // public | internal
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('keep');
  const [sendEmail, setSendEmail] = useState(!!ticket.submitterEmail);
  const [posting, setPosting] = useState(false);
  const uploader = useUploader();

  const canEmail = !!ticket.submitterEmail;

  const submit = async () => {
    if (!message.trim() && status === 'keep' && !uploader.files.length) {
      toast.error('Write a message first');
      return;
    }
    setPosting(true);
    try {
      const nextStatus = status === 'keep' ? undefined : status;
      let res;
      if (mode === 'public' && sendEmail && canEmail && message.trim()) {
        res = await api.replyToTicket(ticket._id, { message, files: uploader.files, status: nextStatus });
        toast.success(`Reply emailed to ${ticket.submitterEmail}`);
      } else {
        res = await api.addTicketUpdate(ticket._id, {
          message,
          status: nextStatus,
          isInternal: mode === 'internal',
          files: uploader.files,
        });
        toast.success(mode === 'internal' ? 'Internal note added' : 'Reply posted');
      }
      onUpdated(res.data);
      setMessage('');
      setStatus('keep');
      uploader.reset();
    } catch (err) {
      toast.error(apiError(err, 'Failed to post'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors',
        mode === 'internal' ? 'border-amber-500/40 ring-4 ring-amber-500/[0.06]' : 'focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10'
      )}
    >
      <div className="flex items-center gap-1 border-b border-border bg-secondary/30 p-1.5">
        {[
          { value: 'public', label: 'Reply to client', icon: Globe },
          { value: 'internal', label: 'Internal note', icon: Lock },
        ].map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              mode === m.value
                ? m.value === 'internal'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <m.icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        ))}
        <span className="ml-auto hidden pr-2 text-[11px] text-muted-foreground sm:block">Ctrl + Enter to send</span>
      </div>
      <div className="flex gap-3 p-4">
        <UserAvatar user={user} size="sm" className="mt-1 hidden sm:flex" />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()}
          rows={4}
          placeholder={
            mode === 'internal'
              ? 'Private note for your team — the client will never see this…'
              : `Write a reply to ${ticket.submitterName || ticket.client?.name || 'the client'}…`
          }
          className="min-h-[96px] resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {uploader.files.length > 0 && (
        <div className="px-4 pb-3">
          <PendingFiles files={uploader.files} onRemove={uploader.remove} />
        </div>
      )}
      <div className="flex flex-col gap-2 border-t border-border bg-secondary/20 px-3 py-2.5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-1">
          <AttachButton uploading={uploader.uploading} onPick={uploader.pick} />
          <SavedReplyPicker ticket={ticket} onInsert={(text) => setMessage((m) => (m.trim() ? `${m.trimEnd()}\n\n${text}` : text))} />
          {mode === 'public' && canEmail && (
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">
              <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              <Mail className="h-3.5 w-3.5" /> Also email {ticket.submitterEmail}
            </label>
          )}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep status</SelectItem>
              {TICKET_STATUSES.filter((s) => s.value !== ticket.status).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  Set to {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={mode === 'internal' ? 'default' : 'gradient'}
            onClick={submit}
            disabled={posting || uploader.uploading}
            className={cn(mode === 'internal' && 'bg-amber-600 text-white hover:bg-amber-600/90')}
          >
            {posting ? <Loader2 className="animate-spin" /> : <Send />}
            {mode === 'internal' ? 'Add note' : 'Send'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PropRow({ label, children }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function InlineSelect({ value, items, onChange, render }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto max-w-[200px] gap-2 border-transparent bg-transparent px-2 shadow-none hover:bg-secondary">
        <div className="flex min-w-0 items-center">{render(value)}</div>
      </SelectTrigger>
      <SelectContent align="end">
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DetailLine({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

function TagEditor({ tags, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={tags.length ? 'Add…' : 'Add a tag…'}
        className="h-6 min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
