import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, RefreshCw, ExternalLink, Globe, Code2, Eye, MessageSquare, LayoutDashboard, Loader2, ListTodo } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/Common';
import { apiError } from '@/lib/utils';

export function portalUrl(token) {
  return `${window.location.origin}/portal/${token}`;
}

/** Share + configure the client portal for a project (replaces the old embed-only dialog). */
export default function PortalShareDialog({ open, onOpenChange, project, onChanged }) {
  const [enabled, setEnabled] = useState(true);
  const [token, setToken] = useState('');
  const [portal, setPortal] = useState({
    showAllTickets: true,
    allowComments: true,
    showProjectDetails: true,
    showTodos: false,
    welcomeMessage: '',
  });
  const [regenOpen, setRegenOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (project) {
      setEnabled(project.publicFormEnabled ?? true);
      setToken(project.publicToken);
      setPortal({
        showAllTickets: project.portal?.showAllTickets ?? true,
        allowComments: project.portal?.allowComments ?? true,
        showProjectDetails: project.portal?.showProjectDetails ?? true,
        showTodos: project.portal?.showTodos ?? false,
        welcomeMessage: project.portal?.welcomeMessage || '',
      });
    }
  }, [project, open]);

  if (!project) return null;

  const url = portalUrl(token);
  const formUrl = `${window.location.origin}/public/form/${token}`;
  const iframe = `<iframe src="${formUrl}" style="width:100%;max-width:560px;height:760px;border:0;border-radius:16px;" title="Submit a request"></iframe>`;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const save = async (patch, msg) => {
    setBusy(true);
    try {
      await api.updateProject(project._id, patch);
      if (msg) toast.success(msg);
      onChanged?.();
    } catch (err) {
      toast.error(apiError(err, 'Failed to save'));
    } finally {
      setBusy(false);
    }
  };

  const setOption = (key, value) => {
    const next = { ...portal, [key]: value };
    setPortal(next);
    save(
      { portal: { [key]: value } },
      key === 'showTodos' ? (value ? 'To-do list is now visible in the portal' : 'To-do list hidden from the portal') : undefined
    );
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await api.regenerateProjectPublicToken(project._id);
      setToken(res.data.publicToken);
      toast.success('New link generated — the old one no longer works');
      setRegenOpen(false);
      onChanged?.();
    } catch (err) {
      toast.error(apiError(err, 'Failed to regenerate link'));
    } finally {
      setBusy(false);
    }
  };

  const OPTIONS = [
    { key: 'showProjectDetails', icon: LayoutDashboard, title: 'Show project overview', text: 'Status, timeline and progress stats.' },
    { key: 'showAllTickets', icon: Eye, title: 'Show all project tickets', text: 'Off = clients only see tickets they submitted (looked up by email).' },
    { key: 'allowComments', icon: MessageSquare, title: 'Allow client replies', text: 'Clients can reply on tickets and reopen resolved ones.' },
    {
      key: 'showTodos',
      icon: ListTodo,
      title: 'Show to-do list',
      text: 'Read-only daily plan: titles, dates, who and done/not done. Notes stay private.',
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Client portal
            </DialogTitle>
            <DialogDescription>
              One link for <span className="font-medium text-foreground">{project.client?.name || 'your client'}</span> to submit requests,
              track every ticket's status, reply to your team and see project progress — no login needed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Portal is {enabled ? 'live' : 'disabled'}</p>
              <p className="text-xs text-muted-foreground">Turn off to block access and new submissions.</p>
            </div>
            <Switch
              checked={enabled}
              disabled={busy}
              onCheckedChange={(v) => {
                setEnabled(v);
                save({ publicFormEnabled: v }, v ? 'Portal enabled' : 'Portal disabled');
              }}
            />
          </div>

          <Tabs defaultValue="share">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="share">Share link</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="embed">Embed form</TabsTrigger>
            </TabsList>

            <TabsContent value="share" className="space-y-3 pt-2">
              <div className="rounded-xl border border-primary/25 bg-accent/40 p-4">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-accent-foreground">Portal link</Label>
                <div className="mt-2 flex gap-2">
                  <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs" />
                  <Button type="button" size="icon" variant="gradient" onClick={() => copy(url, 'Portal link')} aria-label="Copy portal link">
                    <Copy />
                  </Button>
                  <Button type="button" size="icon" variant="outline" asChild>
                    <a href={url} target="_blank" rel="noreferrer" aria-label="Open portal">
                      <ExternalLink />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Anyone with this link can access the portal.</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRegenOpen(true)}>
                  <RefreshCw /> Regenerate
                </Button>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Share the to-do list with this client</p>
                  <p className="text-xs text-muted-foreground">Adds a read-only “Plan” tab to the portal. More options under Settings.</p>
                </div>
                <Switch
                  checked={portal.showTodos}
                  disabled={busy}
                  onCheckedChange={(v) => setOption('showTodos', v)}
                  aria-label="Show to-do list in the client portal"
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-2 pt-2">
              {OPTIONS.map((o) => (
                <div key={o.key} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                  <o.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{o.text}</p>
                  </div>
                  <Switch checked={portal[o.key]} disabled={busy} onCheckedChange={(v) => setOption(o.key, v)} />
                </div>
              ))}
              <div className="space-y-1.5 pt-2">
                <Label>Welcome message</Label>
                <Textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Hi! Use this portal to report bugs or request changes — we usually reply within one business day."
                  value={portal.welcomeMessage}
                  onChange={(e) => setPortal({ ...portal, welcomeMessage: e.target.value })}
                />
                <div className="flex justify-end">
                  <Button size="sm" disabled={busy} onClick={() => save({ portal: { welcomeMessage: portal.welcomeMessage } }, 'Welcome message saved')}>
                    {busy && <Loader2 className="animate-spin" />} Save message
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="embed" className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Prefer a form inside the client's own website? Paste this snippet — submissions still show up in the portal.
              </p>
              <div className="relative">
                <Code2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <pre className="max-h-36 overflow-auto rounded-xl border border-border bg-secondary/40 p-3 pl-9 pr-20 font-mono text-[11px] whitespace-pre-wrap break-all">
                  {iframe}
                </pre>
                <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2" onClick={() => copy(iframe, 'Embed code')}>
                  <Copy /> Copy
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate the portal link?"
        description="The current portal link and any embedded forms using it will stop working immediately."
        onConfirm={regenerate}
        confirmLabel="Regenerate"
        loading={busy}
      />
    </>
  );
}
