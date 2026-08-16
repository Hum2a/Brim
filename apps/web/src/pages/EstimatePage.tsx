import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PumpReadout, reveal, staggerChildren, usePrefersReducedMotion } from '@brim/ui-kit';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@brim/ui-kit/accordion';
import { Badge } from '@brim/ui-kit/badge';
import { Button } from '@brim/ui-kit/button';
import { Card } from '@brim/ui-kit/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@brim/ui-kit/dialog';
import { Form, FormItem } from '@brim/ui-kit/form';
import { Input } from '@brim/ui-kit/input';
import { Label } from '@brim/ui-kit/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@brim/ui-kit/select';
import { Skeleton } from '@brim/ui-kit/skeleton';
import { toast } from '@brim/ui-kit/toast';
import { api } from '../api.js';
import { AuthPanel } from '../AuthPanel.js';
import { VehicleCatalogue, type CatalogueVehicle } from '../VehicleCatalogue.js';

type Health = { status: string; fixtureMode: boolean };
type Place = { label: string; lat: number; lng: number };
type Vehicle = { id: string; nickname?: string; propulsion: string; make?: string; model?: string };
type Propulsion = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'bev';
type Estimate = {
  cost: {
    totalPence: { point: number; low: number; high: number };
    energyPence: { point: number };
    chargesPence: number;
  };
  consumption: { label: string; display: string };
  reasons: string[];
  warnings: Array<{ message: string }>;
  energy: { arrivalStateOfCharge?: { percent: number; verdict: string } };
  hmrc?: { approvedPence: number; ytdMiles: number; crossedThreshold: boolean };
  distanceMeters: number;
  durationSeconds: number;
  charges: unknown[];
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function EstimatePage() {
  const reduce = usePrefersReducedMotion();
  const [health, setHealth] = useState<Health | null>(null);
  const [origin, setOrigin] = useState('Crawley');
  const [destination, setDestination] = useState('London');
  const [originHits, setOriginHits] = useState<Place[]>([]);
  const [propulsion, setPropulsion] = useState<Propulsion>('petrol');
  const [catalogue, setCatalogue] = useState<CatalogueVehicle | null>(null);
  const [mpg, setMpg] = useState('40');
  const [tank, setTank] = useState('55');
  const [miKwh, setMiKwh] = useState('3.8');
  const [overrideMpg, setOverrideMpg] = useState('');
  const [overrideMiKwh, setOverrideMiKwh] = useState('');
  const [battery, setBattery] = useState('64');
  const [start, setStart] = useState('80');
  const [departsAt, setDepartsAt] = useState(nowLocal);
  const [maps, setMaps] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('inline');
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<'vehicle' | 'journey' | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    void api<Health>('/health')
      .then(setHealth)
      .catch(() => setHealth(null));
    void api<{ vehicles: Vehicle[] }>('/v1/vehicles')
      .then((r) => setVehicles(r.vehicles))
      .catch(() => undefined);
    const cached = localStorage.getItem('brim:last-estimate');
    if (cached) {
      setEstimate(JSON.parse(cached) as Estimate);
      setStale(true);
    }
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('url') ?? params.get('text');
    if (shared) {
      setMaps(shared);
      void runMaps(shared);
    }
  }, []);

  async function runEstimate(body: unknown) {
    setLoading(true);
    setError(null);
    try {
      const json = await api<Estimate>('/v1/estimate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setEstimate(json);
      setStale(false);
      localStorage.setItem('brim:last-estimate', JSON.stringify(json));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not estimate. Check the places and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function runMaps(url: string) {
    setLoading(true);
    setError(null);
    try {
      const json = await api<Estimate>('/v1/estimate/from-maps-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setEstimate(json);
      setStale(false);
      localStorage.setItem('brim:last-estimate', JSON.stringify(json));
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Type the places instead.`
          : 'That Maps link could not be read. Type the places instead.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function onPlaces(value: string) {
    setOrigin(value);
    if (value.length < 2) return;
    const res = await api<{ places: Place[] }>(`/v1/places?q=${encodeURIComponent(value)}`);
    setOriginHits(res.places);
  }

  function vehicleInline() {
    const useElectricFigure = propulsion === 'bev' || (propulsion === 'phev' && !catalogue);
    const overrideRaw = useElectricFigure
      ? catalogue
        ? overrideMiKwh
        : miKwh
      : catalogue
        ? overrideMpg
        : mpg;
    const overrideNum = Number(overrideRaw);
    const hasOverride =
      overrideRaw.trim() !== '' && Number.isFinite(overrideNum) && overrideNum > 0;

    const profile: Record<string, unknown> = {
      kind: 'car',
      propulsion,
    };
    if (catalogue) {
      profile.make = catalogue.make;
      profile.model = catalogue.model;
      profile.vcaMatchId = catalogue.id;
      profile.officialConsumption = catalogue.officialConsumption;
      profile.officialUnit = catalogue.officialUnit;
      profile.officialCycle = catalogue.officialCycle;
      if (catalogue.derivative) profile.derivative = catalogue.derivative;
      if (catalogue.transmission) profile.transmission = catalogue.transmission;
      if (catalogue.engineCc !== undefined) profile.engineCc = catalogue.engineCc;
      if (catalogue.co2Gkm !== undefined) profile.co2Gkm = catalogue.co2Gkm;
    }
    if (hasOverride) {
      profile.userEnteredConsumption = overrideNum;
      profile.userEnteredUnit = useElectricFigure ? 'mi/kWh' : 'mpg';
    }
    if (propulsion !== 'bev') {
      const tankLitres = Number(tank);
      if (Number.isFinite(tankLitres) && tankLitres > 0) profile.tankLitres = tankLitres;
    }
    if (propulsion === 'bev' || propulsion === 'phev') {
      const batteryKwh = Number(battery);
      const startPct = Number(start);
      if (Number.isFinite(batteryKwh) && batteryKwh > 0) profile.batteryKwhUsable = batteryKwh;
      if (Number.isFinite(startPct) && startPct > 0) profile.startChargePercent = startPct;
    }
    return profile;
  }

  function onPickCar(next: CatalogueVehicle | null) {
    setCatalogue(next);
    if (next) setPropulsion(next.propulsion);
    setOverrideMpg('');
    setOverrideMiKwh('');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runEstimate({
      origin,
      destination,
      departsAt: new Date(departsAt).toISOString(),
      vehicleInline: vehicleId === 'inline' ? vehicleInline() : undefined,
      vehicleId: vehicleId === 'inline' ? undefined : vehicleId,
      propulsion,
    });
  }

  async function saveVehicle() {
    try {
      await api('/v1/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          nickname: catalogue ? `${catalogue.make} ${catalogue.model}` : `${propulsion} car`,
          ...vehicleInline(),
        }),
      });
      const list = await api<{ vehicles: Vehicle[] }>('/v1/vehicles');
      setVehicles(list.vehicles);
      toast('Saved. Your car is on this device.');
    } catch {
      setPendingSave('vehicle');
      setAuthOpen(true);
    }
  }

  async function saveJourney() {
    if (!estimate) return;
    try {
      await api('/v1/journeys', {
        method: 'POST',
        body: JSON.stringify({
          origin,
          destination,
          vehicleId: vehicleId === 'inline' ? undefined : vehicleId,
          estimate,
          departsAt,
        }),
      });
      toast('Journey stored as a snapshot.');
    } catch {
      setPendingSave('journey');
      setAuthOpen(true);
    }
  }

  async function onAuthSuccess() {
    setAuthOpen(false);
    const pending = pendingSave;
    setPendingSave(null);
    if (pending === 'vehicle') await saveVehicle();
    if (pending === 'journey') await saveJourney();
    const list = await api<{ vehicles: Vehicle[] }>('/v1/vehicles').catch(() => null);
    if (list) setVehicles(list.vehicles);
  }

  const pounds = estimate ? estimate.cost.totalPence.point / 100 : 0;
  const band = estimate
    ? `£${(estimate.cost.totalPence.low / 100).toFixed(0)}–£${(estimate.cost.totalPence.high / 100).toFixed(0)}`
    : '';
  const hmrc = useMemo(() => {
    if (!estimate?.hmrc) return null;
    return `HMRC would allow £${(estimate.hmrc.approvedPence / 100).toFixed(2)} (${estimate.hmrc.ytdMiles.toFixed(0)} miles this tax year).`;
  }, [estimate]);

  return (
    <main className="mx-auto w-[min(960px,calc(100%-1.5rem))] py-8">
      <m.div
        variants={staggerChildren}
        initial={reduce ? false : 'initial'}
        animate="animate"
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
      >
        <m.div variants={reveal}>
          <Card>
            <p className="mb-1 text-mist">True journey cost</p>
            <h1 className="display mb-4 text-3xl">Add your car and we will stop guessing.</h1>
            {health ? (
              <p className="tabular mb-4 text-xs text-mist">
                API {health.status}
                {health.fixtureMode ? ' · fixtures' : ''}
              </p>
            ) : (
              <p className="mb-4 text-sm text-warning">
                Could not reach the API — start it with npm run dev:fixtures, then retry.
              </p>
            )}
            {stale ? (
              <p className="mb-4 text-sm text-warning">
                Showing the last estimate stored on this device. New estimates need a network.
              </p>
            ) : null}

            <Form
              onSubmit={(e) => {
                e.preventDefault();
                void runMaps(maps);
              }}
              className="mb-6"
            >
              <FormItem>
                <Label htmlFor="maps">Paste a Maps link</Label>
                <Input
                  id="maps"
                  value={maps}
                  onChange={(ev) => setMaps(ev.target.value)}
                  aria-describedby="maps-help"
                />
                <p id="maps-help" className="text-xs text-mist">
                  A Google Maps directions link. If it cannot be read, type the places below.
                </p>
              </FormItem>
              <Button type="submit" variant="ghost">
                Estimate from link
              </Button>
            </Form>

            <Form onSubmit={onSubmit}>
              {vehicles.length > 0 ? (
                <FormItem>
                  <Label>Saved vehicle</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type details this time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inline">Type details this time</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nickname ??
                            [v.make, v.model].filter(Boolean).join(' ') ??
                            v.propulsion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              ) : null}
              <FormItem>
                <Label htmlFor="origin">From</Label>
                <Input
                  id="origin"
                  value={origin}
                  onChange={(ev) => void onPlaces(ev.target.value)}
                  required
                  list="origin-places"
                  autoComplete="off"
                />
                <datalist id="origin-places">
                  {originHits.map((p) => (
                    <option key={p.label} value={p.label} />
                  ))}
                </datalist>
              </FormItem>
              <FormItem>
                <Label htmlFor="destination">To</Label>
                <Input
                  id="destination"
                  value={destination}
                  onChange={(ev) => setDestination(ev.target.value)}
                  required
                />
              </FormItem>
              <FormItem>
                <Label htmlFor="leave">Leave</Label>
                <Input
                  id="leave"
                  type="datetime-local"
                  value={departsAt}
                  onChange={(ev) => setDepartsAt(ev.target.value)}
                />
              </FormItem>
              {vehicleId === 'inline' ? (
                <>
                  <FormItem>
                    <VehicleCatalogue selected={catalogue} onSelect={onPickCar} />
                  </FormItem>
                  <FormItem>
                    <Label>Propulsion</Label>
                    {catalogue ? (
                      <Badge>
                        {catalogue.propulsion === 'bev'
                          ? 'Electric'
                          : catalogue.propulsion === 'phev'
                            ? 'Plug-in hybrid'
                            : catalogue.propulsion === 'hybrid'
                              ? 'Hybrid'
                              : catalogue.propulsion === 'diesel'
                                ? 'Diesel'
                                : 'Petrol'}
                      </Badge>
                    ) : (
                      <Select
                        value={propulsion}
                        onValueChange={(v) => setPropulsion(v as Propulsion)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="petrol">Petrol</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="phev">Plug-in hybrid</SelectItem>
                          <SelectItem value="bev">Electric</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FormItem>
                  {propulsion === 'bev' || (propulsion === 'phev' && !catalogue) ? (
                    <>
                      <FormItem>
                        <Label htmlFor="mikwh">
                          {catalogue ? 'Your mi/kWh (optional)' : 'mi/kWh'}
                        </Label>
                        <Input
                          id="mikwh"
                          value={catalogue ? overrideMiKwh : miKwh}
                          onChange={(ev) =>
                            catalogue
                              ? setOverrideMiKwh(ev.target.value)
                              : setMiKwh(ev.target.value)
                          }
                          className="tabular"
                          placeholder={
                            catalogue ? 'Leave blank to use the official figure' : undefined
                          }
                        />
                      </FormItem>
                      <FormItem>
                        <Label htmlFor="battery">Usable battery kWh</Label>
                        <Input
                          id="battery"
                          value={battery}
                          onChange={(ev) => setBattery(ev.target.value)}
                          className="tabular"
                        />
                      </FormItem>
                      <FormItem>
                        <Label htmlFor="start">Starting charge %</Label>
                        <Input
                          id="start"
                          value={start}
                          onChange={(ev) => setStart(ev.target.value)}
                          className="tabular"
                        />
                      </FormItem>
                    </>
                  ) : null}
                  {propulsion === 'phev' && catalogue ? (
                    <>
                      <FormItem>
                        <Label htmlFor="battery">Usable battery kWh</Label>
                        <Input
                          id="battery"
                          value={battery}
                          onChange={(ev) => setBattery(ev.target.value)}
                          className="tabular"
                        />
                      </FormItem>
                      <FormItem>
                        <Label htmlFor="start">Starting charge %</Label>
                        <Input
                          id="start"
                          value={start}
                          onChange={(ev) => setStart(ev.target.value)}
                          className="tabular"
                        />
                      </FormItem>
                    </>
                  ) : null}
                  {propulsion !== 'bev' ? (
                    <>
                      {propulsion !== 'phev' || catalogue ? (
                        <FormItem>
                          <Label htmlFor="mpg">{catalogue ? 'Your mpg (optional)' : 'mpg'}</Label>
                          <Input
                            id="mpg"
                            value={catalogue ? overrideMpg : mpg}
                            onChange={(ev) =>
                              catalogue ? setOverrideMpg(ev.target.value) : setMpg(ev.target.value)
                            }
                            className="tabular"
                            placeholder={
                              catalogue ? 'Leave blank to use the official figure' : undefined
                            }
                          />
                        </FormItem>
                      ) : null}
                      <FormItem>
                        <Label htmlFor="tank">Tank size (litres)</Label>
                        <Input
                          id="tank"
                          value={tank}
                          onChange={(ev) => setTank(ev.target.value)}
                          className="tabular"
                        />
                      </FormItem>
                    </>
                  ) : null}
                </>
              ) : null}
              <Button type="submit">{loading ? 'Working out the number…' : 'Estimate'}</Button>
            </Form>
          </Card>
        </m.div>

        <m.div variants={reveal}>
          {error ? <p className="mb-4 text-warning">{error}</p> : null}
          {loading ? (
            <Card aria-busy="true">
              <Skeleton className="mb-3 h-16 w-48" />
              <Skeleton className="h-4 w-24" />
            </Card>
          ) : null}
          <AnimatePresence>
            {estimate && !loading ? (
              <m.section
                aria-live="polite"
                variants={staggerChildren}
                initial={reduce ? false : 'initial'}
                animate="animate"
                className="glass p-6"
              >
                <m.div variants={reveal}>
                  <PumpReadout value={pounds} layoutId="pump-readout" />
                </m.div>
                <m.p variants={reveal} className="tabular mt-3 text-mist">
                  {band}
                </m.p>
                <m.div variants={reveal} className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="diesel">{estimate.consumption.label}</Badge>
                  <span className="tabular text-sm">{estimate.consumption.display}</span>
                </m.div>
                {estimate.energy.arrivalStateOfCharge ? (
                  <m.p variants={reveal} className="mt-3 text-sm">
                    Arrival about {estimate.energy.arrivalStateOfCharge.percent.toFixed(0)}% (
                    {estimate.energy.arrivalStateOfCharge.verdict})
                  </m.p>
                ) : null}
                {hmrc ? (
                  <m.p variants={reveal} className="tabular mt-2 text-sm text-mist">
                    {hmrc}
                  </m.p>
                ) : null}
                {estimate.warnings.map((w) => (
                  <m.p key={w.message} variants={reveal} className="mt-3 text-warning">
                    {w.message}
                  </m.p>
                ))}
                <m.div variants={reveal}>
                  <Accordion type="single" collapsible className="mt-4">
                    <AccordionItem value="reasons">
                      <AccordionTrigger>How we got there</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc space-y-1 pl-4">
                          {estimate.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </m.div>
                <m.p variants={reveal} className="mt-4 text-sm text-mist">
                  Charges such as ULEZ and Dart Charge are not in this number yet. They will appear
                  here when the charges layer ships.
                </m.p>
                <m.div variants={reveal} className="mt-5 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => void saveVehicle()}>
                    Save this car
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void saveJourney()}>
                    Save journey
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAuthOpen(true)}>
                    Sign in to sync
                  </Button>
                </m.div>
              </m.section>
            ) : null}
          </AnimatePresence>
        </m.div>
      </m.div>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keep this car</DialogTitle>
            <DialogDescription>
              You can estimate without an account. Sign in only if you want this car on other
              devices.
            </DialogDescription>
          </DialogHeader>
          <AuthPanel
            defaultTab="signup"
            idPrefix="estimate-auth"
            onSuccess={() => void onAuthSuccess()}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
