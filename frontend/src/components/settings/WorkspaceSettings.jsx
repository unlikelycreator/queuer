import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Plus, Trash2, Loader2, GripVertical, Wand2 } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/Common';
import { TYPE_ICONS, WORKSPACE_ICONS, CUSTOM_FIELD_TYPES } from '@/lib/constants';
import { cn, apiError } from '@/lib/utils';

const ICON_CHOICES = Object.keys(TYPE_ICONS);
const COLOR_CHOICES = ['#e11d48', '#ea580c', '#d97706', '#65a30d', '#0d9488', '#0284c7', '#4f46e5', '#7c3aed', '#db2777', '#475569'];

/** Pick a team template — used both in Settings and in the first-run setup dialog. */
export function TemplatePicker({ onApplied, compact = false }) {
  const { templates, workspace, apply } = useWorkspace();
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);

  const run = async (key) => {
    setBusy(key);
    try {
      const res = await api.applyWorkspaceTemplate({ key, keepFields: false });
      apply(res.data);
      toast.success(`Workspace set up for ${templates.find((t) => t.key === key)?.name}`);
      onApplied?.(key);
    } catch (err) {
      toast.error(apiError(err, 'Could not apply template'));
    } finally {
      setBusy('');
      setConfirm(null);
    }
  };

  return (
    <>
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-5')}>
        {templates.map((t) => {
          const Icon = WORKSPACE_ICONS[t.icon] || Wand2;
          const active = workspace?.configured && workspace?.template === t.key;
          return (
            <button
              key={t.key}
              onClick={() => (workspace?.configured && !compact ? setConfirm(t) : run(t.key))}
              disabled={!!busy}
              className={cn(
                'group relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft',
                active ? 'border-primary bg-accent/40' : 'border-border hover:border-primary/40'
              )}
            >
              {active && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-soft">
                {busy === t.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="font-semibold">{t.name}</span>
              <span className="mt-1 text-xs text-muted-foreground">{t.description}</span>
              <span className="mt-3 flex flex-wrap gap-1">
                {t.ticketTypes.slice(0, 4).map((tt) => (
                  <span key={tt.value} className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${tt.color}1a`, color: tt.color }}>
                    {tt.short || tt.label}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Switch to “${confirm?.name}”?`}
        description="Wording, ticket types, custom fields and SLA targets are replaced with the template's. Existing tickets keep their data, and types still in use are kept."
        confirmLabel="Apply template"
        destructive={false}
        loading={!!busy}
        onConfirm={() => run(confirm.key)}
      />
    </>
  );
}

export default function WorkspaceSettings() {
  const { workspace, apply } = useWorkspace();
  const [terms, setTerms] = useState(workspace.terminology);
  const [types, setTypes] = useState(workspace.ticketTypes);
  const [fields, setFields] = useState(workspace.customFields);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    setTerms(workspace.terminology);
    setTypes(workspace.ticketTypes);
    setFields(workspace.customFields);
  }, [workspace]);

  const save = async (key, body, msg) => {
    setSaving(key);
    try {
      const res = await api.updateWorkspace(body);
      apply(res.data);
      toast.success(msg);
    } catch (err) {
      toast.error(apiError(err, 'Could not save'));
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What is this workspace for?</CardTitle>
          <CardDescription>One click sets the wording, ticket types, custom fields and SLA targets for your kind of team. You can fine-tune everything below.</CardDescription>
        </CardHeader>
        <CardContent>
          <TemplatePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wording</CardTitle>
          <CardDescription>What your team calls things — used across the app and the client portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['ticket', 'tickets', 'Ticket'],
              ['client', 'clients', 'Client'],
              ['project', 'projects', 'Project'],
            ].map(([one, many, label]) => (
              <div key={one} className="space-y-1.5">
                <Label>{label} (singular / plural)</Label>
                <div className="flex gap-2">
                  <Input value={terms[one]} onChange={(e) => setTerms({ ...terms, [one]: e.target.value })} />
                  <Input value={terms[many]} onChange={(e) => setTerms({ ...terms, [many]: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => save('terms', { terminology: terms }, 'Wording updated')} disabled={saving === 'terms'}>
            {saving === 'terms' && <Loader2 className="animate-spin" />} Save wording
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{terms.ticket} types</CardTitle>
          <CardDescription>The categories people pick when filing a {terms.ticket.toLowerCase()} (also shown in the client portal).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {types.map((t, i) => {
            const Icon = TYPE_ICONS[t.icon] || TYPE_ICONS.circle;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${t.color}1a`, color: t.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <Input className="w-48 flex-1" value={t.label} onChange={(e) => setTypes(types.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Name" />
                <Input className="w-28" value={t.short || ''} onChange={(e) => setTypes(types.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)))} placeholder="Short" />
                <Select value={t.icon} onValueChange={(v) => setTypes(types.map((x, j) => (j === i ? { ...x, icon: v } : x)))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_CHOICES.map((k) => {
                      const I = TYPE_ICONS[k];
                      return (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            <I className="h-3.5 w-3.5" /> {k}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setTypes(types.map((x, j) => (j === i ? { ...x, color: c } : x)))}
                      className={cn('h-5 w-5 rounded-full', t.color === c && 'ring-2 ring-foreground ring-offset-2 ring-offset-card')}
                      style={{ backgroundColor: c }}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                </div>
                <Button variant="ghost" size="icon-sm" disabled={types.length === 1} onClick={() => setTypes(types.filter((_, j) => j !== i))} aria-label="Remove type">
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTypes([...types, { value: '', label: '', short: '', icon: 'circle', color: '#0d9488' }])} disabled={types.length >= 20}>
              <Plus /> Add type
            </Button>
            <Button size="sm" onClick={() => save('types', { ticketTypes: types }, 'Types updated')} disabled={saving === 'types'}>
              {saving === 'types' && <Loader2 className="animate-spin" />} Save types
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom fields</CardTitle>
          <CardDescription>
            Extra details captured on every {terms.ticket.toLowerCase()} — build numbers, order IDs, channels, publish dates… Tick “Portal” to ask clients for it too.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && <p className="text-sm text-muted-foreground">No custom fields yet.</p>}
          {fields.map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input className="min-w-[160px] flex-1" value={f.label} onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Field name" />
                <Select value={f.type} onValueChange={(v) => setFields(fields.map((x, j) => (j === i ? { ...x, type: v } : x)))}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs font-medium">
                  <Switch checked={!!f.required} onCheckedChange={(v) => setFields(fields.map((x, j) => (j === i ? { ...x, required: v } : x)))} /> Required
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium">
                  <Switch checked={!!f.showInPortal} onCheckedChange={(v) => setFields(fields.map((x, j) => (j === i ? { ...x, showInPortal: v } : x)))} /> Portal
                </label>
                <Button variant="ghost" size="icon-sm" onClick={() => setFields(fields.filter((_, j) => j !== i))} aria-label="Remove field">
                  <Trash2 />
                </Button>
              </div>
              {f.type === 'select' && (
                <Input
                  value={Array.isArray(f.options) ? f.options.join(', ') : f.options}
                  onChange={(e) => setFields(fields.map((x, j) => (j === i ? { ...x, options: e.target.value.split(',').map((o) => o.trimStart()) } : x)))}
                  placeholder="Options, comma separated"
                />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setFields([...fields, { key: '', label: '', type: 'text', options: [], required: false, showInPortal: false }])}>
              <Plus /> Add field
            </Button>
            <Button
              size="sm"
              onClick={() =>
                save(
                  'fields',
                  { customFields: fields.map((f) => ({ ...f, options: (f.options || []).map((o) => o.trim()).filter(Boolean) })) },
                  'Custom fields updated'
                )
              }
              disabled={saving === 'fields'}
            >
              {saving === 'fields' && <Loader2 className="animate-spin" />} Save fields
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SlaSettings() {
  const { sla, csatEnabled, apply } = useWorkspace();
  const [form, setForm] = useState(sla);
  const [csat, setCsat] = useState(csatEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(sla);
    setCsat(csatEnabled);
  }, [sla, csatEnabled]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateWorkspace({ sla: form, csatEnabled: csat });
      apply(res.data);
      toast.success('SLA & ratings saved');
    } catch (err) {
      toast.error(apiError(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Service-level targets</CardTitle>
            <CardDescription>
              How fast your team commits to respond and resolve, per priority. Breaches are flagged, notified, counted in Insights and can trigger automations.
            </CardDescription>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} aria-label="Enable SLAs" />
        </CardHeader>
        <CardContent className={cn('space-y-2', !form.enabled && 'pointer-events-none opacity-50')}>
          <div className="grid grid-cols-[100px_1fr_1fr] gap-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Priority</span>
            <span>First response (hours)</span>
            <span>Resolution (hours)</span>
          </div>
          {['critical', 'high', 'medium', 'low'].map((p) => (
            <div key={p} className="grid grid-cols-[100px_1fr_1fr] items-center gap-3">
              <span className="text-sm font-semibold capitalize">{p}</span>
              {['responseHours', 'resolutionHours'].map((k) => (
                <Input
                  key={k}
                  type="number"
                  min="0"
                  value={form[p]?.[k] ?? ''}
                  onChange={(e) => setForm({ ...form, [p]: { ...form[p], [k]: e.target.value } })}
                />
              ))}
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">Targets apply to new tickets and when a ticket's priority changes. Use 0 for no target.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Client satisfaction (CSAT)</CardTitle>
            <CardDescription>After a request is resolved, clients can rate it 1–5 stars on their tracking page. Ratings feed the Insights dashboard and team leaderboard.</CardDescription>
          </div>
          <Switch checked={csat} onCheckedChange={setCsat} aria-label="Enable CSAT" />
        </CardHeader>
      </Card>

      <Button variant="gradient" onClick={save} disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Save SLA & ratings
      </Button>
    </div>
  );
}
