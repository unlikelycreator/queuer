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
import { apiError, cn } from '@/lib/utils';
import { WORKSPACE_ICONS } from '@/lib/constants';

// Mirrors the backend templates — sets wording, ticket types, fields and SLAs at signup.
const USE_CASES = [
  { key: 'software', name: 'Software dev', icon: 'code' },
  { key: 'qa', name: 'QA & testing', icon: 'flask' },
  { key: 'support', name: 'Customer support', icon: 'headset' },
  { key: 'marketing', name: 'Marketing', icon: 'megaphone' },
  { key: 'agency', name: 'Agency / other', icon: 'briefcase' },
];

export default function Signup() {
  const { registerOwner, googleAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', template: 'software' });
  const [loading, setLoading] = useState(false);
  const [googleCompanyName, setGoogleCompanyName] = useState('');
  const [pendingGoogleToken, setPendingGoogleToken] = useState(null);

  const done = (data) => {
    if (data.twoFactorRequired) {
      navigate('/login', { state: { tempToken: data.tempToken } });
      return;
    }
    toast.success('Workspace created — welcome to Queuer!', { duration: 5000 });
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
      subtitle="Set up Queuer for your studio in under a minute. You'll be the owner."
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
        <div className="space-y-2">
          <Label>What will your team use Queuer for?</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {USE_CASES.map((u) => {
              const Icon = WORKSPACE_ICONS[u.icon];
              return (
                <button
                  type="button"
                  key={u.key}
                  onClick={() => setForm({ ...form, template: u.key })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border-2 px-1 py-2.5 text-center text-[11px] font-semibold leading-tight transition-all',
                    form.template === u.key ? 'border-primary bg-accent/50 text-accent-foreground' : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  <Icon className="h-4 w-4" /> {u.name}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Sets your wording, request types, fields and SLAs — change anytime in Settings.</p>
        </div>
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
