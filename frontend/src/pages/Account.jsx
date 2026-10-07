import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  ShieldOff,
  KeyRound,
  UserRound,
  Palette,
  Loader2,
  Copy,
  Download,
  Smartphone,
  Sun,
  Moon,
  Monitor,
  Check,
  RefreshCw,
} from 'lucide-react';
import * as api from '@/api/endpoints';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/Common';
import { UserAvatar } from '@/components/shared/UserAvatar';
import PasswordInput, { passwordIsValid } from '@/components/auth/PasswordInput';
import OtpInput from '@/components/auth/OtpInput';
import { apiError, cn, formatDate } from '@/lib/utils';

const AVATAR_COLORS = ['#10b981', '#0d9488', '#059669', '#65a30d', '#0891b2', '#d97706', '#e11d48', '#7c3aed'];

function Section({ icon: Icon, title, description, children, aside }) {
  return (
    <Card>
      <CardContent className="grid gap-6 p-6 md:grid-cols-[240px_1fr]">
        <div>
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {aside}
        </div>
        <div className="min-w-0">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function Account() {
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    refreshUser().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Account" title="Account & security" description="Manage your profile, sign-in methods and appearance." />
      <div className="space-y-5">
        <ProfileSection user={user} onSaved={refreshUser} />
        <PasswordSection user={user} />
        <TwoFactorSection user={user} onChanged={refreshUser} />
        <AppearanceSection />
      </div>
    </div>
  );
}

function ProfileSection({ user, onSaved }) {
  const [form, setForm] = useState({ name: '', jobTitle: '', avatarColor: '#10b981' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', jobTitle: user.jobTitle || '', avatarColor: user.avatarColor || '#10b981' });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateMe(form);
      await onSaved();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(apiError(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={UserRound} title="Profile" description="How you appear to your team and on client-facing replies.">
      <form onSubmit={save} className="space-y-5">
        <div className="flex items-center gap-4">
          <UserAvatar user={{ ...user, ...form }} size="xl" />
          <div>
            <p className="font-semibold">{form.name || 'Your name'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="lime" className="mt-1.5 capitalize">
              {user?.role}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Job title</Label>
            <Input value={form.jobTitle} placeholder="Full-stack developer" onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Avatar colour</Label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, avatarColor: c })}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110',
                  form.avatarColor === c && 'ring-2 ring-foreground'
                )}
                style={{ backgroundColor: c }}
                aria-label={`Use colour ${c}`}
              >
                {form.avatarColor === c && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="gradient" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save profile
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection({ user }) {
  const { replaceToken, refreshUser } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const hasPassword = user?.hasPassword !== false;

  const save = async (e) => {
    e.preventDefault();
    if (!passwordIsValid(form.newPassword)) return toast.error('Use at least 8 characters with a letter and a number');
    if (form.newPassword !== form.confirm) return toast.error("New passwords don't match");
    setSaving(true);
    try {
      const res = await api.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      replaceToken(res.data.token);
      await refreshUser();
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password updated — other sessions have been signed out');
    } catch (err) {
      toast.error(apiError(err, 'Failed to change password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      icon={KeyRound}
      title={hasPassword ? 'Password' : 'Set a password'}
      description={
        hasPassword
          ? 'Changing your password signs you out of every other device.'
          : 'You sign in with Google. Add a password to also log in with email.'
      }
    >
      <form onSubmit={save} className="max-w-md space-y-4">
        {hasPassword && (
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>New password</Label>
          <PasswordInput
            id="new-password"
            showStrength
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm new password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Update password
        </Button>
      </form>
    </Section>
  );
}

function downloadCodes(codes) {
  const blob = new Blob(
    [`ZoopDesk backup codes\nGenerated ${new Date().toLocaleString()}\n\nEach code can be used once.\n\n${codes.join('\n')}\n`],
    { type: 'text/plain' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zoopdesk-backup-codes.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

function BackupCodes({ codes }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-sm">
        {codes.map((c) => (
          <span key={c} className="rounded-md bg-card px-2 py-1 text-center tracking-wider">
            {c}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(codes.join('\n'));
            toast.success('Backup codes copied');
          }}
        >
          <Copy /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadCodes(codes)}>
          <Download /> Download .txt
        </Button>
      </div>
    </div>
  );
}

function TwoFactorSection({ user, onChanged }) {
  const enabled = !!user?.twoFactor?.enabled;
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  return (
    <Section
      icon={enabled ? ShieldCheck : ShieldOff}
      title="Two-factor authentication"
      description="Require a code from an authenticator app (Google Authenticator, Authy, 1Password…) when you log in."
    >
      <div
        className={cn(
          'flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center',
          enabled ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/30 bg-amber-500/[0.06]'
        )}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            enabled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
          )}
        >
          {enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{enabled ? '2FA is on' : '2FA is off'}</p>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? `Enabled ${user?.twoFactor?.enabledAt ? formatDate(user.twoFactor.enabledAt) : ''}. Your account is protected even if your password leaks.`
              : 'Anyone with your password can access your workspace. Turn this on in under a minute.'}
          </p>
        </div>
        {enabled ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
              <RefreshCw /> New backup codes
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDisableOpen(true)}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button variant="gradient" onClick={() => setSetupOpen(true)}>
            <Smartphone /> Set up 2FA
          </Button>
        )}
      </div>

      <SetupTwoFactorDialog open={setupOpen} onOpenChange={setSetupOpen} onDone={onChanged} />
      <DisableTwoFactorDialog open={disableOpen} onOpenChange={setDisableOpen} onDone={onChanged} />
      <RegenerateCodesDialog open={regenOpen} onOpenChange={setRegenOpen} />
    </Section>
  );
}

function SetupTwoFactorDialog({ open, onOpenChange, onDone }) {
  const [step, setStep] = useState('scan'); // scan -> verify -> codes
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('scan');
    setCode('');
    setCodes([]);
    setSetup(null);
    api
      .setupTwoFactor()
      .then((res) => setSetup(res.data))
      .catch((err) => {
        toast.error(apiError(err, 'Could not start 2FA setup'));
        onOpenChange(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setLoading(true);
    try {
      const res = await api.enableTwoFactor({ code: value });
      setCodes(res.data.backupCodes);
      setStep('codes');
      onDone?.();
    } catch (err) {
      toast.error(apiError(err, 'Invalid code'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (step === 'codes' && v === false ? onOpenChange(false) : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'codes' ? 'Save your backup codes' : 'Set up two-factor authentication'}
          </DialogTitle>
          <DialogDescription>
            {step === 'scan' && '1. Scan this QR code with your authenticator app.'}
            {step === 'verify' && '2. Enter the 6-digit code your app shows for ZoopDesk.'}
            {step === 'codes' &&
              "2FA is on. Store these somewhere safe — each one lets you sign in once if you lose your phone. You won't see them again."}
          </DialogDescription>
        </DialogHeader>

        {step === 'scan' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {setup ? (
                <img src={setup.qrCode} alt="2FA QR code" className="h-52 w-52 rounded-xl border border-border bg-white p-2" />
              ) : (
                <div className="h-52 w-52 animate-pulse rounded-xl bg-secondary" />
              )}
            </div>
            {setup && (
              <div className="space-y-1.5">
                <p className="text-center text-xs text-muted-foreground">Can't scan? Enter this key manually:</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(setup.secret);
                    toast.success('Key copied');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 font-mono text-xs tracking-wider hover:bg-secondary"
                >
                  {setup.secret.match(/.{1,4}/g).join(' ')} <Copy className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            )}
            <Button variant="gradient" className="w-full" disabled={!setup} onClick={() => setStep('verify')}>
              I've scanned it — continue
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-5">
            <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={loading} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('scan')}>
                Back
              </Button>
              <Button variant="gradient" className="flex-1" disabled={loading || code.length !== 6} onClick={() => verify()}>
                {loading && <Loader2 className="animate-spin" />} Verify & turn on
              </Button>
            </div>
          </div>
        )}

        {step === 'codes' && (
          <div className="space-y-4">
            <BackupCodes codes={codes} />
            <Button variant="gradient" className="w-full" onClick={() => onOpenChange(false)}>
              I've saved them
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisableTwoFactorDialog({ open, onOpenChange, onDone }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setCode('');
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.disableTwoFactor({ password: password || undefined, code: code || undefined });
      toast.success('Two-factor authentication turned off');
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      toast.error(apiError(err, 'Could not disable 2FA'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Turn off 2FA?</DialogTitle>
          <DialogDescription>Confirm with your password or a current authenticator code.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Password</Label>
            <PasswordInput id="disable-pw" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p className="text-center text-xs text-muted-foreground">— or —</p>
          <div className="space-y-1.5">
            <Label>Authenticator code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="font-mono tracking-widest" />
          </div>
          <Button type="submit" variant="destructive" className="w-full" disabled={loading || (!password && !code)}>
            {loading && <Loader2 className="animate-spin" />} Turn off 2FA
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegenerateCodesDialog({ open, onOpenChange }) {
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCode('');
      setCodes(null);
    }
  }, [open]);

  const submit = async (value = code) => {
    setLoading(true);
    try {
      const res = await api.regenerateBackupCodes({ code: value });
      setCodes(res.data.backupCodes);
    } catch (err) {
      toast.error(apiError(err, 'Invalid code'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{codes ? 'Your new backup codes' : 'Generate new backup codes'}</DialogTitle>
          <DialogDescription>
            {codes ? 'Your old codes no longer work.' : 'Enter a code from your authenticator app to confirm.'}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <>
            <BackupCodes codes={codes} />
            <Button variant="gradient" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={loading} />
            <Button variant="gradient" className="w-full" disabled={loading || code.length !== 6} onClick={() => submit()}>
              {loading && <Loader2 className="animate-spin" />} Generate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light', label: 'Light', icon: Sun, preview: 'bg-[#f6f9f6]', bar: 'bg-[#0b2a1f]' },
    { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#0a1210]', bar: 'bg-[#050a08]' },
    { value: 'system', label: 'System', icon: Monitor, preview: 'bg-gradient-to-r from-[#f6f9f6] from-50% to-[#0a1210] to-50%', bar: 'bg-[#0b2a1f]' },
  ];
  return (
    <Section icon={Palette} title="Appearance" description="Pick a theme. 'System' follows your device setting.">
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => setTheme(o.value)}
            className={cn(
              'group rounded-xl border-2 p-2 text-left transition-all',
              theme === o.value ? 'border-primary shadow-soft' : 'border-border hover:border-primary/40'
            )}
          >
            <div className={cn('relative flex h-20 overflow-hidden rounded-lg border border-border', o.preview)}>
              <div className={cn('h-full w-1/4', o.bar)} />
              <div className="flex-1 space-y-1.5 p-2">
                <div className="h-2 w-2/3 rounded bg-emerald-500/70" />
                <div className="h-1.5 w-1/2 rounded bg-slate-400/40" />
                <div className="h-1.5 w-3/4 rounded bg-slate-400/30" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 px-1 text-sm font-semibold">
              <o.icon className="h-4 w-4" /> {o.label}
              {theme === o.value && <Check className="ml-auto h-4 w-4 text-primary" />}
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}
