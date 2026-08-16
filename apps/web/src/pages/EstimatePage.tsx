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
import { arrivalCopy, findPlaceByLabel } from "@brim/shared";
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
import { euroFromVes, RegLookup, type VesSummary } from "../RegLookup.js";
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
  is_default?: boolean;
  has_heat_pump?: boolean;
};
type SavedPlace = { id: string; kind: "home" | "work" | "favourite"; label: string; lat: number; lng: number };
type Tariff = {
  id: string;
  pence_per_kwh: number;
  is_default: boolean;
  offpeak_pence?: number;
  offpeak_window?: string;
};
type EvNetworkRow = {
  id: string;
  network: string;
  speed: "ac" | "dc";
  pencePerKwh: number;
};
type Propulsion = "petrol" | "diesel" | "hybrid" | "phev" | "bev";
type VehicleKind = "car" | "van" | "motorcycle";
type Estimate = {
  cost: {
    totalPence: { point: number; low: number; high: number };
    energyPence: { point: number };
    chargesPence: number;
  };
  consumption: { label: string; display: string };
  reasons: string[];
  warnings: Array<{ message: string }>;
  energy: {
    arrivalStateOfCharge?: { percent: number; verdict: "comfortable" | "tight" | "insufficient"; shortfallKwh?: number };
  };
  co2Kg?: number;
  hmrc?: { approvedPence: number; deltaPence?: number; ytdMiles: number; crossedThreshold: boolean };
  distanceMeters: number;
  durationSeconds: number;
  charges: Array<{
    id: string;
    kind: "toll" | "zone_charge" | "restriction";
    name: string;
    pence: number;
    operatorUrl?: string;
    note?: string;
  }>;
  encodedPolyline?: string;
  origin?: Place;
  destination?: Place;
  waypoints?: Place[];
  routeLabel?: string;
  durationTrafficSeconds?: number;
  price?: {
    pence: number;
    unit: "ppl" | "p/kWh";
    source: string;
    stationId?: string;
    observedAt: string;
  };
  cheapestFill?: {
    litresToFill: number;
    baseline: { source: string; label: string };
    stations: Array<{
      stationId: string;
      name: string;
      lat: number;
      lng: number;
      pence: number;
      observedAt: string;
      detourKm: number;
      savingPence: number;
      brand?: string;
      openingHours?: string;
    }>;
  };
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

function priceSourceLabel(source: string): string {
  if (source === "national-median") return "National median";
  if (source === "home-area-median") return "Near your start";
  if (source === "cheapest-on-route") return "Cheapest fill on this route";
  if (source === "hardcoded-fallback") return "Price data unavailable";
  if (source === "user-tariff") return "Your tariff";
  if (source === "network-table") return "Public network table";
  return source;
}

function formatObservedAt(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "updated just now";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "updated just now";
  if (min < 60) return `updated ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 36) return `updated ${hr} h ago`;
  return `updated ${Math.round(hr / 24)} d ago`;
}

type NearbyStation = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  brand?: string;
};

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
  const [vehicleKind, setVehicleKind] = useState<VehicleKind>("car");
  const [vehicleYear, setVehicleYear] = useState("");
  const [euroStatus, setEuroStatus] = useState("");
  const [euroFromDvla, setEuroFromDvla] = useState(false);
  const [catalogue, setCatalogue] = useState<CatalogueVehicle | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [resolvedVrm, setResolvedVrm] = useState<string | undefined>();
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
  const [errorSource, setErrorSource] = useState<"maps" | "trip" | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("inline");
  const [homePence, setHomePence] = useState("7.5");
  const [offpeakPence, setOffpeakPence] = useState("");
  const [offpeakWindow, setOffpeakWindow] = useState("");
  const [chargingLocation, setChargingLocation] = useState<"home" | "public">("home");
  const [networkId, setNetworkId] = useState("");
  const [evNetworks, setEvNetworks] = useState<EvNetworkRow[]>([]);
  const [hasHeatPump, setHasHeatPump] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<"vehicle" | "journey" | "fill" | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillOdo, setFillOdo] = useState("");
  const [fillQty, setFillQty] = useState("");
  const [fillPrice, setFillPrice] = useState("");
  const [fillBrim, setFillBrim] = useState(true);
  const [fillWhen, setFillWhen] = useState("");
  const [fillStationId, setFillStationId] = useState("none");
  const [stale, setStale] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [stationId, setStationId] = useState<string | undefined>();
  const [priceStrategy, setPriceStrategy] = useState<string | undefined>();
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
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
  const savedBev = selectedVehicle?.propulsion === "bev";
  const electricTrip = propulsion === "bev" || propulsion === "phev" || savedElectric;

  const fillStations = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const s of nearbyStations) byId.set(s.id, { id: s.id, name: s.brand ? `${s.brand} · ${s.name}` : s.name });
    for (const s of estimate?.cheapestFill?.stations ?? []) {
      byId.set(s.stationId, { id: s.stationId, name: s.brand ? `${s.brand} · ${s.name}` : s.name });
    }
    return [...byId.values()];
  }, [nearbyStations, estimate?.cheapestFill]);

  useEffect(() => {
    if (!fillOpen) return;
    setFillStationId(stationId && fillStations.some((s) => s.id === stationId) ? stationId : "none");
  }, [fillOpen, stationId, fillStations]);

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
    electricTrip,
    homePence,
    offpeakPence,
    offpeakWindow,
    chargingLocation,
    networkId,
    hasHeatPump,
    start,
    stationId,
    priceStrategy,
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
    electricTrip,
    homePence,
    offpeakPence,
    offpeakWindow,
    chargingLocation,
    networkId,
    hasHeatPump,
    start,
    stationId,
    priceStrategy,
  };

  useEffect(() => {
    if (!savedElectric || vehicleId === "inline") return;
    void api<{ tariffs: Tariff[] }>(`/v1/vehicles/${vehicleId}/tariffs`)
      .then((r) => {
        const home = r.tariffs.find((t) => t.is_default) ?? r.tariffs[0];
        if (home) {
          setHomePence(String(home.pence_per_kwh));
          setOffpeakPence(home.offpeak_pence !== undefined ? String(home.offpeak_pence) : "");
          setOffpeakWindow(home.offpeak_window ?? "");
        }
      })
      .catch(() => undefined);
    setHasHeatPump(selectedVehicle?.has_heat_pump === true);
  }, [savedElectric, vehicleId, selectedVehicle?.has_heat_pump]);

  useEffect(() => {
    void api<{ networks: EvNetworkRow[] }>("/v1/meta/ev-tariffs")
      .then((r) => setEvNetworks(r.networks))
      .catch(() => setEvNetworks([]));
  }, []);

  useEffect(() => {
    if (!originPin || propulsion === "bev") {
      setNearbyStations([]);
      return;
    }
    const grade = propulsion === "diesel" ? "B7" : "E10";
    void api<{
      stations: Array<{ id: string; lat: number; lng: number; name: string; brand?: string }>;
    }>(`/v1/stations/near?lat=${originPin.lat}&lng=${originPin.lng}&grade=${grade}`)
      .then((r) => setNearbyStations(r.stations))
      .catch(() => setNearbyStations([]));
  }, [originPin, propulsion]);

  useEffect(() => {
    void api<Health>("/health")
      .then(setHealth)
      .catch(() => setHealth(null));
    void api<{ vehicles: Vehicle[] }>("/v1/vehicles")
      .then((r) => {
        setVehicles(r.vehicles);
        if (new URLSearchParams(window.location.search).get("journey")) return;
        const def = r.vehicles.find((v) => v.is_default) ?? r.vehicles[0];
        if (def) setVehicleId(def.id);
      })
      .catch(() => undefined);
    void api<{ places: SavedPlace[] }>("/v1/saved-places")
      .then((r) => setPlaces(r.places))
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
    const journeyId = params.get("journey");
    if (journeyId) {
      void api<{
        origin: string;
        destination: string;
        vehicleId?: string;
        originPin?: Place;
        destinationPin?: Place;
      }>(`/v1/journeys/${journeyId}`)
        .then((j) => {
          setOrigin(j.originPin?.label ?? j.origin);
          setDestination(j.destinationPin?.label ?? j.destination);
          if (j.originPin) setOriginPin(j.originPin);
          if (j.destinationPin) setDestPin(j.destinationPin);
          if (j.vehicleId) setVehicleId(j.vehicleId);
        })
        .catch(() => undefined);
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
    setErrorSource(null);
    try {
      applyEstimate(await api<Estimate>("/v1/estimate", { method: "POST", body: JSON.stringify(body) }));
    } catch (err) {
      setErrorSource("trip");
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
    setErrorSource(null);
    try {
      applyEstimate(
        await api<Estimate>("/v1/estimate/from-maps-url", {
          method: "POST",
          body: JSON.stringify({ url }),
        }),
      );
    } catch (err) {
      setErrorSource("maps");
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
    else body.vehicleId = trip.vehicleId;
    if (trip.stationId && trip.propulsion !== "bev") body.stationId = trip.stationId;
    if (trip.priceStrategy && trip.propulsion !== "bev") body.priceStrategy = trip.priceStrategy;
    if (trip.electricTrip) {
      body.chargingLocation = trip.chargingLocation;
      body.hasHeatPump = trip.hasHeatPump;
      const startPct = Number(trip.start);
      if (Number.isFinite(startPct) && startPct > 0) body.startChargePercent = startPct;
      const pence = Number(trip.homePence);
      if (trip.chargingLocation === "public") {
        if (trip.networkId) {
          body.network = trip.networkId;
          const picked = evNetworks.find((n) => n.id === trip.networkId);
          if (picked) body.chargingSpeed = picked.speed;
          if (Number.isFinite(pence) && pence > 0) body.pricePence = pence;
        }
      } else if (Number.isFinite(pence) && pence > 0) {
        body.priceStrategy = "user-tariff";
        body.pricePence = pence;
        const offpeak = Number(trip.offpeakPence);
        if (Number.isFinite(offpeak) && offpeak > 0) body.offpeakPence = offpeak;
        if (trip.offpeakWindow.trim()) body.offpeakWindow = trip.offpeakWindow.trim();
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
      kind: vehicleKind,
      propulsion,
    };
    const year = Number(vehicleYear);
    if (Number.isFinite(year) && year >= 1970) profile.year = year;
    if (euroStatus) {
      profile.euroStatus = euroStatus;
      profile.euroStatusSource = euroFromDvla ? "dvla" : "derived";
    }
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
      profile.hasHeatPump = hasHeatPump;
    }
    return profile;
  }

  function onPickCar(next: CatalogueVehicle | null) {
    setCatalogue(next);
    if (next) setPropulsion(next.propulsion);
    setOverrideMpg("");
    setOverrideMiKwh("");
  }

  function applyVes(ves: VesSummary, vrm: string) {
    setResolvedVrm(vrm);
    if (ves.year !== undefined) setVehicleYear(String(ves.year));
    const euro = euroFromVes(ves.euroStatus);
    if (euro) {
      setEuroStatus(euro);
      setEuroFromDvla(true);
    }
    setPropulsion(ves.propulsion);
  }

  function onPickFromReg(vehicle: CatalogueVehicle, vrm: string, ves: VesSummary) {
    onPickCar(vehicle);
    applyVes(ves, vrm);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = buildEstimateBody();
    if (vehicleId !== "inline" && savedElectric) {
      const pence = Number(homePence);
      if (Number.isFinite(pence) && pence > 0) {
        const payload: Record<string, unknown> = { kind: "home", pencePerKwh: pence, isDefault: true };
        const offpeak = Number(offpeakPence);
        if (Number.isFinite(offpeak) && offpeak > 0) payload.offpeakPence = offpeak;
        if (offpeakWindow.trim()) payload.offpeakWindow = offpeakWindow.trim();
        void api(`/v1/vehicles/${vehicleId}/tariffs`, {
          method: "POST",
          body: JSON.stringify(payload),
        }).catch(() => undefined);
      }
      void api(`/v1/vehicles/${vehicleId}`, {
        method: "PATCH",
        body: JSON.stringify({ hasHeatPump }),
      }).catch(() => undefined);
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
          ...(resolvedVrm ? { vrm: resolvedVrm } : {}),
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
    if (pending === "fill") setFillOpen(true);
    const list = await api<{ vehicles: Vehicle[] }>("/v1/vehicles").catch(() => null);
    if (list) setVehicles(list.vehicles);
  }

  const pounds = estimate ? estimate.cost.totalPence.point / 100 : 0;
  const band = estimate
    ? `£${(estimate.cost.totalPence.low / 100).toFixed(0)}–£${(estimate.cost.totalPence.high / 100).toFixed(0)}`
    : "";
  const hmrc = useMemo(() => {
    if (!estimate?.hmrc) return null;
    const allow = `HMRC would allow £${(estimate.hmrc.approvedPence / 100).toFixed(2)} (${estimate.hmrc.ytdMiles.toFixed(0)} miles this tax year).`;
    if (estimate.hmrc.deltaPence === undefined) return allow;
    const abs = (Math.abs(estimate.hmrc.deltaPence) / 100).toFixed(2);
    const delta =
      estimate.hmrc.deltaPence > 0
        ? `This trip is £${abs} over the allowance.`
        : estimate.hmrc.deltaPence < 0
          ? `This trip is £${abs} under the allowance.`
          : "This trip is in line with the allowance.";
    return `${allow} ${delta}`;
  }, [estimate]);

  const viaPins = viaDrafts.map((v) => v.pin).filter((p): p is Place => Boolean(p));
  const stationOverlays = useMemo(() => {
    const byId = new Map<string, NearbyStation>();
    for (const s of nearbyStations) byId.set(s.id, s);
    for (const s of estimate?.cheapestFill?.stations ?? []) {
      byId.set(s.stationId, {
        id: s.stationId,
        lat: s.lat,
        lng: s.lng,
        name: s.name,
        ...(s.brand ? { brand: s.brand } : {}),
      });
    }
    const stations = [...byId.values()];
    if (stations.length === 0) return undefined;
    return {
      stations: stations.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        label: s.brand ? `${s.brand} · ${s.name}` : s.name,
      })),
      ...(stationId ? { selectedStationId: stationId } : {}),
    };
  }, [nearbyStations, estimate?.cheapestFill, stationId]);
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
    onSelectStation: (id: string) => {
      setStationId(id);
      setPriceStrategy(undefined);
      tripRef.current = { ...tripRef.current, stationId: id, priceStrategy: undefined };
      scheduleEstimate();
    },
    ...(stationOverlays ? { overlays: stationOverlays } : {}),
  };

  const originDescribedBy = [geoError ? "geo-error" : "", errorSource === "trip" && error ? "trip-error" : ""]
    .filter((id) => id.length > 0)
    .join(" ");
  const destDescribedBy = errorSource === "trip" && error ? "trip-error" : "";

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
            aria-invalid={errorSource === "maps" && Boolean(error) ? true : undefined}
            aria-describedby={errorSource === "maps" && error ? "maps-error maps-help" : "maps-help"}
          />
          <p id="maps-help" className="text-xs text-mist">
            A Google, Apple, or Bing Maps directions link. If it cannot be read, type the places below.
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
        {electricTrip ? (
          <>
            <p className="text-sm text-mist">
              Petrol prices are live from the government feed. EV charging prices are estimates you
              can correct.
            </p>
            <FormItem>
              <Label>Charge where</Label>
              <Select
                value={chargingLocation}
                onValueChange={(v) => setChargingLocation(v as "home" | "public")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="public">Public network</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
            {chargingLocation === "public" ? (
              <FormItem>
                <Label>Network</Label>
                <Select
                  value={networkId}
                  onValueChange={(id) => {
                    setNetworkId(id);
                    const row = evNetworks.find((n) => n.id === id);
                    if (row) setHomePence(String(row.pencePerKwh));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a network" />
                  </SelectTrigger>
                  <SelectContent>
                    {evNetworks.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.network} ({n.speed.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            ) : null}
            <FormItem>
              <Label htmlFor="home-pence">
                {chargingLocation === "public" ? "p/kWh (editable)" : "Home p/kWh"}
              </Label>
              <Input
                id="home-pence"
                value={homePence}
                onChange={(ev) => setHomePence(ev.target.value)}
                className="tabular"
              />
            </FormItem>
            {chargingLocation === "home" ? (
              <>
                <FormItem>
                  <Label htmlFor="offpeak-pence">Off-peak p/kWh (optional)</Label>
                  <Input
                    id="offpeak-pence"
                    value={offpeakPence}
                    onChange={(ev) => setOffpeakPence(ev.target.value)}
                    className="tabular"
                  />
                </FormItem>
                <FormItem>
                  <Label htmlFor="offpeak-window">Off-peak window</Label>
                  <Input
                    id="offpeak-window"
                    value={offpeakWindow}
                    onChange={(ev) => setOffpeakWindow(ev.target.value)}
                    placeholder="00:30-05:30"
                  />
                </FormItem>
              </>
            ) : null}
            <FormItem>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasHeatPump}
                  onChange={(ev) => setHasHeatPump(ev.target.checked)}
                />
                Heat pump
              </label>
            </FormItem>
          </>
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
            invalid={errorSource === "trip" && Boolean(error)}
            {...(originDescribedBy ? { describedBy: originDescribedBy } : {})}
          />
          <Button type="button" variant="ghost" size="sm" onClick={useMyLocation}>
            Use my location
          </Button>
          {places.some((p) => p.kind === "home" || p.kind === "work") ? (
            <div className="mt-1 flex gap-2">
              {places
                .filter((p) => p.kind === "home" || p.kind === "work")
                .map((p) => (
                  <Button
                    key={`from-${p.id}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOrigin(p.label);
                      setOriginPin({ label: p.label, lat: p.lat, lng: p.lng });
                      setFocusStop("destination");
                      scheduleEstimate();
                    }}
                  >
                    {p.kind === "home" ? "Home" : "Work"}
                  </Button>
                ))}
            </div>
          ) : null}
          {geoError ? (
            <p id="geo-error" className="text-xs text-warning" role="alert">
              {geoError}
            </p>
          ) : null}
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
            invalid={errorSource === "trip" && Boolean(error)}
            {...(destDescribedBy ? { describedBy: destDescribedBy } : {})}
          />
          {places.some((p) => p.kind === "home" || p.kind === "work") ? (
            <div className="mt-1 flex gap-2">
              {places
                .filter((p) => p.kind === "home" || p.kind === "work")
                .map((p) => (
                  <Button
                    key={`to-${p.id}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDestination(p.label);
                      setDestPin({ label: p.label, lat: p.lat, lng: p.lng });
                      scheduleEstimate();
                    }}
                  >
                    {p.kind === "home" ? "Home" : "Work"}
                  </Button>
                ))}
            </div>
          ) : null}
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
              <RegLookup
                onPick={onPickFromReg}
                onChangeCar={() => setCatalogueOpen(true)}
                onVesOnly={applyVes}
              />
            </FormItem>
            <FormItem>
              <VehicleCatalogue
                selected={catalogue}
                onSelect={onPickCar}
                open={catalogueOpen}
                onOpenChange={setCatalogueOpen}
              />
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
            <FormItem>
              <Label>Vehicle class</Label>
              <Select value={vehicleKind} onValueChange={(v) => setVehicleKind(v as VehicleKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
            <FormItem>
              <Label htmlFor="year">Year of first registration</Label>
              <Input
                id="year"
                className="tabular"
                inputMode="numeric"
                value={vehicleYear}
                onChange={(ev) => setVehicleYear(ev.target.value)}
                placeholder="Optional"
              />
            </FormItem>
            <FormItem>
              <Label>Euro standard</Label>
              <Select
                value={euroStatus || "unknown"}
                onValueChange={(v) => {
                  setEuroStatus(v === "unknown" ? "" : v);
                  setEuroFromDvla(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="Euro 3">Euro 3</SelectItem>
                  <SelectItem value="Euro 4">Euro 4</SelectItem>
                  <SelectItem value="Euro 5">Euro 5</SelectItem>
                  <SelectItem value="Euro 6">Euro 6</SelectItem>
                </SelectContent>
              </Select>
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
        {estimate.price ? (
          <m.p
            variants={reveal}
            className={
              estimate.price.source === "hardcoded-fallback"
                ? "mt-2 text-sm text-warning"
                : "mt-2 text-sm text-mist"
            }
          >
            <span className="tabular">
              {estimate.price.pence.toFixed(1)} {estimate.price.unit}
            </span>
            {" · "}
            {priceSourceLabel(estimate.price.source)}
            {estimate.price.source !== "hardcoded-fallback"
              ? ` · ${formatObservedAt(estimate.price.observedAt)}`
              : null}
          </m.p>
        ) : null}
        {estimate.cheapestFill?.stations[0] ? (
          <m.div variants={reveal} className="mt-3">
            <button
              type="button"
              className="w-full rounded-[2px] border border-glass-border p-3 text-left"
              onClick={() => {
                const picked = estimate.cheapestFill?.stations[0];
                if (!picked) return;
                setStationId(picked.stationId);
                setPriceStrategy("cheapest-on-route");
                tripRef.current = {
                  ...tripRef.current,
                  stationId: picked.stationId,
                  priceStrategy: "cheapest-on-route",
                };
                scheduleEstimate();
              }}
            >
              <p className="text-sm">
                {estimate.cheapestFill.stations[0].brand
                  ? `${estimate.cheapestFill.stations[0].brand} · ${estimate.cheapestFill.stations[0].name}`
                  : estimate.cheapestFill.stations[0].name}
              </p>
              <p className="tabular text-sm">
                {estimate.cheapestFill.stations[0].pence.toFixed(1)} ppl
                {" · "}
                {formatObservedAt(estimate.cheapestFill.stations[0].observedAt)}
              </p>
              <p className="tabular mt-1 text-sm text-mist">
                {estimate.cheapestFill.stations[0].detourKm.toFixed(1)} km assumed detour · save £
                {(estimate.cheapestFill.stations[0].savingPence / 100).toFixed(2)} versus filling{" "}
                {estimate.cheapestFill.baseline.label}
              </p>
              {estimate.cheapestFill.stations[0].openingHours ? (
                <p className="mt-1 text-sm text-mist">{estimate.cheapestFill.stations[0].openingHours}</p>
              ) : null}
            </button>
          </m.div>
        ) : null}
        <m.div variants={reveal} className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="diesel">{estimate.consumption.label}</Badge>
          <span className="tabular text-sm">{estimate.consumption.display}</span>
        </m.div>
        {estimate.energy.arrivalStateOfCharge ? (
          <m.p variants={reveal} className="mt-2 text-sm">
            {arrivalCopy(estimate.energy.arrivalStateOfCharge)}
          </m.p>
        ) : null}
        {typeof estimate.co2Kg === "number" ? (
          <m.p variants={reveal} className="tabular mt-2 text-sm text-mist">
            About {estimate.co2Kg.toFixed(1)} kg CO₂
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
        {estimate.charges.length > 0 ? (
          <m.ul variants={reveal} className="mt-3 grid gap-2 text-sm">
            {estimate.charges.map((charge) => (
              <li key={charge.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {charge.name}
                  {charge.kind === "restriction" ? (
                    <span className="block text-warning">
                      {charge.note ?? "Your vehicle cannot enter this zone."}
                    </span>
                  ) : null}
                </span>
                {charge.kind === "restriction" ? (
                  <span className="text-mist">No charge</span>
                ) : (
                  <span className="tabular">£{(charge.pence / 100).toFixed(2)}</span>
                )}
                {charge.operatorUrl ? (
                  <a
                    href={charge.operatorUrl}
                    className="basis-full text-sm underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check with the operator
                  </a>
                ) : null}
              </li>
            ))}
          </m.ul>
        ) : null}
        <m.p variants={reveal} className="mt-3 text-sm text-mist">
          Brim is an estimate. You remain responsible for paying or staying out. Cars, vans and
          motorcycles only; HGV, bus and taxi classes are not modelled.
        </m.p>
        <m.div variants={reveal} className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => void saveVehicle()}>
            Save this car
          </Button>
          <Button type="button" variant="ghost" onClick={() => void saveJourney()}>
            Save journey
          </Button>
          {vehicleId !== "inline" ? (
            <Button type="button" variant="ghost" onClick={() => setFillOpen(true)}>
              {savedBev ? "Log a charge" : "Log a fill-up"}
            </Button>
          ) : null}
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
        {error ? (
          <p
            id={errorSource === "maps" ? "maps-error" : "trip-error"}
            className="mb-2 text-warning"
            role="alert"
          >
            {error}
          </p>
        ) : null}
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
      <Dialog open={fillOpen} onOpenChange={setFillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{savedBev ? "Log a charge" : "Log a fill-up"}</DialogTitle>
            <DialogDescription>
              Odometer, quantity, {savedBev ? "full" : "brim"}. Used to correct the brochure figure.
            </DialogDescription>
          </DialogHeader>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              const pounds = Number(fillPrice);
              const when = fillWhen.trim() ? new Date(fillWhen) : undefined;
              void api("/v1/fill-ups", {
                method: "POST",
                body: JSON.stringify({
                  vehicleId,
                  odometerMiles: Number(fillOdo),
                  quantity: Number(fillQty),
                  unit: savedBev ? "kwh" : "litres",
                  price: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
                  brim: fillBrim,
                  ...(when && Number.isFinite(when.getTime()) ? { occurredAt: when.toISOString() } : {}),
                  ...(!savedBev && fillStationId !== "none" ? { stationId: fillStationId } : {}),
                }),
              })
                .then(async () => {
                  setFillOpen(false);
                  setFillOdo("");
                  setFillQty("");
                  setFillPrice("");
                  setFillWhen("");
                  const cal = await api<{ confidence: string }>(`/v1/vehicles/${vehicleId}/calibration`).catch(
                    () => null,
                  );
                  toast(
                    cal?.confidence === "calibrated"
                      ? "Stored. Estimates will now use your fill-ups."
                      : "Stored.",
                  );
                  void runEstimate(buildEstimateBody());
                })
                .catch((err: unknown) => {
                  const message = err instanceof Error ? err.message : "";
                  if (message === "odometer_rollback") {
                    toast("Odometer must be higher than the last fill-up.");
                    return;
                  }
                  if (message === "unit_mismatch") {
                    toast("That quantity unit does not match this car.");
                    return;
                  }
                  if (message === "unknown_station") {
                    toast("That station is not in the price feed.");
                    return;
                  }
                  setPendingSave("fill");
                  setFillOpen(false);
                  setAuthOpen(true);
                });
            }}
          >
            <FormItem>
              <Label htmlFor="est-odo">Odometer miles</Label>
              <Input id="est-odo" className="tabular" value={fillOdo} onChange={(ev) => setFillOdo(ev.target.value)} required />
            </FormItem>
            <FormItem>
              <Label htmlFor="est-qty">{savedBev ? "kWh" : "Litres"}</Label>
              <Input id="est-qty" className="tabular" value={fillQty} onChange={(ev) => setFillQty(ev.target.value)} required />
            </FormItem>
            <FormItem>
              <Label htmlFor="est-gbp">Price £</Label>
              <Input id="est-gbp" className="tabular" value={fillPrice} onChange={(ev) => setFillPrice(ev.target.value)} />
            </FormItem>
            <FormItem>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fillBrim} onChange={(ev) => setFillBrim(ev.target.checked)} />
                {savedBev ? "Charged to full" : "Filled to brim"}
              </label>
            </FormItem>
            <FormItem>
              <Label htmlFor="est-when">When</Label>
              <Input
                id="est-when"
                type="datetime-local"
                value={fillWhen}
                onChange={(ev) => setFillWhen(ev.target.value)}
              />
            </FormItem>
            {!savedBev && fillStations.length > 0 ? (
              <FormItem>
                <Label>Station (optional)</Label>
                <Select value={fillStationId} onValueChange={setFillStationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Skip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Skip</SelectItem>
                    {fillStations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            ) : null}
            <Button type="submit" className="mt-2">
              {savedBev ? "Store charge" : "Store fill-up"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
