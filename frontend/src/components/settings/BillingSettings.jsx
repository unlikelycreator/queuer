import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Upload, X } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import { cn, apiError } from '@/lib/utils';

const TEMPLATES = [
  { value: 'modern', label: 'Modern' },
  { value: 'classic', label: 'Classic' },
  { value: 'minimal', label: 'Minimal' },
];
const ACCENTS = ['#047857', '#0f766e', '#1d4ed8', '#4338ca', '#7c3aed', '#be185d', '#b45309', '#111827'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CHF', 'ZAR', 'BRL'];

const SAMPLE = {
  number: 'INV-1042',
  status: 'sent',
  issueDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 14 * 864e5).toISOString(),
  client: { name: 'Globex Retail', contactPerson: 'Joe Miller', email: 'billing@globex.com' },
  projectName: 'E-commerce Storefront',
  items: [
    { description: '#128 Checkout fix on iOS Safari', quantity: 3.5, unit: 'hrs', unitPrice: 80 },
    { description: '#131 Apple Pay integration (fixed price)', quantity: 1, unitPrice: 600 },
  ],
  amountPaid: 0,
};

export default function BillingSettings() {
  const { billing, apply, data } = useWorkspace();
  const [form, setForm] = useState(billing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setForm(billing), [billing]);

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateBilling(form);
      apply({ ...data, billing: res.data.billing });
      toast.success('Billing settings saved');
    } catch (err) {
      toast.error(apiError(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(png|jpe?g)$/i.test(file.name)) return toast.error('Use a PNG or JPG logo so it also appears on PDFs');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await api.uploadFiles(fd);
      setForm((f) => ({ ...f, logoUrl: res.data.files[0].url }));
    } catch (err) {
      toast.error(apiError(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  // Live preview with sample numbers.
  const rate = Number(form.taxRate) || 0;
  const subtotal = SAMPLE.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const tax = Math.round(subtotal * rate) / 100;
  const preview = { ...SAMPLE, number: `${form.invoicePrefix || ''}${form.nextInvoiceNumber || 1001}`, currency: form.currency, subtotal, taxRate: rate, taxLabel: form.taxLabel, taxAmount: tax, total: subtotal + tax, terms: form.paymentTermsDays ? `Payment due within ${form.paymentTermsDays} days.` : '' };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rates & tax</CardTitle>
            <CardDescription>Defaults for time tracking and new invoices.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <select value={form.currency} onChange={set('currency')} className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                {[...new Set([form.currency, ...CURRENCIES])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Default hourly rate</Label>
              <Input type="number" min="0" value={form.defaultHourlyRate} onChange={set('defaultHourlyRate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment terms (days)</Label>
              <Input type="number" min="0" value={form.paymentTermsDays} onChange={set('paymentTermsDays')} />
            </div>
            <div className="space-y-1.5">
              <Label>Tax label</Label>
              <Input value={form.taxLabel} onChange={set('taxLabel')} placeholder="VAT / GST / Tax" />
            </div>
            <div className="space-y-1.5">
              <Label>Tax rate %</Label>
              <Input type="number" min="0" value={form.taxRate} onChange={set('taxRate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice numbering</Label>
              <div className="flex gap-2">
                <Input className="w-20" value={form.invoicePrefix} onChange={set('invoicePrefix')} placeholder="INV-" />
                <Input type="number" min="1" value={form.nextInvoiceNumber} onChange={set('nextInvoiceNumber')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice look</CardTitle>
            <CardDescription>Theme, colour and logo used on screen, in emails and in the PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm({ ...form, template: t.value })}
                  className={cn('rounded-lg border-2 py-2.5 text-sm font-semibold', form.template === t.value ? 'border-primary bg-accent/40' : 'border-border hover:border-primary/40')}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, accentColor: c })}
                  className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-card', form.accentColor === c && 'ring-2 ring-foreground')}
                  style={{ backgroundColor: c }}
                  aria-label={`Accent ${c}`}
                />
              ))}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="color" value={form.accentColor} onChange={set('accentColor')} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" /> Custom
              </label>
            </div>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <div className="relative">
                  <img src={form.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg border border-border bg-white object-contain p-1" />
                  <button onClick={() => setForm({ ...form, logoUrl: '' })} className="absolute -right-2 -top-2 rounded-full bg-card p-0.5 shadow" aria-label="Remove logo">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">No logo</div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-semibold hover:bg-secondary">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload logo (PNG/JPG)
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={uploadLogo} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business details</CardTitle>
            <CardDescription>Printed in the invoice header.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Business name</Label>
              <Input value={form.businessName} onChange={set('businessName')} />
            </div>
            <div className="space-y-1.5">
              <Label>Tax / registration ID</Label>
              <Input value={form.taxId} onChange={set('taxId')} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.businessEmail} onChange={set('businessEmail')} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.businessPhone} onChange={set('businessPhone')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Textarea rows={2} value={form.businessAddress} onChange={set('businessAddress')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Payment instructions</Label>
              <Textarea rows={3} value={form.paymentInstructions} onChange={set('paymentInstructions')} placeholder="Bank: … · IBAN: … · or pay by card at …" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Footer note</Label>
              <Input value={form.footerNote} onChange={set('footerNote')} />
            </div>
          </CardContent>
        </Card>

        <Button variant="gradient" onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Save billing settings
        </Button>
      </div>

      <div className="2xl:sticky 2xl:top-4 2xl:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Live preview</p>
        <div className="overflow-x-auto rounded-2xl bg-secondary/50 p-4">
          <InvoiceDocument
            inv={preview}
            template={form.template}
            accent={form.accentColor}
            business={{
              name: form.businessName || 'Your business',
              address: form.businessAddress,
              email: form.businessEmail,
              phone: form.businessPhone,
              taxId: form.taxId,
              logoUrl: form.logoUrl,
              paymentInstructions: form.paymentInstructions,
              footerNote: form.footerNote,
            }}
            className="min-w-[600px]"
          />
        </div>
      </div>
    </div>
  );
}
