import { m } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { fadeUp, usePrefersReducedMotion } from '@brim/ui-kit';
import { Button } from '@brim/ui-kit/button';
import { Form, FormItem } from '@brim/ui-kit/form';
import { Input } from '@brim/ui-kit/input';
import { Label } from '@brim/ui-kit/label';
import { Separator } from '@brim/ui-kit/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@brim/ui-kit/tabs';
import { toast } from '@brim/ui-kit/toast';
import { api } from './api.js';
import { authClient } from './auth-client.js';

type Tab = 'signin' | 'signup';
type View = 'auth' | 'forgot' | 'reset' | 'magic-sent' | 'reset-sent';

function webPath(path: string): string {
  return `${window.location.origin}${path}`;
}

function errorMessage(
  error: { message?: string | undefined } | null | undefined,
  fallback: string,
): string {
  return error?.message ?? fallback;
}

function ErrorLine({ message, reduce }: { message: string; reduce: boolean }) {
  return (
    <m.p role="alert" className="mb-3 text-sm text-warning" {...(reduce ? { initial: false as const } : fadeUp)}>
      {message}
    </m.p>
  );
}

export function AuthPanel({
  onSuccess,
  defaultTab = 'signin',
  idPrefix = 'auth',
}: {
  onSuccess?: () => void;
  defaultTab?: Tab;
  idPrefix?: string;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('token')
      ? 'reset'
      : 'auth',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = usePrefersReducedMotion();

  async function afterAuth() {
    await api('/v1/auth/claim-anon', { method: 'POST', body: JSON.stringify({}) }).catch(
      () => undefined,
    );
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter an email.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (err) {
      setError(errorMessage(err, 'Could not sign in. Check the email and password.'));
      return;
    }
    await afterAuth();
    toast('Signed in.');
    onSuccess?.();
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter an email.');
      return;
    }
    setPending(true);
    setError(null);
    const name = email.split('@')[0] ?? 'driver';
    const { error: err } = await authClient.signUp.email({ email, password, name });
    setPending(false);
    if (err) {
      setError(errorMessage(err, 'Could not create the account.'));
      return;
    }
    await afterAuth();
    toast('Account created. Vehicles saved on this device are now on the account.');
    onSuccess?.();
  }

  async function onMagicLink(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.magicLink({
      email,
      callbackURL: webPath('/account'),
    });
    setPending(false);
    if (err) {
      setError(errorMessage(err, 'Could not send a sign-in link.'));
      return;
    }
    setView('magic-sent');
    toast('Check your inbox.');
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: webPath('/account'),
    });
    setPending(false);
    if (err) {
      setError(errorMessage(err, 'Could not send a reset email.'));
      return;
    }
    setView('reset-sent');
    toast('Check your inbox.');
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('That reset link is missing a token. Request a new one.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (err) {
      setError(errorMessage(err, 'Could not set a new password.'));
      return;
    }
    toast('Password updated. Sign in with it.');
    setPassword('');
    setConfirm('');
    setView('auth');
    setTab('signin');
    window.history.replaceState({}, '', '/account');
  }

  const emailField = (
    <FormItem>
      <Label htmlFor={`${idPrefix}-email`}>Email</Label>
      <Input
        id={`${idPrefix}-email`}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        required
      />
    </FormItem>
  );

  if (view === 'magic-sent' || view === 'reset-sent') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-mist">
          {view === 'magic-sent'
            ? 'If that address is on an account, a sign-in link is on its way. It expires in a few minutes.'
            : 'If that address is on an account, a reset link is on its way.'}
        </p>
        <Button type="button" variant="ghost" onClick={() => setView('auth')}>
          Back to sign in
        </Button>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <Form onSubmit={(e) => void onForgot(e)}>
        <p className="mb-3 text-sm text-mist">We will email a link to set a new password.</p>
        {emailField}
        {error ? <ErrorLine message={error} reduce={reduce} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setView('auth')}>
            Back
          </Button>
        </div>
      </Form>
    );
  }

  if (view === 'reset') {
    return (
      <Form onSubmit={(e) => void onReset(e)}>
        <p className="mb-3 text-sm text-mist">Choose a new password for this account.</p>
        <FormItem>
          <Label htmlFor={`${idPrefix}-new-password`}>New password</Label>
          <Input
            id={`${idPrefix}-new-password`}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            minLength={8}
            required
          />
        </FormItem>
        <FormItem>
          <Label htmlFor={`${idPrefix}-confirm`}>Confirm password</Label>
          <Input
            id={`${idPrefix}-confirm`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            minLength={8}
            required
          />
        </FormItem>
        {error ? <ErrorLine message={error} reduce={reduce} /> : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Set new password'}
        </Button>
      </Form>
    );
  }

  return (
    <div>
      <FormItem>
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
      </FormItem>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <Form onSubmit={(e) => void onSignIn(e)}>
            <FormItem>
              <Label htmlFor={`${idPrefix}-password`}>Password</Label>
              <Input
                id={`${idPrefix}-password`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                minLength={8}
                required
              />
            </FormItem>
            {error && tab === 'signin' ? <ErrorLine message={error} reduce={reduce} /> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
              <button type="button" className="text-sm underline" onClick={() => setView('forgot')}>
                Forgot password?
              </button>
            </div>
          </Form>
        </TabsContent>
        <TabsContent value="signup">
          <Form onSubmit={(e) => void onSignUp(e)}>
            <FormItem>
              <Label htmlFor={`${idPrefix}-new-password-signup`}>Password</Label>
              <Input
                id={`${idPrefix}-new-password-signup`}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                minLength={8}
                required
              />
            </FormItem>
            {error && tab === 'signup' ? <ErrorLine message={error} reduce={reduce} /> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create account'}
            </Button>
          </Form>
        </TabsContent>
      </Tabs>
      <Separator className="my-5" />
      <Form onSubmit={(e) => void onMagicLink(e)}>
        <p className="mb-3 text-sm text-mist">
          Or skip the password. We will email a one-time link to the address above.
        </p>
        <Button type="submit" variant="ghost" disabled={pending || email.length === 0}>
          {pending ? 'Sending…' : 'Email me a link'}
        </Button>
      </Form>
    </div>
  );
}
