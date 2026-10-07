import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoogleAuthButton from '@/components/shared/GoogleAuthButton';
import AuthShell, { Divider } from '@/components/auth/AuthShell';
import PasswordInput, { passwordIsValid } from '@/components/auth/PasswordInput';
import { apiError } from '@/lib/utils';

export default function Join() {
  const { joinCompany, googleAuth } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: params.get('code') || '' });
  const [loading, setLoading] = useState(false);

  const done = (data) => {
    if (data.twoFactorRequired) {
      navigate('/login', { state: { tempToken: data.tempToken } });
      return;
    }
    toast.success('You joined the team!');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordIsValid(form.password)) {
      toast.error('Use at least 8 characters with a letter and a number');
      return;
    }
    setLoading(true);
    try {
      done(await joinCompany(form));
    } catch (err) {
      toast.error(apiError(err, 'Failed to join'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (idToken) => {
    if (!form.inviteCode.trim()) {
      toast.error('Enter your invite code first, then continue with Google');
      return;
    }
    setLoading(true);
    try {
      done(await googleAuth({ idToken, mode: 'join', inviteCode: form.inviteCode }));
    } catch (err) {
      toast.error(apiError(err, 'Google sign-in failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Join your team"
      subtitle="Enter the invite code your workspace owner shared with you."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="inviteCode">Invite code</Label>
          <Input
            id="inviteCode"
            required
            autoFocus={!form.inviteCode}
            placeholder="A1B2C3D4"
            className="font-mono uppercase tracking-[0.3em]"
            value={form.inviteCode}
            onChange={(e) => setForm({ ...form, inviteCode: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" required placeholder="Sam Carter" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            required
            showStrength
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Join team
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
