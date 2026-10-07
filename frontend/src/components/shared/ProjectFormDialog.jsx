import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
import { PROJECT_STATUSES } from '@/lib/constants';

const emptyForm = {
  client: '',
  name: '',
  description: '',
  techStack: '',
  repoUrl: '',
  liveUrl: '',
  status: 'planning',
  startDate: '',
  deadline: '',
};

export default function ProjectFormDialog({ open, onOpenChange, editing, defaultClientId, lockClient, onSaved }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.getClients({ limit: 500 }).then((res) => setClients(res.data.items));
      if (editing) {
        setForm({
          client: editing.client?._id || editing.client || '',
          name: editing.name || '',
          description: editing.description || '',
          techStack: (editing.techStack || []).join(', '),
          repoUrl: editing.repoUrl || '',
          liveUrl: editing.liveUrl || '',
          status: editing.status || 'planning',
          startDate: editing.startDate ? editing.startDate.slice(0, 10) : '',
          deadline: editing.deadline ? editing.deadline.slice(0, 10) : '',
        });
      } else {
        setForm({ ...emptyForm, client: defaultClientId || '' });
      }
    }
  }, [open, editing, defaultClientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client) {
      toast.error('Please select a client');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        techStack: form.techStack
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (editing) {
        await api.updateProject(editing._id, payload);
        toast.success('Project updated');
      } else {
        await api.createProject(payload);
        toast.success('Project created');
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update project details.' : 'Set up a new project under a client.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Client *</Label>
              <Select
                value={form.client}
                onValueChange={(v) => setForm({ ...form, client: v })}
                disabled={lockClient}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
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
            <div className="col-span-2 space-y-1.5">
              <Label>Project name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Website Redesign" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief project overview..." />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tech stack (comma separated)</Label>
              <Input value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} placeholder="React, Node.js, MongoDB" />
            </div>
            <div className="space-y-1.5">
              <Label>Repository URL</Label>
              <Input value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} placeholder="github.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label>Live URL</Label>
              <Input value={form.liveUrl} onChange={(e) => setForm({ ...form, liveUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
