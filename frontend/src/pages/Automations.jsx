import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Zap,
  Plus,
  Trash2,
  Pencil,
  Play,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Wand2,
  History,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, EmptyState, ConfirmDialog } from '@/components/shared/Common';
import { TICKET_TYPES, TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/constants';
import { cn, timeAgo, apiError } from '@/lib/utils';

const TRIGGERS = [
  { value: 'ticket.created', label: 'is created', icon: Plus },
  { value: 'ticket.status_changed', label: 'changes status', icon: ArrowRight },
  { value: 'ticket.assigned', label: 'is assigned', icon: CheckCircle2 },
  { value: 'ticket.client_replied', label: 'gets a client reply', icon: Sparkles },
  { value: 'ticket.idle', label: 'has no activity for…', icon: Clock },
  { value: 'sla.breached', label: 'breaches its SLA', icon: XCircle },
];

const ACTIONS = [
  { value: 'set_status', label: 'Set status' },
  { value: 'set_priority', label: 'Set priority' },
  { value: 'assign_to', label: 'Assign to a person' },
  { value: 'assign_round_robin', label: 'Assign round-robin (least busy)' },
  { value: 'add_tag', label: 'Add tag' },
  { value: 'add_note', label: 'Add internal note' },
  { value: 'reply_to_client', label: 'Reply to client (public + email)' },
  { value: 'notify', label: 'Send in-app notification' },
  { value: 'create_todo', label: 'Create project to-do' },
  { value: 'set_due_in_days', label: 'Set due date' },
  { value: 'send_webhook', label: 'Call a webhook (Slack, Zapier…)' },
];

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: "doesn't contain" },
];

const VARIABLES = ['submitter_name', 'client_name', 'ticket_number', 'ticket_title', 'ticket_status', 'project_name', 'company_name', 'tracking_link', 'ticket_link'];

export default function Automations() {
  const { isAdmin } = useAuth();
  const { terms } = useWorkspace();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // automation or {} for new
  const [deleting, setDeleting] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [testFor, setTestFor] = useState(null);

  const load = () =>
    api
      .getAutomations()
      .then((r) => setData(r.data))
      .catch((err) => toast.error(apiError(err, 'Failed to load automations')));

  useEffect(() => {
    load();
  }, []);

  const addRecipe = async (key) => {
    try {
      const res = await api.createAutomation({ recipe: key });
      toast.success(res.data.enabled ? `“${res.data.name}” is live` : `“${res.data.name}” added — set your webhook URL, then enable it`);
      load();
      if (!res.data.enabled) setEditing(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Could not add recipe'));
    }
  };

  const toggle = async (a, enabled) => {
    setData((d) => ({ ...d, automations: d.automations.map((x) => (x._id === a._id ? { ...x, enabled } : x)) }));
    try {
      await api.updateAutomation(a._id, { enabled });
    } catch (err) {
      toast.error(apiError(err, 'Could not update'));
      load();
    }
  };

  const used = new Set((data?.automations || []).map((a) => a.name));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Workflow" title="Automations" description={`No-code rules that triage, assign, reply and escalate ${terms.tickets.toLowerCase()} for you — 24/7.`}>
        {isAdmin && (
          <Button variant="gradient" onClick={() => setEditing({})}>
            <Plus /> New automation
          </Button>
        )}
      </PageHeader>

      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          {data.automations.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No automations yet"
              description="Start with a ready-made recipe below, or build your own rule."
              compact
            />
          ) : (
            <div className="space-y-3">
              {data.automations.map((a) => (
                <Card key={a._id} className={cn('p-4 transition-opacity', !a.enabled && 'opacity-70')}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', a.enabled ? 'bg-spark/25 text-lime-700 dark:text-spark' : 'bg-secondary text-muted-foreground')}>
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{describe(a, terms)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setHistoryFor(a)} className="text-right text-xs text-muted-foreground hover:text-foreground" title="Recent runs">
                        <span className="block font-semibold tabular-nums text-foreground">{a.runCount} runs</span>
                        {a.lastRunAt ? `last ${timeAgo(a.lastRunAt)}` : 'never run'}
                      </button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => setTestFor(a)} title="Test on a ticket">
                            <Play />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(a)} title="Edit">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(a)} title="Delete">
                            <Trash2 />
                          </Button>
                          <Switch checked={a.enabled} onCheckedChange={(v) => toggle(a, v)} aria-label={a.enabled ? 'Pause' : 'Enable'} />
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {isAdmin && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold">Recipes</h2>
                <span className="text-xs text-muted-foreground">— one click to add, fully editable</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.recipes.map((r) => (
                  <Card key={r.key} className="flex flex-col p-4">
                    <p className="font-semibold">{r.name}</p>
                    <p className="mt-1 flex-1 text-xs text-muted-foreground">{r.description}</p>
                    <Button variant={used.has(r.name) ? 'outline' : 'secondary'} size="sm" className="mt-3 w-fit" onClick={() => addRecipe(r.key)}>
                      <Plus /> {used.has(r.name) ? 'Add again' : 'Use recipe'}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AutomationBuilder open={!!editing} automation={editing} onOpenChange={(v) => !v && setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      <RunHistory automation={historyFor} onOpenChange={(v) => !v && setHistoryFor(null)} />
      <TestDialog automation={testFor} onOpenChange={(v) => !v && setTestFor(null)} onRan={load} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="The rule stops running immediately. Changes it already made stay in place."
        onConfirm={async () => {
          try {
            await api.deleteAutomation(deleting._id);
            toast.success('Automation deleted');
            setDeleting(null);
            load();
          } catch (err) {
            toast.error(apiError(err, 'Delete failed'));
          }
        }}
      />
    </div>
  );
}

function describe(a, terms) {
  const t = TRIGGERS.find((x) => x.value === a.trigger);
  const when = a.trigger === 'ticket.idle' ? `has no activity for ${a.idleHours}h` : t?.label;
  const conds = a.conditions?.length ? ` and ${a.conditions.length} condition${a.conditions.length > 1 ? 's' : ''} match` : '';
  const acts = a.actions.map((x) => ACTIONS.find((y) => y.value === x.type)?.label.split(' (')[0].toLowerCase()).join(', ');
  return `When a ${terms.ticket.toLowerCase()} ${when}${conds} → ${acts}`;
}

function useOptions() {
  const { customFields, terms } = useWorkspace();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  useEffect(() => {
    api.getUsers().then((r) => setUsers(r.data.filter((u) => u.isActive !== false))).catch(() => {});
    api.getProjects({ limit: 200 }).then((r) => setProjects(r.data.items || [])).catch(() => {});
    api.getClients({ limit: 500 }).then((r) => setClients(r.data.items || [])).catch(() => {});
  }, []);
  const fields = useMemo(
    () => [
      { value: 'type', label: 'Type', options: TICKET_TYPES.map((t) => ({ value: t.value, label: t.label })) },
      { value: 'priority', label: 'Priority', options: TICKET_PRIORITIES.map((p) => ({ value: p.value, label: p.label })) },
      { value: 'status', label: 'Status', options: TICKET_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
      {
        value: 'source',
        label: 'Source',
        options: [
          { value: 'public_form', label: 'Client portal' },
          { value: 'email', label: 'Email' },
          { value: 'internal', label: 'Created by team' },
        ],
      },
      { value: 'project', label: terms.project, options: projects.map((p) => ({ value: p._id, label: p.name })) },
      { value: 'client', label: terms.client, options: clients.map((c) => ({ value: c._id, label: c.name })) },
      { value: 'assignedTo', label: 'Assignee', options: [{ value: 'unassigned', label: 'Unassigned' }, ...users.map((u) => ({ value: u._id, label: u.name }))] },
      { value: 'title', label: 'Title' },
      { value: 'description', label: 'Description' },
      { value: 'tags', label: 'Tags' },
      { value: 'submitterEmail', label: 'Requester email' },
      ...customFields.map((f) => ({
        value: `cf.${f.key}`,
        label: f.label,
        options: f.type === 'select' ? f.options.map((o) => ({ value: o, label: o })) : f.type === 'checkbox' ? [{ value: 'true', label: 'Checked' }, { value: 'false', label: 'Unchecked' }] : undefined,
      })),
    ],
    [users, projects, clients, customFields, terms]
  );
  return { fields, users };
}

const EMPTY = { name: '', trigger: 'ticket.created', idleHours: 72, matchAll: true, conditions: [], actions: [{ type: 'add_tag', value: '', message: '' }], enabled: true };

function AutomationBuilder({ open, automation, onOpenChange, onSaved }) {
  const { terms } = useWorkspace();
  const { fields, users } = useOptions();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(automation?._id ? { ...EMPTY, ...automation } : EMPTY);
  }, [open, automation]);

  const setCond = (i, patch) => setForm((f) => ({ ...f, conditions: f.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setAct = (i, patch) => setForm((f) => ({ ...f, actions: f.actions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        trigger: form.trigger,
        idleHours: form.idleHours,
        matchAll: form.matchAll,
        conditions: form.conditions,
        actions: form.actions,
        enabled: form.enabled,
      };
      if (automation?._id) await api.updateAutomation(automation._id, body);
      else await api.createAutomation(body);
      toast.success('Automation saved');
      onSaved();
    } catch (err) {
      toast.error(apiError(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{automation?._id ? 'Edit automation' : 'New automation'}</DialogTitle>
          <DialogDescription>Rules run instantly on events, and every minute for time-based triggers. Actions taken by automations never trigger other automations.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Escalate VIP bugs" autoFocus />
          </div>

          <Step n="1" title="When">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>a {terms.ticket.toLowerCase()}</span>
              <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.trigger === 'ticket.idle' && (
                <>
                  <Input type="number" min="1" className="w-24" value={form.idleHours} onChange={(e) => setForm({ ...form, idleHours: e.target.value })} />
                  <span>hours</span>
                </>
              )}
            </div>
          </Step>

          <Step n="2" title="If" hint="optional">
            {form.conditions.length > 1 && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                Match
                <Select value={form.matchAll ? 'all' : 'any'} onValueChange={(v) => setForm({ ...form, matchAll: v === 'all' })}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">all</SelectItem>
                    <SelectItem value="any">any</SelectItem>
                  </SelectContent>
                </Select>
                of these conditions
              </div>
            )}
            <div className="space-y-2">
              {form.conditions.map((c, i) => {
                const field = fields.find((f) => f.value === c.field);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Select value={c.field} onValueChange={(v) => setCond(i, { field: v, value: '' })}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={c.operator} onValueChange={(v) => setCond(i, { operator: v })}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field?.options && ['is', 'is_not'].includes(c.operator) ? (
                      <Select value={c.value} onValueChange={(v) => setCond(i, { value: v })}>
                        <SelectTrigger className="min-w-[160px] flex-1">
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input className="min-w-[160px] flex-1" value={c.value} onChange={(e) => setCond(i, { value: e.target.value })} placeholder="Value" />
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))} aria-label="Remove condition">
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setForm((f) => ({ ...f, conditions: [...f.conditions, { field: 'priority', operator: 'is', value: '' }] }))}>
              <Plus /> Add condition
            </Button>
          </Step>

          <Step n="3" title="Then">
            <div className="space-y-3">
              {form.actions.map((a, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Select value={a.type} onValueChange={(v) => setAct(i, { type: v, value: '', message: '' })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((x) => (
                          <SelectItem key={x.value} value={x.value}>
                            {x.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={form.actions.length === 1}
                      onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))}
                      aria-label="Remove action"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <ActionFields action={a} users={users} onChange={(patch) => setAct(i, patch)} />
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setForm((f) => ({ ...f, actions: [...f.actions, { type: 'notify', value: 'assignee', message: '' }] }))}>
              <Plus /> Add action
            </Button>
          </Step>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /> Enabled
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="animate-spin" />} Save automation
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, title, hint, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-bold">
          {title} {hint && <span className="font-normal text-muted-foreground">({hint})</span>}
        </p>
        {children}
      </div>
    </div>
  );
}

function ActionFields({ action: a, users, onChange }) {
  const msg = (placeholder, rows = 3) => (
    <div className="space-y-1">
      <Textarea rows={rows} value={a.message} onChange={(e) => onChange({ message: e.target.value })} placeholder={placeholder} />
      <div className="flex flex-wrap gap-1">
        {VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ message: `${a.message || ''}{{${v}}}` })}
            className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
    </div>
  );
  const pick = (items, placeholder) => (
    <Select value={a.value} onValueChange={(v) => onChange({ value: v })}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  switch (a.type) {
    case 'set_status':
      return pick(TICKET_STATUSES, 'Status');
    case 'set_priority':
      return pick(TICKET_PRIORITIES, 'Priority');
    case 'assign_to':
      return pick(users.map((u) => ({ value: u._id, label: u.name })), 'Team member');
    case 'assign_round_robin': {
      const selected = String(a.value || '').split(',').filter(Boolean);
      return (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Pick people to rotate between (none selected = everyone). The person with the fewest open items gets it.</p>
          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => {
              const on = selected.includes(u._id);
              return (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => onChange({ value: (on ? selected.filter((x) => x !== u._id) : [...selected, u._id]).join(',') })}
                  className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40')}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case 'add_tag':
      return <Input value={a.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="tag name, e.g. vip" />;
    case 'add_note':
      return msg('Internal note…', 2);
    case 'reply_to_client':
      return msg('Hi {{submitter_name}}, thanks for reaching out about {{ticket_title}}…');
    case 'notify':
      return (
        <div className="space-y-2">
          {pick([{ value: 'assignee', label: 'The assignee' }, { value: 'admins', label: 'Owners & admins' }, ...users.map((u) => ({ value: u._id, label: u.name }))], 'Who')}
          {msg('Notification text (optional)', 1)}
        </div>
      );
    case 'create_todo':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            Due in <Input type="number" min="0" className="w-20" value={a.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="0" /> days
          </div>
          {msg('Follow up on {{ticket_number}} {{ticket_title}}', 1)}
        </div>
      );
    case 'set_due_in_days':
      return (
        <div className="flex items-center gap-2 text-sm">
          Due in <Input type="number" min="0" className="w-20" value={a.value} onChange={(e) => onChange({ value: e.target.value })} /> days
        </div>
      );
    case 'send_webhook':
      return (
        <div className="space-y-1">
          <Input value={a.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="https://hooks.slack.com/services/…" />
          <p className="text-[11px] text-muted-foreground">We POST JSON with the ticket's number, title, status, priority and link.</p>
        </div>
      );
    default:
      return null;
  }
}

function RunHistory({ automation, onOpenChange }) {
  return (
    <Dialog open={!!automation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Recent runs
          </DialogTitle>
          <DialogDescription>{automation?.name}</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin">
          {!automation?.recentRuns?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">This automation hasn't run yet.</p>
          ) : (
            [...automation.recentRuns].reverse().map((r, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2">
                {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 text-rose-500" />}
                <div className="min-w-0 flex-1 text-sm">
                  <Link to={`/tickets/${r.ticket}`} className="font-semibold hover:text-primary">
                    #{r.ticketNumber}
                  </Link>{' '}
                  <span className="text-muted-foreground">{r.summary}</span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(r.at)}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({ automation, onOpenChange, onRan }) {
  const [num, setNum] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNum('');
    setResult(null);
  }, [automation]);

  const test = async (apply) => {
    setBusy(true);
    try {
      const r = await api.testAutomation(automation._id, { ticketNumber: num, apply });
      setResult(r.data);
      if (apply && r.data.applied) {
        toast.success(`Ran on #${r.data.ticket.ticketNumber}`);
        onRan();
      }
    } catch (err) {
      toast.error(apiError(err, 'Test failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!automation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Test “{automation?.name}”</DialogTitle>
          <DialogDescription>Check whether a ticket matches this rule's conditions, then optionally run it now.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Ticket number, e.g. 42" onKeyDown={(e) => e.key === 'Enter' && num && test(false)} />
          <Button variant="outline" disabled={!num || busy} onClick={() => test(false)}>
            {busy ? <Loader2 className="animate-spin" /> : 'Check'}
          </Button>
        </div>
        {result && (
          <div className={cn('rounded-lg border px-3 py-2 text-sm', result.matched ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border bg-secondary/40')}>
            <p className="font-semibold">
              {result.matched ? <Badge variant="success">Matches</Badge> : <Badge variant="slate">No match</Badge>} #{result.ticket.ticketNumber} {result.ticket.title}
            </p>
            {result.applied && <p className="mt-1 text-xs text-muted-foreground">Actions ran — see the ticket timeline.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="gradient" disabled={!result?.matched || busy} onClick={() => test(true)}>
            <Play /> Run on this ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
