import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/auth/AuthShell';
import PasswordInput, { passwordIsValid } from '@/components/auth/PasswordInput';
import { apiError } from '@/lib/utils';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ checking: true, valid: false, email: '' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .checkResetToken(token)
      .then((res) => setState({ checking: false, valid: true, email: res.data.email }))
      .catch(() => setState({ checking: false, valid: false, email: '' }));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!passwordIsValid(password)) return toast.error('Use at least 8 characters with a letter and a number');
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      await api.resetPassword(token, { password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      toast.error(apiError(err, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  const Icon = done ? CheckCircle2 : state.valid ? KeyRound : AlertTriangle;

  return (
    <AuthShell>
      {state.checking ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
            <Icon className="h-6 w-6" />
          </div>
          {done ? (
            <>
              <h2 className="font-display text-3xl font-bold tracking-tight">Password updated</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You've been signed out everywhere else. Redirecting you to log in…
              </p>
            </>
          ) : !state.valid ? (
            <>
              <h2 className="font-display text-3xl font-bold tracking-tight">Link expired</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This reset link is invalid or has already been used. Request a new one to continue.
              </p>
              <Button asChild variant="gradient" size="lg" className="mt-6 w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl font-bold tracking-tight">Choose a new password</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                For <span className="font-semibold text-foreground">{state.email}</span>
              </p>
              <form onSubmit={submit} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    autoFocus
                    showStrength
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </AuthShell>
  );
}
