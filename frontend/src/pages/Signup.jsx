import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function Signup() {
  const { registerOwner, googleAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [loading, setLoading] = useState(false);
  const [googleCompanyName, setGoogleCompanyName] = useState('');
  const [pendingGoogleToken, setPendingGoogleToken] = useState(null);

  const done = (data) => {
    if (data.twoFactorRequired) {
      navigate('/login', { state: { tempToken: data.tempToken } });
      return;
    }
    toast.success('Workspace created — welcome to ZoopDesk!', { duration: 5000 });
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
      done(await registerOwner(form));
    } catch (err) {
      toast.error(apiError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const finishGoogleSignup = async (e) => {
    e.preventDefault();
    if (!googleCompanyName.trim()) return toast.error('Please enter a company name');
    setLoading(true);
    try {
      done(await googleAuth({ idToken: pendingGoogleToken, mode: 'register', companyName: googleCompanyName }));
    } catch (err) {
      toast.error(apiError(err, 'Google sign-up failed'));
      setPendingGoogleToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Set up ZoopDesk for your studio in under a minute. You'll be the owner."
      footer={
        <>
          <p>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
          <p>
            Joining an existing team?{' '}
            <Link to="/join" className="font-semibold text-primary hover:underline">
              Use an invite code
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            required
            autoFocus
            placeholder="Acme Software Studio"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              required
              autoComplete="name"
              placeholder="Jordan Lee"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
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
          Create workspace
        </Button>
      </form>

      {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <>
          <Divider />
          {!pendingGoogleToken ? (
            <GoogleAuthButton onCredential={setPendingGoogleToken} text="signup_with" />
          ) : (
            <form onSubmit={finishGoogleSignup} className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-xs text-muted-foreground">One more step — name your company to finish signing up with Google.</p>
              <Input
                autoFocus
                required
                placeholder="Company name"
                value={googleCompanyName}
                onChange={(e) => setGoogleCompanyName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPendingGoogleToken(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gradient" size="sm" className="flex-1" disabled={loading}>
                  {loading ? 'Creating…' : 'Create workspace'}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </AuthShell>
  );
}
