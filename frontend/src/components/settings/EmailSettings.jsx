import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Mail, Loader2, CheckCircle2, XCircle, RefreshCw, Server, Clock, Send, Filter, Bell } from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';

const emptyImap = { host: '', port: 993, secure: true, username: '', password: '', folder: 'INBOX' };
const emptySmtp = { host: '', port: 587, secure: false };

export default function EmailSettings() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [imapTestResult, setImapTestResult] = useState(null);

  const [supportEmail, setSupportEmail] = useState('');
  const [intakeEnabled, setIntakeEnabled] = useState(false);
  const [defaultProject, setDefaultProject] = useState('none');
  const [imap, setImap] = useState(emptyImap);
  const [smtp, setSmtp] = useState(emptySmtp);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [assignmentNotificationsEnabled, setAssignmentNotificationsEnabled] = useState(true);
  const [keywordFilterEnabled, setKeywordFilterEnabled] = useState(true);
  const [keywordsInput, setKeywordsInput] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getCompany(), api.getProjects({ limit: 500 })])
      .then(([c, p]) => {
        const d = c.data;
        setCompany(d);
        setProjects(p.data.items);
        setSupportEmail(d.supportEmail || '');
        setIntakeEnabled(d.emailIntakeEnabled);
        setDefaultProject(d.defaultEmailProject?._id || 'none');
        setImap({
          host: d.emailImap?.host || '',
          port: d.emailImap?.port || 993,
          secure: d.emailImap?.secure ?? true,
          username: d.emailImap?.username || '',
          password: '',
          folder: d.emailImap?.folder || 'INBOX',
        });
        setSmtp({
          host: d.emailSmtp?.host || '',
          port: d.emailSmtp?.port || 587,
          secure: d.emailSmtp?.secure ?? false,
        });
        setAutoReplyEnabled(d.emailNotifications?.autoReplyEnabled ?? true);
        setAssignmentNotificationsEnabled(d.emailNotifications?.assignmentNotificationsEnabled ?? true);
        setKeywordFilterEnabled(d.emailKeywordFilter?.enabled ?? true);
        setKeywordsInput((d.emailKeywordFilter?.keywords || []).join(', '));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleTestImap = async () => {
    if (!imap.host || !imap.username || !imap.password) {
      toast.error('Fill in host, username and password to test the connection');
      return;
    }
    setTestingImap(true);
    setImapTestResult(null);
    try {
      const res = await api.testImapConnection(imap);
      setImapTestResult(res.data);
      if (res.data.success) toast.success('Connected successfully!');
    } catch (err) {
      setImapTestResult(err.response?.data || { success: false, message: 'Connection failed' });
    } finally {
      setTestingImap(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const res = await api.testSmtp();
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test email — save your settings first');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.updateCompany({
        supportEmail,
        emailIntakeEnabled: intakeEnabled,
        defaultEmailProject: defaultProject === 'none' ? null : defaultProject,
        imap,
        smtp,
        notifications: {
          autoReplyEnabled,
          assignmentNotificationsEnabled,
        },
        keywordFilter: {
          enabled: keywordFilterEnabled,
          keywords: keywordsInput.split(',').map((k) => k.trim()).filter(Boolean),
        },
      });
      setCompany(res.data);
      setImap((prev) => ({ ...prev, password: '' }));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckNow = async () => {
    setCheckingNow(true);
    try {
      const res = await api.checkEmailNow();
      setCompany(res.data);
      if (!res.data.emailLastError) {
        toast.success('Mailbox checked — matching emails are now tickets');
      } else {
        toast.error(res.data.emailLastError);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check mailbox');
    } finally {
      setCheckingNow(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl">

      <form onSubmit={handleSave} className="space-y-6">
        {/* Mailbox connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Support mailbox
            </CardTitle>
            <CardDescription>
              Give Queuer the login for a mailbox you control (your own domain's{' '}
              <span className="font-mono">support@yourdomain.com</span>, a Gmail account with an app password,
              anything IMAP-accessible). The backend checks it directly on its own — no external relay service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Support email address (shown across the app)</Label>
              <Input
                type="email"
                placeholder="support@ezeelink.net"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                disabled={!canManage}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Email intake {intakeEnabled ? 'enabled' : 'disabled'}</p>
                <p className="text-xs text-muted-foreground">Turn off to pause creating tickets from incoming email.</p>
              </div>
              <Switch checked={intakeEnabled} onCheckedChange={setIntakeEnabled} disabled={!canManage} />
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4 text-muted-foreground" /> Incoming mail (IMAP) — for reading email
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">IMAP host</Label>
                  <Input placeholder="imap.yourdomain.com or imap.gmail.com" value={imap.host} onChange={(e) => setImap({ ...imap, host: e.target.value })} disabled={!canManage} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Port</Label>
                  <Input type="number" value={imap.port} onChange={(e) => setImap({ ...imap, port: Number(e.target.value) })} disabled={!canManage} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Security</Label>
                  <Select value={imap.secure ? 'ssl' : 'starttls'} onValueChange={(v) => setImap({ ...imap, secure: v === 'ssl' })} disabled={!canManage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ssl">SSL/TLS (993)</SelectItem>
                      <SelectItem value="starttls">STARTTLS (143)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Username</Label>
                  <Input placeholder="support@yourdomain.com" value={imap.username} onChange={(e) => setImap({ ...imap, username: e.target.value })} disabled={!canManage} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Password {company?.emailImap?.hasPassword && <span className="text-emerald-600 dark:text-emerald-400">(saved)</span>}
                  </Label>
                  <Input type="password" placeholder={company?.emailImap?.hasPassword ? '•••••••• (leave blank to keep)' : 'App password'} value={imap.password} onChange={(e) => setImap({ ...imap, password: e.target.value })} disabled={!canManage} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Folder to watch</Label>
                  <Input value={imap.folder} onChange={(e) => setImap({ ...imap, folder: e.target.value })} disabled={!canManage} />
                </div>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={handleTestImap} disabled={testingImap}>
                    {testingImap ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Test connection
                  </Button>
                  {imapTestResult && (
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${imapTestResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {imapTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {imapTestResult.message}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Send className="h-4 w-4 text-muted-foreground" /> Outgoing mail (SMTP) — for replies &amp; notifications
              </p>
              <p className="text-xs text-muted-foreground -mt-2">Uses the same username/password as above — just tell us the SMTP host.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">SMTP host</Label>
                  <Input placeholder="smtp.yourdomain.com or smtp.gmail.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} disabled={!canManage} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Port</Label>
                  <Input type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} disabled={!canManage} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Security</Label>
                  <Select value={smtp.secure ? 'ssl' : 'starttls'} onValueChange={(v) => setSmtp({ ...smtp, secure: v === 'ssl' })} disabled={!canManage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starttls">STARTTLS (587)</SelectItem>
                      <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {canManage && (
                <Button type="button" variant="outline" size="sm" onClick={handleTestSmtp} disabled={testingSmtp}>
                  {testingSmtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Send test email to myself
                </Button>
              )}
            </div>

            {(company?.emailLastCheckedAt || company?.emailLastError) && (
              <div className="flex flex-col gap-1 rounded-lg bg-secondary/50 px-4 py-3 text-xs">
                {company.emailLastCheckedAt && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Last checked {formatDateTime(company.emailLastCheckedAt)}
                  </span>
                )}
                {company.emailLastError ? (
                  <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400"><XCircle className="h-3 w-3" /> {company.emailLastError}</span>
                ) : (
                  company.emailIntakeEnabled && <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Mailbox is healthy</span>
                )}
              </div>
            )}

            {canManage && (
              <Button type="button" variant="outline" onClick={handleCheckNow} disabled={checkingNow || !company?.emailImap?.hasPassword}>
                {checkingNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Check mailbox now
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Keyword filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Which emails become tickets
            </CardTitle>
            <CardDescription>
              Only turn an email into a ticket when its subject contains one of these words — so a mailbox that
              also gets general mail doesn't turn everything into a ticket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Keyword filter {keywordFilterEnabled ? 'on' : 'off'}</p>
                <p className="text-xs text-muted-foreground">Turn off to create a ticket from every incoming email, regardless of subject.</p>
              </div>
              <Switch checked={keywordFilterEnabled} onCheckedChange={setKeywordFilterEnabled} disabled={!canManage} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trigger words (comma separated, matched anywhere in the subject)</Label>
              <Input
                placeholder="support, bug, help, issue, feature, request, ticket"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                disabled={!canManage || !keywordFilterEnabled}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {keywordsInput.split(',').map((k) => k.trim()).filter(Boolean).map((k) => (
                  <Badge key={k} variant="slate">{k}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Example: an email titled "Need Help with login" matches "help". Emails matching none of these are
                left as-is in the mailbox (marked read, no ticket created).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Automated notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Auto-reply to the client</p>
                <p className="text-xs text-muted-foreground">"We've received your message, our team will get back to you at the earliest" — sent the moment a ticket is created from email.</p>
              </div>
              <Switch checked={autoReplyEnabled} onCheckedChange={setAutoReplyEnabled} disabled={!canManage} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Notify teammate on assignment</p>
                <p className="text-xs text-muted-foreground">Email a team member the moment a ticket is assigned to them.</p>
              </div>
              <Switch checked={assignmentNotificationsEnabled} onCheckedChange={setAssignmentNotificationsEnabled} disabled={!canManage} />
            </div>
          </CardContent>
        </Card>

        {/* Fallback project */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallback project for unmatched emails</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={defaultProject} onValueChange={setDefaultProject} disabled={!canManage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Auto-create "General Support" inbox</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.name} — {p.client?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              We first try to match the sender's email to one of your clients. If that fails, the ticket lands here.
            </p>
          </CardContent>
        </Card>

        {canManage && (
          <Button type="submit" variant="gradient" size="lg" disabled={saving}>
            {saving ? 'Saving...' : 'Save all settings'}
          </Button>
        )}
      </form>
    </div>
  );
}
