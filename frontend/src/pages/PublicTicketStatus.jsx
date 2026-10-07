import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Send, Check, Clock, RotateCcw, Copy, ShieldOff } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TypeBadge, StatusBadge } from '@/components/shared/Badges';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { AttachButton, PendingFiles, AttachmentGrid } from '@/components/shared/FileChips';
import PortalChrome, { readIdentity, saveIdentity } from '@/components/portal/PortalChrome';
import useUploader from '@/lib/useUploader';
import { cn, formatDateTime, timeAgo, apiError } from '@/lib/utils';

const STEPS = [
  { key: 'open', label: 'Received' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'in_review', label: 'In review' },
  { key: 'resolved', label: 'Resolved' },
];

function stepIndex(status) {
  if (status === 'closed' || status === 'resolved') return 3;
  if (status === 'in_review') return 2;
  if (status === 'in_progress') return 1;
  return 0; // open / reopened
}

export default function PublicTicketStatus() {
  const { token } = useParams();
  const [ticket, setTicket] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .getPublicTicket(token)
      .then((res) => {
        setTicket(res.data);
        document.title = `#${res.data.ticketNumber} ${res.data.title} · ${res.data.companyName || 'Support'}`;
      })
      .catch(() => setNotFound(true));
  }, [token]);

  if (notFound) {
    return (
      <PortalChrome>
        <Card className="mx-auto max-w-md p-10 text-center">
          <ShieldOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-display text-lg font-bold">Request not found</p>
          <p className="mt-2 text-sm text-muted-foreground">This tracking link is invalid or no longer available.</p>
        </Card>
      </PortalChrome>
    );
  }

  if (!ticket) {
    return (
      <PortalChrome>
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PortalChrome>
    );
  }

  const current = stepIndex(ticket.status);
  const conversation = ticket.updates.filter((u) => !u.system || u.statusChangeTo);
  const portalHref = ticket.portalToken ? `/portal/${ticket.portalToken}` : null;

  return (
    <PortalChrome companyName={ticket.companyName} homeHref={portalHref}>
      <div className="mx-auto max-w-3xl animate-fade-in">
        {portalHref && (
          <Link to={portalHref} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All requests for {ticket.projectName}
          </Link>
        )}

        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-bold">#{ticket.ticketNumber}</span>
            <TypeBadge type={ticket.type} />
            <StatusBadge status={ticket.status} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{ticket.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {ticket.projectName} · submitted {timeAgo(ticket.createdAt)}
            {ticket.assignee && <> · handled by <span className="font-medium text-foreground">{ticket.assignee.name}</span></>}
          </p>
        </div>

        {/* Progress stepper */}
        <Card className="mb-6 p-5">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < current || (i === current && current === 3);
              const active = i === current && current !== 3;
              return (
                <React.Fragment key={s.key}>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                        done && 'border-emerald-500 bg-emerald-500 text-white',
                        active && 'border-primary bg-accent text-accent-foreground ring-4 ring-primary/15',
                        !done && !active && 'border-border text-muted-foreground'
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : active ? <Clock className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={cn('text-[11px] font-semibold sm:text-xs', done || active ? 'text-foreground' : 'text-muted-foreground')}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn('mx-1 mb-6 h-0.5 flex-1 rounded-full sm:mx-2', i < current ? 'bg-emerald-500' : 'bg-border')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {ticket.status === 'reopened' && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-xs font-semibold text-rose-700 dark:text-rose-300">
              Reopened — the team is looking at it again.
            </p>
          )}
        </Card>

        {/* Original request */}
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border bg-secondary/30 px-5 py-3">
            <UserAvatar user={{ name: ticket.submitterName || 'You', avatarColor: '#4d7c0f' }} size="sm" />
            <div>
              <p className="text-sm font-semibold">{ticket.submitterName || 'Original request'}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(ticket.createdAt)}</p>
            </div>
          </div>
          <div className="p-5">
            <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{ticket.description}</p>
            <AttachmentGrid files={ticket.files.filter((f) => !ticket.updates.some((u) => u.files?.some((x) => x.url === f.url)))} className="mt-4" />
          </div>
        </Card>

        {/* Conversation */}
        <h2 className="mb-3 font-display text-lg font-semibold">Updates & conversation</h2>
        {conversation.length === 0 ? (
          <p className="mb-6 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No updates yet — the team has been notified and will respond here.
          </p>
        ) : (
          <div className="mb-6 space-y-4">
            {conversation.map((u) =>
              u.system || (!u.fromClient && u.statusChangeTo && /^Status changed to/.test(u.message)) ? (
                <div key={u._id} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  {u.statusChangeTo ? (
                    <>
                      Status changed to <StatusBadge status={u.statusChangeTo} />
                    </>
                  ) : (
                    u.message
                  )}
                  · {timeAgo(u.createdAt)}
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : (
                <div key={u._id} className={cn('flex gap-3', u.fromClient && 'flex-row-reverse')}>
                  <UserAvatar
                    user={{ name: u.authorName || (u.fromClient ? 'You' : 'Team'), avatarColor: u.fromClient ? '#4d7c0f' : u.authorColor || '#047857' }}
                    size="sm"
                    className="mt-1"
                  />
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm',
                      u.fromClient ? 'rounded-tr-md border-lime-500/30 bg-lime-400/10' : 'rounded-tl-md border-border bg-card'
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">{u.authorName || (u.fromClient ? 'You' : 'Support team')}</span>
                      {!u.fromClient && <span className="rounded bg-accent px-1.5 py-px text-[10px] font-bold text-accent-foreground">TEAM</span>}
                      <span className="text-muted-foreground" title={formatDateTime(u.createdAt)}>
                        {timeAgo(u.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{u.message}</p>
                    {u.statusChangeTo && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Status → <StatusBadge status={u.statusChangeTo} />
                      </p>
                    )}
                    {u.files?.length > 0 && <AttachmentGrid files={u.files} className="mt-2" />}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {ticket.allowComments ? (
          <ReplyBox token={token} ticket={ticket} onUpdated={setTicket} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">Replies are disabled for this project.</p>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Tracking link copied');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" /> Copy tracking link
          </button>
        </div>
      </div>
    </PortalChrome>
  );
}

function ReplyBox({ token, ticket, onUpdated }) {
  const identity = readIdentity();
  const [name, setName] = useState(identity.name || ticket.submitterName || '');
  const [message, setMessage] = useState('');
  const [reopen, setReopen] = useState(false);
  const [sending, setSending] = useState(false);
  const uploader = useUploader({ isPublic: true });
  const isDone = ['resolved', 'closed'].includes(ticket.status);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await api.addPublicComment(token, { name, message, reopen, files: uploader.files });
      saveIdentity({ ...identity, name });
      onUpdated({ ...ticket, ...res.data });
      setMessage('');
      setReopen(false);
      uploader.reset();
      toast.success('Message sent to the team');
    } catch (err) {
      toast.error(apiError(err, 'Could not send message'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="overflow-hidden focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
      <form onSubmit={send}>
        <div className="border-b border-border bg-secondary/30 px-4 py-3">
          <p className="text-sm font-semibold">{isDone ? 'Still having trouble?' : 'Add a message'}</p>
          <p className="text-xs text-muted-foreground">The team gets notified right away.</p>
        </div>
        <div className="space-y-3 p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className="sm:max-w-xs" />
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isDone ? 'Describe what is still not working…' : 'Add more details, answer a question, or share a screenshot…'}
            required
          />
          <PendingFiles files={uploader.files} onRemove={uploader.remove} />
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-secondary/20 px-3 py-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1">
            <AttachButton uploading={uploader.uploading} onPick={uploader.pick} />
            {isDone && (
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
                <input type="checkbox" className="accent-rose-500" checked={reopen} onChange={(e) => setReopen(e.target.checked)} />
                <RotateCcw className="h-3.5 w-3.5" /> Reopen this request
              </label>
            )}
          </div>
          <Button type="submit" variant="gradient" className="sm:ml-auto" disabled={sending || uploader.uploading || !message.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Send message
          </Button>
        </div>
      </form>
    </Card>
  );
}
