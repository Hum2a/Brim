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
import { AddressField } from '../AddressField.js';

type BrimSession = { kind: 'anon' | 'user'; ownerId: string; email?: string };
type Place = { id: string; kind: 'home' | 'work' | 'favourite'; label: string; lat: number; lng: number };
type Vehicle = { id: string; nickname?: string; make?: string; model?: string; is_default?: boolean };
type Summary = { miles: number; actualPence: number; approvedPence: number; crossedThreshold: boolean; taxYearStart: string };
type Calibration = { sampleCount: number; confidence: string };

export function AccountPage() {
  const reduce = usePrefersReducedMotion();
  const [session, setSession] = useState<BrimSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [home, setHome] = useState<Place | null>(null);
  const [work, setWork] = useState<Place | null>(null);
  const [homeText, setHomeText] = useState('');
  const [workText, setWorkText] = useState('');
  const [defaultCar, setDefaultCar] = useState<string>('None');
  const [calibLine, setCalibLine] = useState<string | null>(null);
  const [hmrc, setHmrc] = useState<Summary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ session: BrimSession | null }>('/v1/auth/session');
      setSession(res.session);
      const places = await api<{ places: Place[] }>('/v1/saved-places');
      const nextHome = places.places.find((p) => p.kind === 'home') ?? null;
      const nextWork = places.places.find((p) => p.kind === 'work') ?? null;
      setHome(nextHome);
      setWork(nextWork);
      setHomeText(nextHome?.label ?? '');
      setWorkText(nextWork?.label ?? '');
      const cars = await api<{ vehicles: Vehicle[] }>('/v1/vehicles');
      const def = cars.vehicles.find((v) => v.is_default) ?? cars.vehicles[0];
      setDefaultCar(
        def ? (def.nickname ?? [def.make, def.model].filter(Boolean).join(' ') ?? 'Saved car') : 'None',
      );
      if (def) {
        const cal = await api<Calibration>(`/v1/vehicles/${def.id}/calibration`).catch(() => null);
        if (cal?.confidence === 'calibrated') setCalibLine(`Based on your last ${cal.sampleCount} brim-to-brim intervals.`);
        else if (cal?.confidence === 'building') setCalibLine(`${cal.sampleCount} brim-to-brim intervals so far. Need 3.`);
        else setCalibLine('No brim fill-ups on the default car yet.');
      } else {
        setCalibLine(null);
      }
      setHmrc(await api<Summary>('/v1/journeys/summary').catch(() => null));
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

  async function savePlace(kind: 'home' | 'work', place: { label: string; lat: number; lng: number }) {
    await api('/v1/saved-places', {
      method: 'POST',
      body: JSON.stringify({ kind, label: place.label, lat: place.lat, lng: place.lng }),
    });
    toast(kind === 'home' ? 'Home saved.' : 'Work saved.');
    await refresh();
  }

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
              <div className="space-y-5">
                <p>
                  Signed in as <span className="text-pump">{session.email ?? session.ownerId}</span>
                </p>
                <p className="text-sm">Default car: {defaultCar}</p>
                {calibLine ? <p className="text-sm text-mist">{calibLine}</p> : null}
                {hmrc ? (
                  <p className="tabular text-sm text-mist">
                    This tax year: {hmrc.miles.toFixed(0)} miles, actual £{(hmrc.actualPence / 100).toFixed(2)},
                    HMRC would allow £{(hmrc.approvedPence / 100).toFixed(2)}
                    {hmrc.crossedThreshold ? ' (past 10,000 miles).' : '.'}
                  </p>
                ) : null}
                <div>
                  <AddressField
                    id="home"
                    label="Home"
                    value={homeText}
                    onChange={setHomeText}
                    onSelect={(place) => {
                      setHomeText(place.label);
                      void savePlace('home', place);
                    }}
                  />
                  {home ? <p className="mt-1 text-xs text-mist">Saved as {home.label}</p> : null}
                </div>
                <div>
                  <AddressField
                    id="work"
                    label="Work"
                    value={workText}
                    onChange={setWorkText}
                    onSelect={(place) => {
                      setWorkText(place.label);
                      void savePlace('work', place);
                    }}
                  />
                  {work ? <p className="mt-1 text-xs text-mist">Saved as {work.label}</p> : null}
                </div>
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
                      const res = await fetch(`${apiBase}/v1/auth/export`, { credentials: 'include' });
                      if (!res.ok) {
                        toast('Could not download your data.');
                        return;
                      }
                      const blob = await res.blob();
                      const href = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = href;
                      link.download = 'brim-account.json';
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
                <p className="mt-5 text-sm text-mist">Estimating stays free. An account is only for sync and history.</p>
              </>
            )}
          </Card>
        </m.div>
      </m.div>
    </main>
  );
}
