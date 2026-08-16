import { AnimatePresence, m } from "motion/react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { findPlaceByLabel } from "@brim/shared";
import { PumpReadout, reveal, staggerChildren, usePrefersReducedMotion } from "@brim/ui-kit";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@brim/ui-kit/accordion";
import { Badge } from "@brim/ui-kit/badge";
import { Button } from "@brim/ui-kit/button";
import { Card } from "@brim/ui-kit/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@brim/ui-kit/dialog";
import { Drawer, DrawerContent } from "@brim/ui-kit/drawer";
import { Form, FormItem } from "@brim/ui-kit/form";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@brim/ui-kit/select";
import { Skeleton } from "@brim/ui-kit/skeleton";
import { toast } from "@brim/ui-kit/toast";
import { api } from "../api.js";
import { AddressField } from "../AddressField.js";
import { AuthPanel } from "../AuthPanel.js";
import { reversePlace } from "../places-client.js";
import { VehicleCatalogue, type CatalogueVehicle } from "../VehicleCatalogue.js";

const RouteMap = lazy(() => import("../RouteMap.js"));

type Health = { status: string; fixtureMode: boolean };
type Place = { label: string; lat: number; lng: number };
type Vehicle = {
  id: string;
  nickname?: string;
  propulsion: string;
  make?: string;
  model?: string;
};
type Tariff = { id: string; pence_per_kwh: number; is_default: boolean };
type Propulsion = "petrol" | "diesel" | "hybrid" | "phev" | "bev";
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
  encodedPolyline?: string;
  origin?: Place;
  destination?: Place;
  waypoints?: Place[];
  routeLabel?: string;
  durationTrafficSeconds?: number;
  alternatives?: Array<{
    id: string;
    label: string;
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
    costPence: number;
  }>;
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function tripPlace(label: string, pin: Place | null) {
  if (!pin) return label;
  return { lat: pin.lat, lng: pin.lng, label };
}

type ViaDraft = { id: string; text: string; pin: Place | null };

type FocusStop = "origin" | "destination" | number;

export function EstimatePage() {
  const reduce = usePrefersReducedMotion();
  const [health, setHealth] = useState<Health | null>(null);
  const [origin, setOrigin] = useState("Crawley");
  const [destination, setDestination] = useState("London");
  const [originPin, setOriginPin] = useState<Place | null>(() => findPlaceByLabel("Crawley") ?? null);
  const [destPin, setDestPin] = useState<Place | null>(() => findPlaceByLabel("London") ?? null);
  const [viaDrafts, setViaDrafts] = useState<ViaDraft[]>([]);
  const [focusStop, setFocusStop] = useState<FocusStop>("origin");
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [propulsion, setPropulsion] = useState<Propulsion>("petrol");
  const [catalogue, setCatalogue] = useState<CatalogueVehicle | null>(null);
  const [mpg, setMpg] = useState("40");
  const [tank, setTank] = useState("55");
  const [miKwh, setMiKwh] = useState("3.8");
  const [overrideMpg, setOverrideMpg] = useState("");
  const [overrideMiKwh, setOverrideMiKwh] = useState("");
  const [battery, setBattery] = useState("64");
  const [start, setStart] = useState("80");
  const [departsAt, setDepartsAt] = useState(nowLocal);
  const [maps, setMaps] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("inline");
  const [homePence, setHomePence] = useState("7.5");
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<"vehicle" | "journey" | null>(null);
  const [stale, setStale] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const estimateTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(estimateTimer.current), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const savedElectric =
    selectedVehicle?.propulsion === "bev" || selectedVehicle?.propulsion === "phev";

  const tripRef = useRef({
    origin,
    originPin,
    destination,
    destPin,
    viaDrafts,
    departsAt,
    propulsion,
    vehicleId,
    savedElectric,
    homePence,
  });
  tripRef.current = {
    origin,
    originPin,
    destination,
    destPin,
    viaDrafts,
    departsAt,
    propulsion,
    vehicleId,
    savedElectric,
    homePence,
  };

  useEffect(() => {
    if (!savedElectric || vehicleId === "inline") return;
    void api<{ tariffs: Tariff[] }>(`/v1/vehicles/${vehicleId}/tariffs`)
      .then((r) => {
        const home = r.tariffs.find((t) => t.is_default) ?? r.tariffs[0];
        if (home) setHomePence(String(home.pence_per_kwh));
      })
      .catch(() => undefined);
  }, [savedElectric, vehicleId]);

  useEffect(() => {
    void api<Health>("/health")
      .then(setHealth)
      .catch(() => setHealth(null));
    void api<{ vehicles: Vehicle[] }>("/v1/vehicles")
      .then((r) => setVehicles(r.vehicles))
      .catch(() => undefined);
    const cached = localStorage.getItem("brim:last-estimate");
    if (cached) {
      const parsed = JSON.parse(cached) as Estimate;
      setEstimate(parsed);
      setStale(true);
      if (parsed.origin) {
        setOrigin(parsed.origin.label);
        setOriginPin(parsed.origin);
      }
      if (parsed.destination) {
        setDestination(parsed.destination.label);
        setDestPin(parsed.destination);
      }
      if (parsed.waypoints) {
        setViaDrafts(
          parsed.waypoints.map((w) => ({ id: `${w.lat},${w.lng}`, text: w.label, pin: w })),
        );
      }
      setSelectedRouteId(parsed.alternatives?.[0]?.id);
    }
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("url") ?? params.get("text");
    if (shared) {
      setMaps(shared);
      void runMaps(shared);
    }
  }, []);

  function applyEstimate(json: Estimate) {
    setEstimate(json);
    setStale(false);
    localStorage.setItem("brim:last-estimate", JSON.stringify(json));
    if (json.origin) {
      setOrigin(json.origin.label);
      setOriginPin(json.origin);
    }
    if (json.destination) {
      setDestination(json.destination.label);
      setDestPin(json.destination);
    }
    if (json.waypoints) {
      setViaDrafts(
        json.waypoints.map((w) => ({ id: `${w.lat},${w.lng}`, text: w.label, pin: w })),
      );
    }
    setSelectedRouteId(json.alternatives?.[0]?.id);
  }

  async function runEstimate(body: unknown) {
    setLoading(true);
    setError(null);
    try {
      applyEstimate(await api<Estimate>("/v1/estimate", { method: "POST", body: JSON.stringify(body) }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not estimate. Check the places and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function runMaps(url: string) {
    setLoading(true);
    setError(null);
    try {
      applyEstimate(
        await api<Estimate>("/v1/estimate/from-maps-url", {
          method: "POST",
          body: JSON.stringify({ url }),
        }),
      );
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

  async function namePin(lat: number, lng: number): Promise<Place> {
    try {
      const place = await reversePlace(lat, lng);
      setGeoError(null);
      return place;
    } catch {
      setGeoError("Could not name that street - type the address.");
      return { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng };
    }
  }

  function onMapClick(pin: { lat: number; lng: number }) {
    void namePin(pin.lat, pin.lng).then((place) => {
      if (focusStop === "origin" || !originPin) {
        setOriginPin(place);
        setOrigin(place.label);
        setFocusStop("destination");
      } else if (typeof focusStop === "number") {
        setViaDrafts((drafts) =>
          drafts.map((d, i) => (i === focusStop ? { ...d, text: place.label, pin: place } : d)),
        );
      } else {
        setDestPin(place);
        setDestination(place.label);
      }
      scheduleEstimate();
    });
  }

  function onOriginDrag(pin: { lat: number; lng: number }) {
    void namePin(pin.lat, pin.lng).then((place) => {
      setOriginPin(place);
      setOrigin(place.label);
      scheduleEstimate();
    });
  }

  function onDestinationDrag(pin: { lat: number; lng: number }) {
    void namePin(pin.lat, pin.lng).then((place) => {
      setDestPin(place);
      setDestination(place.label);
      scheduleEstimate();
    });
  }

  function onWaypointDrag(index: number, pin: { lat: number; lng: number }) {
    void namePin(pin.lat, pin.lng).then((place) => {
      setViaDrafts((drafts) =>
        drafts.map((d, i) => (i === index ? { ...d, text: place.label, pin: place } : d)),
      );
      scheduleEstimate();
    });
  }

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("This browser cannot share a location - type a place or tap the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void namePin(pos.coords.latitude, pos.coords.longitude).then((place) => {
          setOriginPin(place);
          setOrigin(place.label);
          scheduleEstimate();
        });
      },
      () => {
        setGeoError("Location was blocked - type a place or tap the map.");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  function buildEstimateBody() {
    const trip = tripRef.current;
    const body: Record<string, unknown> = {
      origin: tripPlace(trip.origin, trip.originPin),
      destination: tripPlace(trip.destination, trip.destPin),
      departsAt: new Date(trip.departsAt).toISOString(),
      propulsion: trip.propulsion,
    };
    const vias = trip.viaDrafts
      .filter((v) => v.pin || v.text.trim())
      .map((v) => tripPlace(v.text, v.pin));
    if (vias.length > 0) body.waypoints = vias;
    if (trip.vehicleId === "inline") body.vehicleInline = vehicleInline();
    else {
      body.vehicleId = trip.vehicleId;
      if (trip.savedElectric) {
        const pence = Number(trip.homePence);
        if (Number.isFinite(pence) && pence > 0) {
          body.priceStrategy = "user-tariff";
          body.pricePence = pence;
        }
      }
    }
    return body;
  }

  function scheduleEstimate() {
    setStale(true);
    window.clearTimeout(estimateTimer.current);
    estimateTimer.current = window.setTimeout(() => {
      const trip = tripRef.current;
      if (!trip.origin.trim() || !trip.destination.trim()) return;
      void runEstimate(buildEstimateBody());
    }, 400);
  }

  function applyAlternative(id: string) {
    if (!estimate?.alternatives) return;
    const alt = estimate.alternatives.find((a) => a.id === id);
    if (!alt) return;
    setSelectedRouteId(id);
    setEstimate({
      ...estimate,
      encodedPolyline: alt.encodedPolyline,
      distanceMeters: alt.distanceMeters,
      durationSeconds: alt.durationSeconds,
      cost: {
        ...estimate.cost,
        totalPence: { ...estimate.cost.totalPence, point: alt.costPence },
      },
    });
  }

  function vehicleInline() {
    const useElectricFigure = propulsion === "bev" || (propulsion === "phev" && !catalogue);
    const overrideRaw = useElectricFigure
      ? catalogue
        ? overrideMiKwh
        : miKwh
      : catalogue
        ? overrideMpg
        : mpg;
    const overrideNum = Number(overrideRaw);
    const hasOverride = overrideRaw.trim() !== "" && Number.isFinite(overrideNum) && overrideNum > 0;

    const profile: Record<string, unknown> = {
      kind: "car",
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
      profile.userEnteredUnit = useElectricFigure ? "mi/kWh" : "mpg";
    }
    if (propulsion !== "bev") {
      const tankLitres = Number(tank);
      if (Number.isFinite(tankLitres) && tankLitres > 0) profile.tankLitres = tankLitres;
    }
    if (propulsion === "bev" || propulsion === "phev") {
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
    setOverrideMpg("");
    setOverrideMiKwh("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = buildEstimateBody();
    if (vehicleId !== "inline" && savedElectric) {
      const pence = Number(homePence);
      if (Number.isFinite(pence) && pence > 0) {
        void api(`/v1/vehicles/${vehicleId}/tariffs`, {
          method: "POST",
          body: JSON.stringify({ kind: "home", pencePerKwh: pence, isDefault: true }),
        }).catch(() => undefined);
      }
    }
    void runEstimate(body);
  }

  async function saveVehicle() {
    try {
      await api("/v1/vehicles", {
        method: "POST",
        body: JSON.stringify({
          nickname: catalogue ? `${catalogue.make} ${catalogue.model}` : `${propulsion} car`,
          ...vehicleInline(),
        }),
      });
      const list = await api<{ vehicles: Vehicle[] }>("/v1/vehicles");
      setVehicles(list.vehicles);
      toast("Saved. Sign in to keep this car on other devices.");
    } catch {
      setPendingSave("vehicle");
      setAuthOpen(true);
    }
  }

  async function saveJourney() {
    if (!estimate) return;
    try {
      await api("/v1/journeys", {
        method: "POST",
        body: JSON.stringify({
          origin,
          destination,
          vehicleId: vehicleId === "inline" ? undefined : vehicleId,
          estimate,
          departsAt,
        }),
      });
      toast("Journey stored as a snapshot.");
    } catch {
      setPendingSave("journey");
      setAuthOpen(true);
    }
  }

  async function onAuthSuccess() {
    setAuthOpen(false);
    const pending = pendingSave;
    setPendingSave(null);
    if (pending === "vehicle") await saveVehicle();
    if (pending === "journey") await saveJourney();
    const list = await api<{ vehicles: Vehicle[] }>("/v1/vehicles").catch(() => null);
    if (list) setVehicles(list.vehicles);
  }

  const pounds = estimate ? estimate.cost.totalPence.point / 100 : 0;
  const band = estimate
    ? `£${(estimate.cost.totalPence.low / 100).toFixed(0)}–£${(estimate.cost.totalPence.high / 100).toFixed(0)}`
    : "";
  const hmrc = useMemo(() => {
    if (!estimate?.hmrc) return null;
    return `HMRC would allow £${(estimate.hmrc.approvedPence / 100).toFixed(2)} (${estimate.hmrc.ytdMiles.toFixed(0)} miles this tax year).`;
  }, [estimate]);

  const viaPins = viaDrafts.map((v) => v.pin).filter((p): p is Place => Boolean(p));
  const mapProps = {
    onMapClick,
    onOriginDrag,
    onDestinationDrag,
    onWaypointDrag,
    onSelectAlternative: applyAlternative,
    reduceMotion: reduce,
    ...(originPin ? { origin: originPin } : {}),
    ...(destPin ? { destination: destPin } : {}),
    ...(viaPins.length > 0 ? { waypoints: viaPins } : {}),
    ...(estimate?.encodedPolyline ? { encodedPolyline: estimate.encodedPolyline } : {}),
    ...(estimate?.alternatives
      ? {
          alternatives: estimate.alternatives.map((a) => ({
            id: a.id,
            encodedPolyline: a.encodedPolyline,
          })),
        }
      : {}),
    ...(selectedRouteId ? { selectedRouteId } : {}),
  };

  const form = (
    <>
      <p className="mb-1 text-mist">True journey cost</p>
      <h1 className="display mb-4 text-2xl">Add your car and we will stop guessing.</h1>
      {health ? (
        <p className="tabular mb-4 text-xs text-mist">
          API {health.status}
          {health.fixtureMode ? " · fixtures" : ""}
        </p>
      ) : (
        <p className="mb-4 text-sm text-warning">
          Could not reach the API - start it with npm run dev:fixtures, then retry.
        </p>
      )}
      {stale ? (
        <p className="mb-4 text-sm text-warning">
          Showing the last estimate stored on this device. Move a pin or tap Estimate to refresh.
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
                    {v.nickname ?? [v.make, v.model].filter(Boolean).join(" ") ?? v.propulsion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        ) : null}
        {savedElectric ? (
          <FormItem>
            <Label htmlFor="home-pence">Home p/kWh</Label>
            <Input
              id="home-pence"
              value={homePence}
              onChange={(ev) => setHomePence(ev.target.value)}
              className="tabular"
            />
          </FormItem>
        ) : null}
        <FormItem>
          <AddressField
            id="origin"
            label="From"
            value={origin}
            onChange={(text) => {
              setOrigin(text);
              if (originPin && text !== originPin.label) setOriginPin(null);
            }}
            onFocusField={() => setFocusStop("origin")}
            onSelect={(place) => {
              setOrigin(place.label);
              setOriginPin(place);
              setFocusStop("destination");
              scheduleEstimate();
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={useMyLocation}>
            Use my location
          </Button>
          {geoError ? <p className="text-xs text-warning">{geoError}</p> : null}
        </FormItem>
        <FormItem>
          <AddressField
            id="destination"
            label="To"
            value={destination}
            onChange={(text) => {
              setDestination(text);
              if (destPin && text !== destPin.label) setDestPin(null);
            }}
            onFocusField={() => setFocusStop("destination")}
            onSelect={(place) => {
              setDestination(place.label);
              setDestPin(place);
              scheduleEstimate();
            }}
          />
        </FormItem>
        {viaDrafts.map((via, index) => (
          <FormItem key={via.id}>
            <AddressField
              id={`via-${via.id}`}
              label={`Stop ${index + 1}`}
              value={via.text}
              onChange={(text) =>
                setViaDrafts((drafts) =>
                  drafts.map((d, i) =>
                    i === index
                      ? { ...d, text, pin: d.pin && text === d.pin.label ? d.pin : null }
                      : d,
                  ),
                )
              }
              onFocusField={() => setFocusStop(index)}
              onSelect={(place) => {
                setViaDrafts((drafts) =>
                  drafts.map((d, i) => (i === index ? { ...d, text: place.label, pin: place } : d)),
                );
                scheduleEstimate();
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setViaDrafts((drafts) => drafts.filter((_, i) => i !== index));
                setFocusStop("destination");
              }}
            >
              Remove stop
            </Button>
          </FormItem>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setViaDrafts((drafts) => [...drafts, { id: crypto.randomUUID(), text: "", pin: null }]);
            setFocusStop(viaDrafts.length);
          }}
        >
          Add stop
        </Button>
        <FormItem>
          <Label htmlFor="leave">Leave</Label>
          <Input
            id="leave"
            type="datetime-local"
            value={departsAt}
            onChange={(ev) => setDepartsAt(ev.target.value)}
          />
        </FormItem>
        {vehicleId === "inline" ? (
          <>
            <FormItem>
              <VehicleCatalogue selected={catalogue} onSelect={onPickCar} />
            </FormItem>
            <FormItem>
              <Label>Propulsion</Label>
              {catalogue ? (
                <Badge>
                  {catalogue.propulsion === "bev"
                    ? "Electric"
                    : catalogue.propulsion === "phev"
                      ? "Plug-in hybrid"
                      : catalogue.propulsion === "hybrid"
                        ? "Hybrid"
                        : catalogue.propulsion === "diesel"
                          ? "Diesel"
                          : "Petrol"}
                </Badge>
              ) : (
                <Select value={propulsion} onValueChange={(v) => setPropulsion(v as Propulsion)}>
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
            {propulsion === "bev" || (propulsion === "phev" && !catalogue) ? (
              <>
                <FormItem>
                  <Label htmlFor="mikwh">{catalogue ? "Your mi/kWh (optional)" : "mi/kWh"}</Label>
                  <Input
                    id="mikwh"
                    value={catalogue ? overrideMiKwh : miKwh}
                    onChange={(ev) =>
                      catalogue ? setOverrideMiKwh(ev.target.value) : setMiKwh(ev.target.value)
                    }
                    className="tabular"
                    {...(catalogue ? { placeholder: "Leave blank to use the official figure" } : {})}
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
            {propulsion === "phev" && catalogue ? (
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
            {propulsion !== "bev" ? (
              <>
                {propulsion !== "phev" || catalogue ? (
                  <FormItem>
                    <Label htmlFor="mpg">{catalogue ? "Your mpg (optional)" : "mpg"}</Label>
                    <Input
                      id="mpg"
                      value={catalogue ? overrideMpg : mpg}
                      onChange={(ev) =>
                        catalogue ? setOverrideMpg(ev.target.value) : setMpg(ev.target.value)
                      }
                      className="tabular"
                      {...(catalogue ? { placeholder: "Leave blank to use the official figure" } : {})}
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
        <Button type="submit">{loading ? "Working out the number…" : "Estimate"}</Button>
      </Form>
    </>
  );

  const result: ReactNode =
    estimate && !loading ? (
      <m.section
        aria-live="polite"
        variants={staggerChildren}
        initial={reduce ? false : "initial"}
        animate="animate"
        className="glass p-4"
      >
        <m.div variants={reveal}>
          <PumpReadout value={pounds} layoutId="pump-readout" />
        </m.div>
        <m.p variants={reveal} className="tabular mt-2 text-mist">
          {band}
        </m.p>
        <m.div variants={reveal} className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="diesel">{estimate.consumption.label}</Badge>
          <span className="tabular text-sm">{estimate.consumption.display}</span>
        </m.div>
        {estimate.energy.arrivalStateOfCharge ? (
          <m.p variants={reveal} className="mt-2 text-sm">
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
          <m.p key={w.message} variants={reveal} className="mt-2 text-warning">
            {w.message}
          </m.p>
        ))}
        <m.div variants={reveal}>
          <Accordion type="single" collapsible className="mt-2">
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
        <m.p variants={reveal} className="mt-3 text-sm text-mist">
          Charges such as ULEZ and Dart Charge are not in this number yet. They will appear here
          when the charges layer ships.
        </m.p>
        <m.div variants={reveal} className="mt-4 flex flex-wrap gap-2">
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
    ) : null;

  return (
    <main className="relative mx-3 mb-3 h-[calc(100dvh-5.75rem)] overflow-hidden rounded-[2px] border border-glass-border">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center" aria-busy="true">
            <Skeleton className="h-full w-full" />
          </div>
        }
      >
        <RouteMap {...mapProps} />
      </Suspense>

      {wide ? (
        <aside className="absolute left-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto">
          <Card>{form}</Card>
        </aside>
      ) : null}

      <div className="absolute right-3 top-3 z-10 w-[min(20rem,calc(100%-1.5rem))]">
        {error ? <p className="mb-2 text-warning">{error}</p> : null}
        {loading ? (
          <Card aria-busy="true">
            <Skeleton className="mb-3 h-16 w-48" />
            <Skeleton className="h-4 w-24" />
          </Card>
        ) : null}
        <AnimatePresence>{result}</AnimatePresence>
      </div>

      {wide ? null : (
        <>
          <div className="absolute bottom-3 left-3 z-10">
            <Button type="button" onClick={() => setTripOpen(true)}>
              Edit trip
            </Button>
          </div>
          <Drawer open={tripOpen} onOpenChange={setTripOpen}>
            <DrawerContent className="max-h-[85vh] overflow-y-auto">{form}</DrawerContent>
          </Drawer>
        </>
      )}

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
