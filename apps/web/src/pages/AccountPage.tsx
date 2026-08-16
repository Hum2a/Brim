import { m } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { reveal, staggerChildren, usePrefersReducedMotion } from '@brim/ui-kit';
import { Button } from '@brim/ui-kit/button';
import { Card } from '@brim/ui-kit/card';
import { Skeleton } from '@brim/ui-kit/skeleton';
import { toast } from '@brim/ui-kit/toast';
import { api, apiBase } from '../api.js';
import { authClient } from '../auth-client.js';
import { AuthPanel } from '../AuthPanel.js';

type BrimSession = { kind: 'anon' | 'user'; ownerId: string; email?: string };

export function AccountPage() {
  const reduce = usePrefersReducedMotion();
  const [session, setSession] = useState<BrimSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ session: BrimSession | null }>('/v1/auth/session');
      setSession(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the account.');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signedIn = session?.kind === 'user';

  return (
    <main className="mx-auto w-[min(560px,calc(100%-1.5rem))] py-8">
      <m.div variants={staggerChildren} initial={reduce ? false : 'initial'} animate="animate">
        <m.div variants={reveal}>
          <h1 className="display mb-2 text-4xl">{signedIn ? 'Account' : 'Sign in'}</h1>
          <p className="mb-6 text-mist">
            {signedIn
              ? 'This is the copy of Brim that travels with you.'
              : 'You can estimate without an account. Sign in to keep the car and the history on other devices.'}
          </p>
        </m.div>
        <m.div variants={reveal}>
          <Card>
            {loading ? (
              <div aria-busy="true">
                <Skeleton className="mb-3 h-10 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div>
                <p className="mb-3 text-sm text-warning">{error}</p>
                <Button type="button" variant="ghost" onClick={() => void refresh()}>
                  Try again
                </Button>
              </div>
            ) : signedIn ? (
              <div className="space-y-4">
                <p>
                  Signed in as <span className="text-pump">{session.email ?? session.ownerId}</span>
                </p>
                <div className="flex flex-col items-start gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      await authClient.signOut();
                      setMessage('Signed out.');
                      toast('Signed out.');
                      await refresh();
                    }}
                  >
                    Sign out
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      const res = await fetch(`${apiBase}/v1/auth/export`, { credentials: "include" });
                      if (!res.ok) {
                        toast("Could not download your data.");
                        return;
                      }
                      const blob = await res.blob();
                      const href = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = href;
                      link.download = "brim-account.json";
                      link.click();
                      URL.revokeObjectURL(href);
                    }}
                  >
                    Download all data
                  </Button>
                  <Button
                    type="button"
                    variant="warning"
                    onClick={async () => {
                      if (!confirm('Delete your account and stored journeys permanently?')) return;
                      await api('/v1/auth/account', { method: 'DELETE' });
                      setMessage('Account deleted.');
                      toast('Account deleted.');
                      await refresh();
                    }}
                  >
                    Delete account
                  </Button>
                </div>
                {message ? <p className="text-sm text-mist">{message}</p> : null}
              </div>
            ) : (
              <>
                <AuthPanel onSuccess={() => void refresh()} />
                <p className="mt-5 text-sm text-mist">
                  Estimating stays free. An account is only for sync and history.
                </p>
              </>
            )}
          </Card>
        </m.div>
      </m.div>
    </main>
  );
}
