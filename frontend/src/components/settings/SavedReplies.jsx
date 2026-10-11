import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, MessageSquareText, Loader2, Lock, Users } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/Common';
import { apiError } from '@/lib/utils';

export const REPLY_VARIABLES = ['submitter_name', 'client_name', 'ticket_number', 'ticket_title', 'project_name', 'agent_name', 'company_name', 'tracking_link'];

export default function SavedReplies() {
  const [replies, setReplies] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => api.getSavedReplies().then((r) => setReplies(r.data)).catch(() => toast.error('Failed to load saved replies'));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Reusable answers for common questions — insert them from any ticket's composer. Variables fill in automatically.</p>
        <Button variant="gradient" onClick={() => setEditing({})}>
          <Plus /> New reply
        </Button>
      </div>
      {replies && replies.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="No saved replies yet" description="Save the answers you type every week." compact />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(replies || []).map((r) => (
            <Card key={r._id} className="flex flex-col p-4">
              <div className="flex items-start gap-2">
                <p className="flex-1 font-semibold">{r.title}</p>
                <Badge variant={r.shared ? 'info' : 'slate'}>
                  {r.shared ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />} {r.shared ? 'Team' : 'Private'}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-3 flex-1 whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Used {r.useCount}× · by {r.createdBy?.name}
                </span>
                <span className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label="Edit">
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    onClick={async () => {
                      try {
                        await api.deleteSavedReply(r._id);
                        load();
                      } catch (err) {
                        toast.error(apiError(err, 'Delete failed'));
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ReplyDialog reply={editing} onOpenChange={(v) => !v && setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function ReplyDialog({ reply, onOpenChange, onSaved }) {
  const [form, setForm] = useState({ title: '', body: '', shared: true });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (reply) setForm({ title: reply.title || '', body: reply.body || '', shared: reply.shared !== false });
  }, [reply]);

  const save = async () => {
    setSaving(true);
    try {
      if (reply?._id) await api.updateSavedReply(reply._id, form);
      else await api.createSavedReply(form);
      toast.success('Saved reply stored');
      onSaved();
    } catch (err) {
      toast.error(apiError(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!reply} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reply?._id ? 'Edit saved reply' : 'New saved reply'}</DialogTitle>
          <DialogDescription>Click a variable to insert it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fixed & deployed" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hi {{submitter_name}}, good news — {{ticket_number}} is fixed and live." />
            <div className="flex flex-wrap gap-1">
              {REPLY_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, body: `${form.body}{{${v}}}` })} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground">
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
            Share with the whole team
            <Switch checked={form.shared} onCheckedChange={(v) => setForm({ ...form, shared: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving || !form.title.trim() || !form.body.trim()}>
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
