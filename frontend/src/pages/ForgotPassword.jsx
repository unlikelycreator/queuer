import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import * as api from '@/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/auth/AuthShell';
import { apiError } from '@/lib/utils';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      toast.error(apiError(err, 'Could not send reset email'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Link to="/login" className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>
      {sent ? (
        <div className="animate-fade-in">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
            <MailCheck className="h-6 w-6" />
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Check your inbox</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            If an account exists for <span className="font-semibold text-foreground">{email}</span>, we've sent a link to
            reset your password. It expires in 30 minutes.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Didn't get it? Check spam, or{' '}
            <button onClick={() => setSent(false)} className="font-semibold text-primary hover:underline">
              try again
            </button>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mb-7">
            <h2 className="font-display text-3xl font-bold tracking-tight">Forgot your password?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Enter your email and we'll send you a secure reset link.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
