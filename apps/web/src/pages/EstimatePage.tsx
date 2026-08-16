import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PumpReadout } from "@brim/ui-kit";
import { Button } from "@brim/ui-kit/button";
import { Input } from "@brim/ui-kit/input";
import { Select } from "@brim/ui-kit/select";
import { Dialog } from "@brim/ui-kit/dialog";
import { Skeleton } from "@brim/ui-kit";
import { api } from "../api.js";

type Health = { status: string; fixtureMode: boolean };
type Place = { label: string; lat: number; lng: number };
type Vehicle = { id: string; nickname?: string; propulsion: string };
type Estimate = {
  cost: { totalPence: { point: number; low: number; high: number }; energyPence: { point: number }; chargesPence: number };
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
  const [health, setHealth] = useState<Health | null>(null);
  const [origin, setOrigin] = useState("Crawley");
  const [destination, setDestination] = useState("London");
  const [originHits, setOriginHits] = useState<Place[]>([]);
  const [propulsion, setPropulsion] = useState<"petrol" | "diesel" | "phev" | "bev">("petrol");
  const [mpg, setMpg] = useState("40");
  const [tank, setTank] = useState("55");
  const [miKwh, setMiKwh] = useState("3.8");
  const [battery, setBattery] = useState("64");
  const [start, setStart] = useState("80");
  const [departsAt, setDepartsAt] = useState(nowLocal);
  const [maps, setMaps] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    void api<Health>("/health").then(setHealth).catch(() => setHealth(null));
    void api<{ vehicles: Vehicle[] }>("/v1/vehicles")
      .then((r) => setVehicles(r.vehicles))
      .catch(() => undefined);
    const cached = localStorage.getItem("brim:last-estimate");
    if (cached) {
      setEstimate(JSON.parse(cached) as Estimate);
      setStale(true);
    }
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("url") ?? params.get("text");
    if (shared) {
      setMaps(shared);
      void runMaps(shared);
    }
  }, []);

  async function runEstimate(body: unknown) {
    setLoading(true);
    setError(null);
    try {
      const json = await api<Estimate>("/v1/estimate", { method: "POST", body: JSON.stringify(body) });
      setEstimate(json);
      setStale(false);
      localStorage.setItem("brim:last-estimate", JSON.stringify(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not estimate. Check the places and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function runMaps(url: string) {
    setLoading(true);
    setError(null);
    try {
      const json = await api<Estimate>("/v1/estimate/from-maps-url", { method: "POST", body: JSON.stringify({ url }) });
      setEstimate(json);
      setStale(false);
      localStorage.setItem("brim:last-estimate", JSON.stringify(json));
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Type the places instead.`
          : "That Maps link could not be read. Type the places instead.",
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
    if (propulsion === "bev") {
      return {
        kind: "car" as const,
        propulsion,
        userEnteredConsumption: Number(miKwh),
        userEnteredUnit: "mi/kWh" as const,
        batteryKwhUsable: Number(battery),
        startChargePercent: Number(start),
      };
    }
    if (propulsion === "phev") {
      return {
        kind: "car" as const,
        propulsion,
        userEnteredConsumption: Number(miKwh),
        userEnteredUnit: "mi/kWh" as const,
        batteryKwhUsable: Number(battery),
        startChargePercent: Number(start),
        tankLitres: Number(tank),
      };
    }
    return {
      kind: "car" as const,
      propulsion,
      userEnteredConsumption: Number(mpg),
      userEnteredUnit: "mpg" as const,
      tankLitres: Number(tank),
    };
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runEstimate({
      origin,
      destination,
      departsAt: new Date(departsAt).toISOString(),
      vehicleInline: vehicleId ? undefined : vehicleInline(),
      vehicleId: vehicleId || undefined,
      propulsion,
    });
  }

  async function saveVehicle() {
    try {
      await api("/v1/vehicles", {
        method: "POST",
        body: JSON.stringify({ nickname: `${propulsion} car`, ...vehicleInline() }),
      });
      const list = await api<{ vehicles: Vehicle[] }>("/v1/vehicles");
      setVehicles(list.vehicles);
    } catch {
      setAuthOpen(true);
    }
  }

  async function saveJourney() {
    if (!estimate) return;
    await api("/v1/journeys", {
      method: "POST",
      body: JSON.stringify({ origin, destination, vehicleId: vehicleId || undefined, estimate, departsAt }),
    });
  }

  async function onAuth(e: FormEvent) {
    e.preventDefault();
    const path = authMode === "signup" ? "/v1/auth/signup" : "/v1/auth/login";
    await api(path, { method: "POST", body: JSON.stringify({ email, password }) });
    setAuthOpen(false);
  }

  const pounds = estimate ? estimate.cost.totalPence.point / 100 : 0;
  const band = estimate
    ? `£${(estimate.cost.totalPence.low / 100).toFixed(0)}–£${(estimate.cost.totalPence.high / 100).toFixed(0)}`
    : "";
  const hmrc = useMemo(() => {
    if (!estimate?.hmrc) return null;
    return `HMRC would allow £${(estimate.hmrc.approvedPence / 100).toFixed(2)} (${estimate.hmrc.ytdMiles.toFixed(0)} miles this tax year).`;
  }, [estimate]);

  return (
    <main className="mx-auto max-w-xl p-4">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="display text-4xl">Brim</h1>
        <nav className="flex gap-3 text-sm">
          <a href="/history">History</a>
          <a href="/account">Account</a>
          {import.meta.env.DEV ? <a href="/kitchen-sink">Kitchen sink</a> : null}
        </nav>
      </header>
      <p className="mb-4">Add your car and we will stop guessing.</p>
      {health ? (
        <p className="tabular mb-4 opacity-70">
          API {health.status}
          {health.fixtureMode ? " · fixtures" : ""}
        </p>
      ) : (
        <p className="mb-4">Could not reach the API — start it with npm run dev:fixtures, then retry.</p>
      )}
      {stale ? <p className="mb-4 text-[var(--warning)]">Showing the last estimate stored on this device. New estimates need a network.</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runMaps(maps);
        }}
        className="mb-6"
      >
        <label>
          Paste a Maps link
          <Input value={maps} onChange={(ev) => setMaps(ev.target.value)} aria-describedby="maps-help" />
        </label>
        <p id="maps-help" className="mb-2 text-sm opacity-70">
          A Google Maps directions link. If it cannot be read, type the places below.
        </p>
        <Button type="submit">Estimate from link</Button>
      </form>

      <form onSubmit={onSubmit}>
        {vehicles.length > 0 ? (
          <label>
            Saved vehicle
            <Select value={vehicleId} onChange={(ev) => setVehicleId(ev.target.value)}>
              <option value="">Type details this time</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname ?? v.propulsion}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label>
          From
          <Input
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
        </label>
        <label>
          To
          <Input value={destination} onChange={(ev) => setDestination(ev.target.value)} required />
        </label>
        <label>
          Leave
          <Input type="datetime-local" value={departsAt} onChange={(ev) => setDepartsAt(ev.target.value)} />
        </label>
        {vehicleId ? null : (
          <>
            <label>
              Propulsion
              <Select value={propulsion} onChange={(ev) => setPropulsion(ev.target.value as typeof propulsion)}>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="phev">Plug-in hybrid</option>
                <option value="bev">Electric</option>
              </Select>
            </label>
            {propulsion === "bev" || propulsion === "phev" ? (
              <>
                <label>
                  mi/kWh
                  <Input value={miKwh} onChange={(ev) => setMiKwh(ev.target.value)} className="tabular" />
                </label>
                <label>
                  Usable battery kWh
                  <Input value={battery} onChange={(ev) => setBattery(ev.target.value)} className="tabular" />
                </label>
                <label>
                  Starting charge %
                  <Input value={start} onChange={(ev) => setStart(ev.target.value)} className="tabular" />
                </label>
              </>
            ) : null}
            {propulsion !== "bev" ? (
              <>
                {propulsion !== "phev" ? (
                  <label>
                    mpg
                    <Input value={mpg} onChange={(ev) => setMpg(ev.target.value)} className="tabular" />
                  </label>
                ) : null}
                <label>
                  Tank size (litres)
                  <Input value={tank} onChange={(ev) => setTank(ev.target.value)} className="tabular" />
                </label>
              </>
            ) : null}
          </>
        )}
        <Button type="submit">{loading ? "Working out the number…" : "Estimate"}</Button>
      </form>

      {error ? <p className="mt-4 text-[var(--warning)]">{error}</p> : null}
      {loading ? (
        <div className="mt-6" aria-busy="true">
          <Skeleton className="mb-2 w-40" />
          <Skeleton className="w-24" />
        </div>
      ) : null}

      {estimate ? (
        <section className="mt-8" aria-live="polite">
          <PumpReadout value={pounds} />
          <p className="tabular mt-2 opacity-80">{band}</p>
          <p className="mt-3">{estimate.consumption.label}</p>
          <p className="tabular">{estimate.consumption.display}</p>
          {estimate.energy.arrivalStateOfCharge ? (
            <p>
              Arrival about {estimate.energy.arrivalStateOfCharge.percent.toFixed(0)}% (
              {estimate.energy.arrivalStateOfCharge.verdict})
            </p>
          ) : null}
          {hmrc ? <p className="tabular mt-2 text-sm opacity-80">{hmrc}</p> : null}
          {estimate.warnings.map((w) => (
            <p key={w.message} className="mt-2 text-[var(--warning)]">
              {w.message}
            </p>
          ))}
          <details className="mt-4">
            <summary>How we got there</summary>
            <ul>
              {estimate.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
          <p className="mt-4 text-sm opacity-70">
            Charges such as ULEZ and Dart Charge are not in this number yet. They will appear here when the charges
            layer ships.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => void saveVehicle()}>
              Save this car
            </Button>
            <Button type="button" variant="ghost" onClick={() => void saveJourney()}>
              Save journey
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAuthOpen(true)}>
              Sign in to sync
            </Button>
          </div>
        </section>
      ) : null}

      <Dialog open={authOpen} title={authMode === "signup" ? "Keep this car" : "Welcome back"} onClose={() => setAuthOpen(false)}>
        <p className="mb-3 text-sm opacity-80">You can estimate without an account. Sign in only if you want this car on other devices.</p>
        <form onSubmit={(e) => void onAuth(e)}>
          <label>
            Email
            <Input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
          </label>
          <label>
            Password
            <Input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} minLength={8} required />
          </label>
          <Button type="submit">{authMode === "signup" ? "Create account" : "Sign in"}</Button>
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
          >
            {authMode === "signup" ? "I already have an account" : "Create an account"}
          </button>
        </form>
      </Dialog>
    </main>
  );
}
