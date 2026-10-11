import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Receipt, Wallet, AlertTriangle, FileText, CheckCircle2, Loader2, Clock, Tag } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, StatTile, EmptyState } from '@/components/shared/Common';
import { INVOICE_STATUSES } from '@/lib/constants';
import { cn, formatMoney, formatDate, formatMinutes, apiError } from '@/lib/utils';

const FILTERS = [
  { v: 'all', l: 'All' },
  { v: 'draft', l: 'Drafts' },
  { v: 'sent', l: 'Sent' },
  { v: 'overdue', l: 'Overdue' },
  { v: 'paid', l: 'Paid' },
  { v: 'void', l: 'Void' },
];

export function InvoiceStatusBadge({ status }) {
  const meta = INVOICE_STATUSES[status] || INVOICE_STATUSES.draft;
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

export default function Invoices() {
  const navigate = useNavigate();
  const { billing } = useWorkspace();
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getInvoices(filter === 'all' ? {} : { status: filter })
      .then((r) => setData(r.data))
      .catch((err) => toast.error(apiError(err, 'Failed to load invoices')))
      .finally(() => setLoading(false));
  }, [filter]);

  const cur = billing.currency;
  const s = data?.stats;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader eyebrow="Billing" title="Invoices" description="Bill tracked time and fixed-price work, send branded PDFs and record payments.">
        <Button variant="gradient" onClick={() => setCreateOpen(true)}>
          <Plus /> New invoice
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Outstanding" value={formatMoney(s?.outstanding, cur)} icon={Receipt} tone="info" />
        <StatTile label="Overdue" value={formatMoney(s?.overdue, cur)} icon={AlertTriangle} tone="danger" hint={s?.overdueCount ? `${s.overdueCount} invoice${s.overdueCount === 1 ? '' : 's'}` : 'nothing overdue'} />
        <StatTile label="Paid this month" value={formatMoney(s?.paidThisMonth, cur)} icon={Wallet} />
        <StatTile label="Drafts" value={s?.draftCount ?? 0} icon={FileText} tone="warn" hint={`${formatMoney(s?.collected, cur)} collected all-time`} />
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={cn('shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', filter === f.v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !data?.invoices.length ? (
        <EmptyState
          icon={Receipt}
          title={filter === 'all' ? 'No invoices yet' : 'Nothing here'}
          description="Create an invoice from unbilled time and fixed-price work in a couple of clicks."
          action={
            <Button variant="gradient" onClick={() => setCreateOpen(true)}>
              <Plus /> New invoice
            </Button>
          }
        />
      ) : (
        <Card className={cn('overflow-hidden', loading && 'opacity-60')}>
          <div className="hidden grid-cols-[120px_minmax(0,1fr)_110px_110px_130px_130px] gap-3 border-b border-border bg-secondary/40 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Number</span>
            <span>Client</span>
            <span>Issued</span>
            <span>Due</span>
            <span className="text-right">Total</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-border">
            {data.invoices.map((i) => (
              <button
                key={i._id}
                onClick={() => navigate(`/invoices/${i._id}`)}
                className="grid w-full grid-cols-2 items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/30 md:grid-cols-[120px_minmax(0,1fr)_110px_110px_130px_130px]"
              >
                <span className="font-mono text-sm font-bold">{i.number}</span>
                <span className="min-w-0 md:order-none">
                  <span className="block truncate text-sm font-semibold">{i.client?.name}</span>
                  {i.project?.name && <span className="block truncate text-xs text-muted-foreground">{i.project.name}</span>}
                </span>
                <span className="hidden text-sm text-muted-foreground md:block">{formatDate(i.issueDate)}</span>
                <span className={cn('hidden text-sm md:block', i.displayStatus === 'overdue' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                  {formatDate(i.dueDate)}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold tabular-nums">{formatMoney(i.total, i.currency)}</span>
                  {i.amountPaid > 0 && i.status !== 'paid' && <span className="block text-[11px] text-muted-foreground">{formatMoney(i.balanceDue, i.currency)} due</span>}
                </span>
                <span className="text-right">
                  <InvoiceStatusBadge status={i.displayStatus} />
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(inv) => navigate(`/invoices/${inv._id}`)} />
    </div>
  );
}

function CreateInvoiceDialog({ open, onOpenChange, onCreated }) {
  const { billing, terms } = useWorkspace();
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [client, setClient] = useState('');
  const [project, setProject] = useState('all');
  const [range, setRange] = useState({ from: '', to: '' });
  const [unbilled, setUnbilled] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClient('');
    setProject('all');
    setUnbilled(null);
    api.getClients({ limit: 500 }).then((r) => setClients(r.data.items || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!client) return;
    api.getProjects({ client, limit: 200 }).then((r) => setProjects(r.data.items || [])).catch(() => {});
    setLoadingLines(true);
    const params = { client };
    if (project !== 'all') params.project = project;
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;
    api
      .getUnbilled(params)
      .then((r) => {
        setUnbilled(r.data);
        setPicked(new Set(r.data.lines.map((_, i) => i)));
      })
      .catch((err) => toast.error(apiError(err, 'Could not load unbilled work')))
      .finally(() => setLoadingLines(false));
  }, [client, project, range]);

  const lines = unbilled?.lines || [];
  const total = useMemo(() => lines.filter((_, i) => picked.has(i)).reduce((a, l) => a + l.quantity * l.unitPrice, 0), [lines, picked]);

  const create = async (blank) => {
    setSaving(true);
    try {
      const items = blank ? [] : lines.filter((_, i) => picked.has(i));
      const res = await api.createInvoice({ client, project: project !== 'all' ? project : undefined, items });
      toast.success(`Invoice ${res.data.number} created`);
      onOpenChange(false);
      onCreated(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Could not create invoice'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>Pick a {terms.client.toLowerCase()} — we'll gather their unbilled billable time and fixed-price work.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{terms.client}</Label>
            <Select value={client} onValueChange={(v) => { setClient(v); setProject('all'); }}>
              <SelectTrigger>
                <SelectValue placeholder={`Choose a ${terms.client.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{terms.project}</Label>
            <Select value={project} onValueChange={setProject} disabled={!client}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {terms.projects.toLowerCase()}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Work from</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} disabled={!client} />
          </div>
          <div className="space-y-1.5">
            <Label>Work to</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} disabled={!client} />
          </div>
        </div>

        {client && (
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
              <span>Unbilled work {unbilled && `· ${formatMinutes(unbilled.totalMinutes)} of time`}</span>
              <span>Rate: {formatMoney(billing.defaultHourlyRate, billing.currency)}/h</span>
            </div>
            <div className="max-h-64 divide-y divide-border overflow-y-auto scrollbar-thin">
              {loadingLines ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : lines.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No unbilled billable work. You can still create a blank invoice and add lines yourself.
                </p>
              ) : (
                lines.map((l, i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-secondary/40">
                    <Checkbox
                      checked={picked.has(i)}
                      onCheckedChange={(v) =>
                        setPicked((prev) => {
                          const n = new Set(prev);
                          v ? n.add(i) : n.delete(i);
                          return n;
                        })
                      }
                    />
                    {l.kind === 'fixed' ? <Tag className="h-3.5 w-3.5 text-violet-500" /> : <Clock className="h-3.5 w-3.5 text-sky-500" />}
                    <span className="min-w-0 flex-1 truncate text-sm">{l.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.kind === 'fixed' ? 'fixed' : `${l.quantity}h × ${formatMoney(l.unitPrice, billing.currency)}`}
                    </span>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatMoney(l.quantity * l.unitPrice, billing.currency)}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm">
            {client && lines.length > 0 && (
              <>
                Subtotal <span className="font-bold">{formatMoney(total, billing.currency)}</span>
                <span className="text-muted-foreground"> · tax added on the invoice</span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!client || saving} onClick={() => create(true)}>
              Blank invoice
            </Button>
            <Button variant="gradient" disabled={!client || saving || !picked.size} onClick={() => create(false)}>
              {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Create from {picked.size} line{picked.size === 1 ? '' : 's'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
