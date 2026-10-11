import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckSquare, Plus, Trash2, Play, Square, Clock, Star, MessageSquareText, ListChecks, ExternalLink, Coins } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useTimer } from '@/context/TimerContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { LogTimeDialog } from '@/pages/TimeTracking';
import CustomFieldInput from '@/components/tickets/CustomFieldInput';
import { cn, formatMinutes, formatClock, formatMoney, timeAgo, apiError } from '@/lib/utils';

export { CustomFieldInput };

export function CustomFieldsCard({ ticket, onPatch }) {
  const { customFields } = useWorkspace();
  const [values, setValues] = useState(ticket.customFields || {});
  useEffect(() => setValues(ticket.customFields || {}), [ticket.customFields]);
  if (!customFields.length) return null;

  const commit = (key, v) => {
    const prev = ticket.customFields?.[key];
    if (String(prev ?? '') === String(v ?? '')) return;
    onPatch({ customFields: { [key]: v } });
  };

  return (
    <Card className="divide-y divide-border">
      <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Details</p>
      {customFields.map((f) => (
        <div
          key={f.key}
          className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2"
          // Text-like fields save when focus leaves the row; others save on change.
          onBlur={['text', 'number', 'url'].includes(f.type) ? () => commit(f.key, values[f.key]) : undefined}
        >
          <span className="text-xs font-semibold text-muted-foreground">
            {f.label}
            {f.required && <span className="text-rose-500"> *</span>}
          </span>
          <div className="flex max-w-[190px] items-center gap-1">
            {f.type === 'url' && values[f.key] && (
              <a href={values[f.key]} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Open link">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <CustomFieldInput
              compact
              field={f}
              value={values[f.key]}
              className="w-[160px]"
              onChange={(v) => {
                setValues((s) => ({ ...s, [f.key]: v }));
                if (['select', 'checkbox', 'date'].includes(f.type)) commit(f.key, v);
              }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}

export function ChecklistCard({ ticket, onUpdated }) {
  const [text, setText] = useState('');
  const items = ticket.checklist || [];
  const done = items.filter((i) => i.done).length;

  const call = async (fn) => {
    try {
      const res = await fn();
      onUpdated(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Checklist update failed'));
    }
  };

  const add = (e) => {
    e.preventDefault();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    call(() => api.addChecklistItem(ticket._id, { items: lines }));
    setText('');
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <ListChecks className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold">Checklist</p>
        {items.length > 0 && (
          <>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-[var(--viz-2)] transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {done}/{items.length}
            </span>
          </>
        )}
      </div>
      <div className="p-2">
        {items.map((i) => (
          <div key={i._id} className="group flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-secondary/50">
            <Checkbox checked={i.done} onCheckedChange={(v) => call(() => api.updateChecklistItem(ticket._id, i._id, { done: !!v }))} />
            <span className={cn('flex-1 text-sm', i.done && 'text-muted-foreground line-through')}>{i.text}</span>
            {i.done && i.doneBy && <span className="text-[11px] text-muted-foreground">{i.doneBy.name}</span>}
            <button
              onClick={() => call(() => api.deleteChecklistItem(ticket._id, i._id))}
              className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
              aria-label="Remove item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <form onSubmit={add} className="flex items-center gap-2 px-2 pt-1">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // Pasting several lines adds them as separate steps.
              const pasted = e.clipboardData.getData('text');
              if (pasted.includes('\n')) {
                e.preventDefault();
                setText(pasted);
              }
            }}
            placeholder={items.length ? 'Add a step…' : 'Add steps, acceptance criteria or test cases… (paste a list to add many)'}
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {text && (
            <Button type="submit" size="sm" variant="secondary">
              <CheckSquare /> Add
            </Button>
          )}
        </form>
      </div>
    </Card>
  );
}

export function TimeCard({ ticket, onChanged }) {
  const timer = useTimer();
  const { billing } = useWorkspace();
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const runningHere = timer.running?.ticket?._id === ticket._id;

  const load = () =>
    api
      .getTimeEntries({ ticket: ticket._id })
      .then((r) => setEntries(r.data.entries))
      .catch(() => {});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket._id, timer.version]);

  const total = entries.reduce((a, e) => a + e.minutes, 0) + (runningHere ? timer.elapsed / 60000 : 0);
  const est = ticket.estimateHours ? ticket.estimateHours * 60 : null;
  const pct = est ? Math.min(100, (total / est) * 100) : 0;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Time
        </p>
        <span className="font-mono text-lg font-bold tabular-nums">{runningHere ? formatClock(total * 60000) : formatMinutes(total)}</span>
      </div>
      {est && (
        <div className="mb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className={cn('h-full rounded-full transition-all', total > est ? 'bg-rose-500' : 'bg-[var(--viz-2)]')} style={{ width: `${pct}%` }} />
          </div>
          <p className={cn('mt-1 text-[11px]', total > est ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
            {total > est ? `${formatMinutes(total - est)} over the ${ticket.estimateHours}h estimate` : `${formatMinutes(est - total)} left of ${ticket.estimateHours}h estimate`}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        {runningHere ? (
          <Button className="flex-1 bg-rose-500 text-white hover:bg-rose-500/90" onClick={async () => { await timer.stop(); onChanged?.(); }}>
            <Square className="fill-current" /> Stop timer
          </Button>
        ) : (
          <Button variant="gradient" className="flex-1" onClick={() => timer.start({ ticket: ticket._id, description: ticket.title })}>
            <Play className="fill-current" /> Start timer
          </Button>
        )}
        <Button variant="outline" onClick={() => setLogOpen(true)}>
          <Plus /> Log
        </Button>
      </div>
      {entries.length > 0 && (
        <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto scrollbar-thin">
          {entries.slice(0, 8).map((e) => (
            <div key={e._id} className="flex items-center gap-2 text-xs">
              <UserAvatar user={e.user} size="xs" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.description || 'Time logged'}</span>
              <span className="text-muted-foreground">{timeAgo(e.startedAt)}</span>
              <span className="w-12 text-right font-semibold tabular-nums">{formatMinutes(e.minutes)}</span>
            </div>
          ))}
        </div>
      )}
      {isAdmin && total > 0 && (
        <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
          ≈ {formatMoney((entries.filter((e) => e.billable).reduce((a, e) => a + e.minutes, 0) / 60) * (billing.defaultHourlyRate || 0), billing.currency)} billable value
        </p>
      )}
      <LogTimeDialog open={logOpen} onOpenChange={setLogOpen} ticket={ticket} onSaved={() => { load(); timer.bump(); onChanged?.(); }} />
    </Card>
  );
}

export function BillingCard({ ticket, onPatch }) {
  const { billing } = useWorkspace();
  const [est, setEst] = useState(ticket.estimateHours ?? '');
  const [price, setPrice] = useState(ticket.fixedPrice ?? '');
  useEffect(() => {
    setEst(ticket.estimateHours ?? '');
    setPrice(ticket.fixedPrice ?? '');
  }, [ticket.estimateHours, ticket.fixedPrice]);

  return (
    <Card className="divide-y divide-border">
      <p className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Coins className="h-3.5 w-3.5" /> Billing
      </p>
      <label className="flex min-h-[48px] items-center justify-between px-4">
        <span className="text-xs font-semibold text-muted-foreground">Billable</span>
        <Switch checked={ticket.billable !== false} onCheckedChange={(v) => onPatch({ billable: v }, v ? 'Marked billable' : 'Marked non-billable')} />
      </label>
      <div className="flex min-h-[48px] items-center justify-between gap-3 px-4">
        <span className="text-xs font-semibold text-muted-foreground">Estimate (hours)</span>
        <Input
          type="number"
          min="0"
          step="0.5"
          className="h-8 w-24 text-right text-xs"
          value={est}
          onChange={(e) => setEst(e.target.value)}
          onBlur={() => String(est) !== String(ticket.estimateHours ?? '') && onPatch({ estimateHours: est || 0 }, 'Estimate updated')}
        />
      </div>
      <div className="flex min-h-[48px] items-center justify-between gap-3 px-4">
        <span className="text-xs font-semibold text-muted-foreground" title="Bill a quoted price instead of hours">
          Fixed price ({billing.currency})
        </span>
        <Input
          type="number"
          min="0"
          className="h-8 w-24 text-right text-xs"
          value={price}
          placeholder="—"
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => String(price) !== String(ticket.fixedPrice ?? '') && onPatch({ fixedPrice: price || 0 }, 'Price updated')}
        />
      </div>
      {ticket.fixedPrice > 0 && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground">
          {ticket.fixedPriceInvoiced ? '✓ Already invoiced' : 'Will appear as a fixed-price line on the next invoice; its time isn’t billed separately.'}
        </p>
      )}
    </Card>
  );
}

export function CsatCard({ csat }) {
  if (!csat?.rating) return null;
  return (
    <Card className="p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Client rating</p>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn('h-5 w-5', n <= csat.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
        ))}
      </div>
      {csat.comment && <p className="mt-2 text-sm italic text-muted-foreground">“{csat.comment}”</p>}
    </Card>
  );
}

/** Dropdown that inserts a saved reply (with variables filled in) into the composer. */
export function SavedReplyPicker({ ticket, onInsert }) {
  const { user } = useAuth();
  const [replies, setReplies] = useState(null);

  const render = (body) => {
    const vars = {
      submitter_name: ticket.submitterName || ticket.client?.contactPerson || ticket.client?.name || 'there',
      client_name: ticket.client?.name || '',
      ticket_number: `#${ticket.ticketNumber}`,
      ticket_title: ticket.title,
      project_name: ticket.project?.name || '',
      agent_name: user?.name || '',
      company_name: user?.company?.name || '',
      tracking_link: `${window.location.origin}/public/ticket/${ticket.publicToken}`,
    };
    return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => (k in vars ? vars[k] : m));
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && !replies && api.getSavedReplies().then((r) => setReplies(r.data)).catch(() => setReplies([]))}>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground outline-none hover:bg-secondary hover:text-foreground">
        <MessageSquareText className="h-3.5 w-3.5" /> Saved replies
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Insert a saved reply</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {replies === null ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        ) : replies.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No saved replies yet.</p>
        ) : (
          replies.map((r) => (
            <DropdownMenuItem
              key={r._id}
              onClick={() => {
                onInsert(render(r.body));
                api.useSavedReply(r._id).catch(() => {});
              }}
              className="flex-col items-start"
            >
              <span className="font-semibold">{r.title}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{r.body}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings?tab=replies">Manage saved replies</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
