import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, X } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { TICKET_TYPES, TICKET_PRIORITIES } from '@/lib/constants';
import { useWorkspace } from '@/context/WorkspaceContext';
import CustomFieldInput from '@/components/tickets/CustomFieldInput';

const emptyForm = {
  project: '',
  title: '',
  description: '',
  type: 'bug_report',
  priority: 'medium',
  assignedTo: 'unassigned',
  tags: '',
  dueDate: '',
  estimateHours: '',
  fixedPrice: '',
  customFields: {},
};

export default function TicketFormDialog({ open, onOpenChange, defaultProjectId, lockProject, onSaved }) {
  const { terms, customFields, billing } = useWorkspace();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([api.getProjects({ limit: 500 }), api.getUsers()]).then(([p, u]) => {
        setProjects(p.data.items);
        setUsers(u.data);
      });
      setForm({ ...emptyForm, type: TICKET_TYPES[0]?.value || 'task', customFields: {}, project: defaultProjectId || '' });
      setFiles([]);
    }
  }, [open, defaultProjectId]);

  const handleFilePick = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append('files', f));
      const res = await api.uploadFiles(fd);
      setFiles((prev) => [...prev, ...res.data.files]);
    } catch {
      toast.error('Some files failed to upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (filename) => setFiles((prev) => prev.filter((f) => f.filename !== filename));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project) {
      toast.error('Please select a project');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        assignedTo: form.assignedTo === 'unassigned' ? undefined : form.assignedTo,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        dueDate: form.dueDate || undefined,
        estimateHours: form.estimateHours || undefined,
        fixedPrice: form.fixedPrice || undefined,
        files,
      };
      const res = await api.createTicket(payload);
      toast.success(`Ticket #${res.data.ticketNumber} created`);
      onOpenChange(false);
      onSaved?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New {terms.ticket.toLowerCase()}</DialogTitle>
          <DialogDescription>{TICKET_TYPES.map((t) => t.label).join(' · ')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>{terms.project} *</Label>
              <Select value={form.project} onValueChange={(v) => setForm({ ...form, project: v })} disabled={lockProject}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select a ${terms.project.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name} {p.client?.name ? `— ${p.client.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Title *</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short, clear summary" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="All the context someone needs to pick this up — what, why, links, expected outcome…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Assign to</Label>
              <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="urgent, q4" />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            {customFields.map((f) => (
              <div key={f.key} className={f.type === 'checkbox' ? 'flex items-center justify-between rounded-lg border border-border px-3 py-2' : 'space-y-1.5'}>
                <Label>
                  {f.label}
                  {f.required && ' *'}
                </Label>
                <CustomFieldInput
                  field={f}
                  value={form.customFields[f.key]}
                  onChange={(v) => setForm((prev) => ({ ...prev, customFields: { ...prev.customFields, [f.key]: v } }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Estimate (hours)</Label>
              <Input type="number" min="0" step="0.5" value={form.estimateHours} onChange={(e) => setForm({ ...form, estimateHours: e.target.value })} placeholder="e.g. 4" />
            </div>
            <div className="space-y-1.5">
              <Label>Fixed price ({billing.currency}) — optional</Label>
              <Input type="number" min="0" value={form.fixedPrice} onChange={(e) => setForm({ ...form, fixedPrice: e.target.value })} placeholder="Quote instead of hours" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Attachments</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/50">
                <Paperclip className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Attach files'}
                <input type="file" multiple className="hidden" onChange={handleFilePick} disabled={uploading} />
              </label>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {files.map((f) => (
                    <span key={f.filename} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                      {f.originalName}
                      <button type="button" onClick={() => removeFile(f.filename)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={saving || uploading}>
              {saving ? 'Creating...' : `Create ${terms.ticket.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
