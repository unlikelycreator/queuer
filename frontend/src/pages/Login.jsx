import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoogleAuthButton from '@/components/shared/GoogleAuthButton';
import AuthShell, { Divider } from '@/components/auth/AuthShell';
import PasswordInput from '@/components/auth/PasswordInput';
import OtpInput from '@/components/auth/OtpInput';
import { apiError } from '@/lib/utils';

export default function Login() {
  const { login, googleAuth, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  // Set when the account has 2FA — we then swap the form for the code step.
  const [tempToken, setTempToken] = useState(location.state?.tempToken || null);

  const onAuthResult = (data) => {
    if (data.twoFactorRequired) {
      setTempToken(data.tempToken);
      return;
    }
    toast.success(`Welcome back, ${data.name?.split(' ')[0] || ''}!`);
    navigate(redirectTo, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      onAuthResult(await login(form));
    } catch (err) {
      toast.error(apiError(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (idToken) => {
    try {
      onAuthResult(await googleAuth({ idToken, mode: 'login' }));
    } catch (err) {
      toast.error(apiError(err, 'Google sign-in failed'));
    }
  };

  if (tempToken) {
    return (
      <TwoFactorStep
        tempToken={tempToken}
        onBack={() => setTempToken(null)}
        onVerify={verifyTwoFactor}
        onSuccess={(data) => {
          if (data.backupCodesRemaining !== undefined) {
            toast(`Backup code used — ${data.backupCodesRemaining} left. Consider generating new ones.`, { icon: '🔐', duration: 6000 });
          }
          onAuthResult(data);
        }}
      />
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your ZoopDesk workspace."
      footer={
        <>
          <p>
            New here?{' '}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create a workspace
            </Link>
          </p>
          <p>
            Have an invite code?{' '}
            <Link to="/join" className="font-semibold text-primary hover:underline">
              Join your team
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Log in
        </Button>
      </form>

      {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <>
          <Divider />
          <GoogleAuthButton onCredential={handleGoogle} />
        </>
      )}
    </AuthShell>
  );
}

function TwoFactorStep({ tempToken, onBack, onVerify, onSuccess }) {
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (value = code) => {
    if (!value || (!useBackup && value.length !== 6)) return;
    setLoading(true);
    try {
      onSuccess(await onVerify({ tempToken, code: value }));
    } catch (err) {
      toast.error(apiError(err, 'Verification failed'));
      setCode('');
      if (err.response?.status === 401 && /sign-in session/i.test(apiError(err))) onBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <button onClick={onBack} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </button>
      <div className="mb-7">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
          {useBackup ? <KeyRound className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Two-step verification</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {useBackup
            ? 'Enter one of the backup codes you saved when you turned on 2FA.'
            : 'Open your authenticator app and enter the 6-digit code for ZoopDesk.'}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        {useBackup ? (
          <Input
            autoFocus
            placeholder="XXXXX-XXXXX"
            className="h-12 text-center font-mono text-lg uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        ) : (
          <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={loading} />
        )}
        <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading || !code}>
          {loading && <Loader2 className="animate-spin" />}
          Verify & continue
        </Button>
      </form>
      <button
        type="button"
        onClick={() => {
          setUseBackup((v) => !v);
          setCode('');
        }}
        className="mt-6 w-full text-center text-sm font-semibold text-primary hover:underline"
      >
        {useBackup ? 'Use authenticator app instead' : 'Lost your device? Use a backup code'}
      </button>
    </AuthShell>
  );
}
