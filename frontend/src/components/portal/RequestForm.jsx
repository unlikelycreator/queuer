import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AttachButton, PendingFiles } from '@/components/shared/FileChips';
import useUploader from '@/lib/useUploader';
import { TICKET_TYPES } from '@/lib/constants';
import CustomFieldInput from '@/components/tickets/CustomFieldInput';
import { cn, apiError } from '@/lib/utils';
import { readIdentity, saveIdentity } from './PortalChrome';

const PRIORITIES = [
  { value: 'low', label: 'Low', hint: 'Whenever possible' },
  { value: 'medium', label: 'Normal', hint: 'Standard' },
  { value: 'high', label: 'Urgent', hint: 'Blocking work' },
];

/** The client-facing "new request" form, used inside the portal and the embeddable iframe. */
export default function RequestForm({ token, onSubmitted, compact = false, customFields = [] }) {
  const identity = readIdentity();
  const [values, setValues] = useState({});
  const [form, setForm] = useState({
    name: identity.name,
    email: identity.email,
    type: TICKET_TYPES[0]?.value,
    priority: 'medium',
    title: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const uploader = useUploader({ isPublic: true });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.submitPortalTicket(token, { ...form, customFields: values, files: uploader.files });
      saveIdentity({ name: form.name, email: form.email });
      uploader.reset();
      setForm((f) => ({ ...f, title: '', description: '' }));
      setValues({});
      onSubmitted?.(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Failed to submit your request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label>What do you need help with?</Label>
        <div className={cn('grid gap-2', compact ? 'grid-cols-2' : TICKET_TYPES.length === 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>
          {TICKET_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setForm({ ...form, type: t.value })}
              className={cn(
                'flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all',
                form.type === t.value ? 'border-primary bg-accent/50 shadow-soft' : 'border-border hover:border-primary/40'
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${t.color}1a`, color: t.color }}>
                <t.icon className="h-4 w-4" />
              </span>
              <span className="text-[13px] font-semibold leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rf-name">Your name</Label>
          <Input id="rf-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rf-email">Your email</Label>
          <Input
            id="rf-email"
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@company.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rf-title">Subject</Label>
        <Input
          id="rf-title"
          required
          maxLength={200}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Short summary, e.g. “Checkout button does nothing on mobile”"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rf-desc">Details</Label>
        <Textarea
          id="rf-desc"
          required
          rows={compact ? 4 : 6}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What happened? What did you expect? Steps to reproduce, links, browser/device…"
        />
      </div>

      {customFields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {customFields.map((f) => (
            <div key={f.key} className={f.type === 'checkbox' ? 'flex items-center justify-between rounded-lg border border-border px-3 py-2' : 'space-y-1.5'}>
              <Label>
                {f.label}
                {f.required && ' *'}
              </Label>
              <CustomFieldInput field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label>How urgent is it?</Label>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button
              type="button"
              key={p.value}
              onClick={() => setForm({ ...form, priority: p.value })}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                form.priority === p.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
              )}
            >
              {p.label} <span className="font-normal opacity-70">· {p.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-2">
          <AttachButton uploading={uploader.uploading} onPick={uploader.pick} label="Attach screenshots or files" className="border border-dashed border-border" />
          <PendingFiles files={uploader.files} onRemove={uploader.remove} />
        </div>
        <Button type="submit" variant="gradient" size="lg" disabled={submitting || uploader.uploading}>
          {submitting && <Loader2 className="animate-spin" />}
          Submit request
        </Button>
      </div>
    </form>
  );
}
