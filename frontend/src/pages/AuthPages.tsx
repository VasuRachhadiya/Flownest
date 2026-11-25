import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import { Button, Card, Input } from '@/components/ui/Primitives';

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate('/overview');
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Demo@12345!');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB] px-4 py-12 dark:bg-[#0B1120]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white dark:bg-blue-600">
              {BRAND.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="font-display text-xl font-bold text-slate-900 dark:text-white">{BRAND.name}</span>
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">Sign in to your workspace</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{BRAND.tagline}</p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}
            <Input label="Work Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            <div className="flex items-center justify-between text-xs">
              <Link to="/forgot-password" className="font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                Forgot password?
              </Link>
              <Link to="/register" className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                Create account
              </Link>
            </div>
            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Development Demo Accounts
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="secondary" onClick={() => fillDemo('owner@flownest.demo')}>
                  Owner Demo
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => fillDemo('manager@flownest.demo')}>
                  Manager Demo
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => fillDemo('member@flownest.demo')}>
                  Member Demo
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [invitationToken, setInvitationToken] = useState(searchParams.get('invite') || '');
  const [mode, setMode] = useState<'create' | 'join'>(searchParams.get('invite') ? 'join' : 'create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        fullName,
        email,
        password,
        organizationName: mode === 'create' ? organizationName : undefined,
        invitationToken: mode === 'join' ? invitationToken : undefined,
      });
      toast.success('Account created', 'Your workspace is ready.');
      navigate('/overview');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB] px-4 py-12 dark:bg-[#0B1120]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {BRAND.name}
          </Link>
          <h1 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Launch a new organization or join an invited team.</p>
        </div>

        <Card>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`rounded-md py-1.5 ${mode === 'create' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              New Organization
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`rounded-md py-1.5 ${mode === 'join' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              Join via Invite
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Alex Morgan" />
            <Input label="Work Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="alex@company.com" />
            <Input label="Password (min 8 chars, upper, lower, digit)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {mode === 'create' ? (
              <Input label="Organization / Workspace Name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required placeholder="Acme Studio LLC" />
            ) : (
              <Input label="Invitation Token" value={invitationToken} onChange={(e) => setInvitationToken(e.target.value)} required placeholder="Paste invitation token" />
            )}
            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post<{ message: string; developmentResetToken?: string }>('/auth/forgot-password', { email });
      setInfoMsg(res.message);
      if (res.developmentResetToken) {
        setToken(res.developmentResetToken);
      }
      setStep('reset');
    } catch (err: any) {
      toast.error('Request failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { email, token, newPassword });
      toast.success('Password updated', 'You can now sign in with your new password.');
      navigate('/login');
    } catch (err: any) {
      toast.error('Reset failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FB] px-4 py-12 dark:bg-[#0B1120]">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your email to generate a secure reset token.</p>
        </div>
        <Card>
          {step === 'request' ? (
            <form onSubmit={requestReset} className="space-y-4">
              <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full">
                Request Password Reset
              </Button>
            </form>
          ) : (
            <form onSubmit={confirmReset} className="space-y-4">
              {infoMsg && <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{infoMsg}</p>}
              <Input label="Reset Token" value={token} onChange={(e) => setToken(e.target.value)} required />
              <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full">
                Reset Password
              </Button>
            </form>
          )}
          <div className="mt-4 text-center text-xs">
            <Link to="/login" className="text-[#1E3A5F] hover:underline dark:text-blue-400">
              Back to Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
