import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Download,
  Printer,
  Send,
  Link2,
  Plus,
  Trash2,
  Wallet,
  Ban,
  CheckCircle2,
  Loader2,
  Save,
  Palette,
  Eye,
  PencilLine,
  ExternalLink,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/Common';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import { InvoiceStatusBadge } from '@/pages/Invoices';
import { cn, formatMoney, formatDate, apiError, downloadBlob, printBlob } from '@/lib/utils';

const TEMPLATES = [
  { value: 'modern', label: 'Modern', hint: 'Bold colour header' },
  { value: 'classic', label: 'Classic', hint: 'Serif, centred, formal' },
  { value: 'minimal', label: 'Minimal', hint: 'Light & airy' },
];
const ACCENTS = ['#047857', '#0f766e', '#1d4ed8', '#4338ca', '#7c3aed', '#be185d', '#b45309', '#111827'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function computeTotals(d) {
  const subtotal = r2(d.items.reduce((a, i) => a + r2((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)), 0));
  const discountAmount = r2((subtotal * (Number(d.discountPercent) || 0)) / 100);
  const taxAmount = r2(((subtotal - discountAmount) * (Number(d.taxRate) || 0)) / 100);
  const total = r2(subtotal - discountAmount + taxAmount);
  return { subtotal, discountAmount, taxAmount, total };
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { billing } = useWorkspace();
  const [invoice, setInvoice] = useState(null);
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState('preview');
  const [busy, setBusy] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const hydrate = (inv) => {
    setInvoice(inv);
    setDraft({
      items: inv.items.map((i) => ({ ...i })),
      discountPercent: inv.discountPercent,
      taxRate: inv.taxRate,
      issueDate: inv.issueDate?.slice(0, 10),
      dueDate: inv.dueDate?.slice(0, 10),
      notes: inv.notes || '',
      terms: inv.terms || '',
    });
  };

  useEffect(() => {
    api
      .getInvoice(id)
      .then((r) => hydrate(r.data))
      .catch(() => toast.error('Invoice not found'));
  }, [id]);

  const locked = invoice && ['paid', 'void'].includes(invoice.status);
  const dirty = useMemo(() => {
    if (!invoice || !draft) return false;
    return (
      JSON.stringify(draft.items.map(({ description, quantity, unitPrice, unit }) => ({ description, quantity: Number(quantity), unitPrice: Number(unitPrice), unit }))) !==
        JSON.stringify(invoice.items.map(({ description, quantity, unitPrice, unit }) => ({ description, quantity, unitPrice, unit }))) ||
      Number(draft.discountPercent) !== invoice.discountPercent ||
      Number(draft.taxRate) !== invoice.taxRate ||
      draft.issueDate !== invoice.issueDate?.slice(0, 10) ||
      draft.dueDate !== invoice.dueDate?.slice(0, 10) ||
      draft.notes !== (invoice.notes || '') ||
      draft.terms !== (invoice.terms || '')
    );
  }, [draft, invoice]);

  if (!invoice || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }

  const totals = computeTotals(draft);
  const template = invoice.template || billing.template || 'modern';
  const accent = invoice.accentColor || billing.accentColor || '#047857';
  const publicUrl = `${window.location.origin}/public/invoice/${invoice.publicToken}`;

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res?.data?._id) hydrate(res.data);
      if (success) toast.success(success);
      return res;
    } catch (err) {
      toast.error(apiError(err, 'Something went wrong'));
      return null;
    } finally {
      setBusy('');
    }
  };

  const save = () =>
    run(
      'save',
      () =>
        api.updateInvoice(invoice._id, {
          items: draft.items.filter((i) => String(i.description).trim()),
          discountPercent: draft.discountPercent,
          taxRate: draft.taxRate,
          issueDate: draft.issueDate,
          dueDate: draft.dueDate,
          notes: draft.notes,
          terms: draft.terms,
        }),
      'Invoice saved'
    );

  const pdf = async (print) => {
    if (dirty) await save();
    setBusy(print ? 'print' : 'pdf');
    try {
      const res = await api.getInvoicePdf(invoice._id);
      if (print) printBlob(res.data);
      else downloadBlob(res.data, `${invoice.number}.pdf`);
    } catch (err) {
      toast.error(apiError(err, 'Could not generate the PDF'));
    } finally {
      setBusy('');
    }
  };

  const setItem = (i, patch) => setDraft((d) => ({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  const docData = {
    ...invoice,
    ...draft,
    ...totals,
    status: invoice.displayStatus,
    projectName: invoice.project?.name,
    discountPercent: Number(draft.discountPercent) || 0,
    taxRate: Number(draft.taxRate) || 0,
    balanceDue: r2(totals.total - invoice.amountPaid),
  };
  const business = {
    name: billing.businessName || 'Your business',
    address: billing.businessAddress,
    email: billing.businessEmail,
    phone: billing.businessPhone,
    taxId: billing.taxId,
    logoUrl: billing.logoUrl,
    paymentInstructions: billing.paymentInstructions,
    footerNote: billing.footerNote,
  };

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/invoices')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight">{invoice.number}</h1>
            <InvoiceStatusBadge status={invoice.displayStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to={`/clients/${invoice.client?._id}`} className="font-semibold text-foreground hover:text-primary">
              {invoice.client?.name}
            </Link>
            {invoice.project && ` · ${invoice.project.name}`} · {formatMoney(totals.total, invoice.currency)} · due {formatDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty && (
            <Button variant="gradient" onClick={save} disabled={busy === 'save'}>
              {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />} Save changes
            </Button>
          )}
          <Button variant="outline" onClick={() => pdf(false)} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <Download />} PDF
          </Button>
          <Button variant="outline" onClick={() => pdf(true)} disabled={!!busy}>
            {busy === 'print' ? <Loader2 className="animate-spin" /> : <Printer />} Print
          </Button>
          {invoice.status !== 'void' && (
            <Button variant={dirty ? 'outline' : 'gradient'} onClick={() => setSendOpen(true)}>
              <Send /> Email to client
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex w-fit rounded-lg border border-border bg-card p-0.5 shadow-sm">
            {[
              { v: 'preview', l: 'Preview', icon: Eye },
              { v: 'edit', l: 'Edit details', icon: PencilLine },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => setView(t.v)}
                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold', view === t.v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.l}
              </button>
            ))}
          </div>

          {view === 'preview' ? (
            <div className="overflow-x-auto rounded-2xl bg-secondary/50 p-4 sm:p-8">
              <InvoiceDocument inv={docData} business={business} template={template} accent={accent} className="mx-auto min-w-[640px] max-w-[820px]" />
            </div>
          ) : (
            <Card>
              <CardContent className="space-y-5 p-5">
                {locked && (
                  <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    This invoice is {invoice.status} — line items and amounts are locked. You can still edit notes.
                  </p>
                )}
                <div>
                  <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_90px_70px_110px_110px_36px] gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
                    <span>Description</span>
                    <span className="text-right">Qty</span>
                    <span>Unit</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Amount</span>
                    <span />
                  </div>
                  <div className="space-y-2">
                    {draft.items.map((it, i) => (
                      <div key={it._id || i} className="grid grid-cols-[minmax(0,1fr)_90px_70px_110px_110px_36px] items-center gap-2">
                        <Input value={it.description} disabled={locked} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Description" />
                        <Input type="number" min="0" step="0.25" className="text-right" disabled={locked} value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                        <Input value={it.unit || ''} disabled={locked} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder="hrs" />
                        <Input type="number" min="0" step="0.01" className="text-right" disabled={locked} value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value })} />
                        <span className="text-right text-sm font-semibold tabular-nums">{formatMoney((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), invoice.currency)}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={locked}
                          onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}
                          aria-label="Remove line"
                          title={it.timeEntries?.length ? 'Removing this line frees its time to be billed again' : 'Remove line'}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {!locked && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { description: '', quantity: 1, unit: '', unitPrice: billing.defaultHourlyRate || 0 }] }))}
                    >
                      <Plus /> Add line
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Issue date</Label>
                    <Input type="date" value={draft.issueDate || ''} disabled={locked} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due date</Label>
                    <Input type="date" value={draft.dueDate || ''} disabled={locked} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Discount %</Label>
                    <Input type="number" min="0" max="100" value={draft.discountPercent} disabled={locked} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{invoice.taxLabel || 'Tax'} %</Label>
                    <Input type="number" min="0" value={draft.taxRate} disabled={locked} onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })} />
                  </div>
                </div>

                <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                  <Line label="Subtotal" value={formatMoney(totals.subtotal, invoice.currency)} />
                  {totals.discountAmount > 0 && <Line label="Discount" value={`-${formatMoney(totals.discountAmount, invoice.currency)}`} />}
                  {totals.taxAmount > 0 && <Line label={invoice.taxLabel || 'Tax'} value={formatMoney(totals.taxAmount, invoice.currency)} />}
                  <div className="border-t border-border pt-1">
                    <Line label="Total" value={formatMoney(totals.total, invoice.currency)} bold />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Notes (shown on invoice)</Label>
                    <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Thanks for working with us!" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Terms</Label>
                    <Textarea rows={3} value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} placeholder="Payment due within 14 days." />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Balance due</span>
                <span className="font-display text-2xl font-bold tabular-nums">{formatMoney(invoice.balanceDue, invoice.currency)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-[var(--viz-2)]" style={{ width: `${invoice.total ? Math.min(100, (invoice.amountPaid / invoice.total) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMoney(invoice.amountPaid, invoice.currency)} of {formatMoney(invoice.total, invoice.currency)} paid
              </p>
              <div className="grid gap-2 pt-1">
                {invoice.status === 'draft' && (
                  <Button variant="outline" onClick={() => run('sent', () => api.updateInvoice(invoice._id, { status: 'sent' }), 'Marked as sent')}>
                    <CheckCircle2 /> Mark as sent
                  </Button>
                )}
                {!['paid', 'void'].includes(invoice.status) && (
                  <Button variant="gradient" onClick={() => setPayOpen(true)}>
                    <Wallet /> Record payment
                  </Button>
                )}
                {invoice.status !== 'draft' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success('Client invoice link copied');
                    }}
                  >
                    <Link2 /> Copy client link
                  </Button>
                )}
                {invoice.status !== 'draft' && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink /> View as client
                    </a>
                  </Button>
                )}
                {invoice.status === 'draft' ? (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm('delete')}>
                    <Trash2 /> Delete draft
                  </Button>
                ) : (
                  invoice.status !== 'void' &&
                  invoice.status !== 'paid' && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm('void')}>
                      <Ban /> Void invoice
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Palette className="h-4 w-4" /> Look
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => run('look', () => api.updateInvoice(invoice._id, { template: t.value }))}
                    title={t.hint}
                    className={cn('rounded-lg border-2 px-2 py-2 text-xs font-semibold transition-colors', template === t.value ? 'border-primary bg-accent/40' : 'border-border hover:border-primary/40')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => run('look', () => api.updateInvoice(invoice._id, { accentColor: c }))}
                    className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110', accent === c && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }}
                    aria-label={`Accent ${c}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Defaults for new invoices live in{' '}
                <Link to="/settings?tab=billing" className="font-semibold text-primary hover:underline">
                  Settings → Billing
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoice.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
              ) : (
                invoice.payments.map((p) => (
                  <div key={p._id} className="group flex items-center gap-2 text-sm">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold tabular-nums">{formatMoney(p.amount, invoice.currency)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {formatDate(p.date)} · {p.method}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => run('pay', () => api.deleteInvoicePayment(invoice._id, p._id), 'Payment removed')}
                      aria-label="Remove payment"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))
              )}
              {invoice.sentAt && <p className="pt-2 text-[11px] text-muted-foreground">Sent {formatDate(invoice.sentAt)}</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} invoice={invoice} onSave={(data) => run('pay', () => api.addInvoicePayment(invoice._id, data), 'Payment recorded').then((r) => r && setPayOpen(false))} />
      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        invoice={invoice}
        onSend={async (data) => {
          if (dirty) await save();
          const r = await run('send', () => api.sendInvoice(invoice._id, data), 'Invoice emailed');
          if (r) setSendOpen(false);
        }}
        busy={busy === 'send'}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm === 'delete' ? 'Delete this draft?' : 'Void this invoice?'}
        description={
          confirm === 'delete'
            ? 'The draft is removed and its time becomes billable again.'
            : 'The invoice stays on record as void and its time becomes billable again. This cannot be undone.'
        }
        confirmLabel={confirm === 'delete' ? 'Delete' : 'Void'}
        loading={!!busy}
        onConfirm={async () => {
          if (confirm === 'delete') {
            const r = await run('del', () => api.deleteInvoice(invoice._id), 'Draft deleted');
            if (r) navigate('/invoices');
          } else {
            await run('void', () => api.updateInvoice(invoice._id, { status: 'void' }), 'Invoice voided');
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Line({ label, value, bold }) {
  return (
    <div className={cn('flex justify-between', bold ? 'text-base font-bold' : 'text-muted-foreground')}>
      <span>{label}</span>
      <span className={cn('tabular-nums', !bold && 'text-foreground')}>{value}</span>
    </div>
  );
}

function PaymentDialog({ open, onOpenChange, invoice, onSave }) {
  const [form, setForm] = useState({ amount: '', date: '', method: 'Bank transfer', note: '' });
  useEffect(() => {
    if (open) setForm({ amount: String(invoice.balanceDue || ''), date: new Date().toISOString().slice(0, 10), method: 'Bank transfer', note: '' });
  }, [open, invoice]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Balance due: {formatMoney(invoice.balanceDue, invoice.currency)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="Bank transfer, card, UPI…" />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Reference number" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={() => onSave({ ...form, amount: Number(form.amount) })} disabled={!(Number(form.amount) > 0)}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({ open, onOpenChange, invoice, onSend, busy }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (open) {
      setTo(invoice.client?.email || '');
      setMessage('');
    }
  }, [open, invoice]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email invoice {invoice.number}</DialogTitle>
          <DialogDescription>Sent from your support mailbox with the PDF attached and a link to view it online.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="billing@client.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Message (optional)</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thanks for a great month!" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="gradient" disabled={!to || busy} onClick={() => onSend({ to, message })}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
