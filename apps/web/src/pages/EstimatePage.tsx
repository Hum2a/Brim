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
import { PumpReadout, fade, fadeUp, reveal, staggerChildren, usePrefersReducedMotion } from "@brim/ui-kit";
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
import { Drawer, DrawerContent, DrawerTitle } from "@brim/ui-kit/drawer";
import { Form, FormItem } from "@brim/ui-kit/form";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@brim/ui-kit/select";
import { Skeleton } from "@brim/ui-kit/skeleton";
import { toast } from "@brim/ui-kit/toast";
import { api, asList } from "../api.js";
import { reversePlace } from "../places-client.js";
import { euroFromVes, savedPlaceChipLabel, vehicleChipLabel } from "../estimate/vehicle-label.js";
import type { VesSummary } from "../RegLookup.js";
import { type CatalogueVehicle } from "../VehicleCatalogue.js";
import { useMediaQuery } from "../use-media-query.js";
import { PinHud } from "../estimate/PinHud.js";
import { TripComposer } from "../estimate/TripComposer.js";
import type {
  EvNetworkRow,
  FocusStop,
  Health,
  MapBias,
  Place,
  Propulsion,
  SavedPlace,
  Vehicle,
  VehicleKind,
  ViaDraft,
} from "../estimate/types.js";

const RouteMap = lazy(() => import("../RouteMap.js"));
const AuthPanel = lazy(() => import("../AuthPanel.js").then((mod) => ({ default: mod.AuthPanel })));
const VehicleSheet = lazy(() =>
  import("../estimate/VehicleSheet.js").then((mod) => ({ default: mod.VehicleSheet })),
);

type Tariff = {
  id: string;
  pence_per_kwh: number;
  is_default: boolean;
  offpeak_pence?: number;
  offpeak_window?: string;
};
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
  const revealed = useRef(false);
  const savedTimer = useRef(0);
  const [savedLabel, setSavedLabel] = useState<"vehicle" | "journey" | null>(null);
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
  const [carOpen, setCarOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [pinArmed, setPinArmed] = useState(true);
  const [recents, setRecents] = useState<Place[]>([]);
  const [mapBias, setMapBias] = useState<MapBias | undefined>();
  const [resultOpen, setResultOpen] = useState(false);
  const [stationId, setStationId] = useState<string | undefined>();
  const [priceStrategy, setPriceStrategy] = useState<string | undefined>();
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const wide = useMediaQuery("(min-width: 1024px)");
  const estimateTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(estimateTimer.current), []);

  const garage = asList(vehicles);
  const selectedVehicle = garage.find((v) => v.id === vehicleId);
  const savedElectric =
    selectedVehicle?.propulsion === "bev" || selectedVehicle?.propulsion === "phev";
  const savedBev = selectedVehicle?.propulsion === "bev";
  const electricTrip = propulsion === "bev" || propulsion === "phev" || savedElectric;

  const fillStations = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const s of nearbyStations ?? []) byId.set(s.id, { id: s.id, name: s.brand ? `${s.brand} · ${s.name}` : s.name });
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
        const tariffs = asList(r.tariffs);
        const home = tariffs.find((t) => t.is_default) ?? tariffs[0];
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
    if (estimate) revealed.current = true;
  }, [estimate]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  useEffect(() => {
    void api<{ networks: EvNetworkRow[] }>("/v1/meta/ev-tariffs")
      .then((r) => setEvNetworks(asList(r.networks)))
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
      .then((r) => setNearbyStations(asList(r.stations)))
      .catch(() => setNearbyStations([]));
  }, [originPin, propulsion]);

  useEffect(() => {
    void api<Health>("/health")
      .then(setHealth)
      .catch(() => setHealth(null));
    void api<{ vehicles: Vehicle[] }>("/v1/vehicles")
      .then((r) => {
        const cars = asList(r.vehicles);
        setVehicles(cars);
        if (new URLSearchParams(window.location.search).get("journey")) return;
        const def = cars.find((v) => v.is_default) ?? cars[0];
        if (def) setVehicleId(def.id);
      })
      .catch(() => undefined);
    void api<{ places: SavedPlace[] }>("/v1/saved-places")
      .then((r) => setPlaces(asList(r.places)))
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
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
        setComposerOpen(false);
      }
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

  function applyEstimate(json: Estimate, collapse = false) {
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
    if (collapse) setComposerOpen(false);
  }

  async function runEstimate(body: unknown, collapse = false) {
    setLoading(true);
    setError(null);
    setErrorSource(null);
    try {
      applyEstimate(await api<Estimate>("/v1/estimate", { method: "POST", body: JSON.stringify(body) }), collapse);
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
        true,
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

  function rememberPlace(place: Place) {
    setRecents((prev) => {
      const next = [
        place,
        ...prev.filter((p) => p.label !== place.label && (p.lat !== place.lat || p.lng !== place.lng)),
      ];
      return next.slice(0, 5);
    });
  }

  function armPin(stop: FocusStop) {
    setFocusStop(stop);
    setPinArmed(true);
    setTripOpen(false);
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
    if (!pinArmed) return;
    void namePin(pin.lat, pin.lng).then((place) => {
      rememberPlace(place);
      if (focusStop === "origin" || !originPin) {
        setOriginPin(place);
        setOrigin(place.label);
        setFocusStop("destination");
        setPinArmed(true);
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
      rememberPlace(place);
      setOriginPin(place);
      setOrigin(place.label);
      scheduleEstimate();
    });
  }

  function onDestinationDrag(pin: { lat: number; lng: number }) {
    void namePin(pin.lat, pin.lng).then((place) => {
      rememberPlace(place);
      setDestPin(place);
      setDestination(place.label);
      scheduleEstimate();
    });
  }

  function onWaypointDrag(index: number, pin: { lat: number; lng: number }) {
    void namePin(pin.lat, pin.lng).then((place) => {
      rememberPlace(place);
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
          rememberPlace(place);
          setOriginPin(place);
          setOrigin(place.label);
          setFocusStop("destination");
          setPinArmed(true);
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
    void runEstimate(body, true);
  }

  function flashSaved(kind: "vehicle" | "journey") {
    window.clearTimeout(savedTimer.current);
    setSavedLabel(kind);
    savedTimer.current = window.setTimeout(() => setSavedLabel(null), 1200);
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
      setVehicles(asList(list.vehicles));
      flashSaved("vehicle");
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
      flashSaved("journey");
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
    if (list) setVehicles(asList(list.vehicles));
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
    for (const s of nearbyStations ?? []) byId.set(s.id, s);
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
    pinArmed,
    onViewChange: (center: { lat: number; lng: number }) => setMapBias(center),
  };

  const originDescribedBy = [geoError ? "geo-error" : "", errorSource === "trip" && error ? "trip-error" : ""]
    .filter((id) => id.length > 0)
    .join(" ");
  const destDescribedBy = errorSource === "trip" && error ? "trip-error" : "";
  const bias = mapBias ?? (originPin ? { lat: originPin.lat, lng: originPin.lng } : undefined);
  const carLabel = vehicleChipLabel({
    vehicleId,
    ...(selectedVehicle ? { selected: selectedVehicle } : {}),
    catalogue,
    propulsion,
    vehicleKind,
  });

  function applySaved(stop: FocusStop, place: Place) {
    rememberPlace(place);
    if (stop === "origin") {
      setOrigin(place.label);
      setOriginPin(place);
      setFocusStop("destination");
      setPinArmed(true);
    } else if (typeof stop === "number") {
      setViaDrafts((drafts) =>
        drafts.map((d, i) => (i === stop ? { ...d, text: place.label, pin: place } : d)),
      );
    } else {
      setDestination(place.label);
      setDestPin(place);
    }
    scheduleEstimate();
  }

  function shortcutButtons(stop: FocusStop) {
    const chips: ReactNode[] = [];
    if (stop === "origin") {
      chips.push(
        <Button key="loc" type="button" variant="ghost" size="sm" onClick={useMyLocation}>
          My location
        </Button>,
      );
    }
    for (const p of places) {
      chips.push(
        <Button
          key={`${stop}-${p.id}`}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => applySaved(stop, { label: p.label, lat: p.lat, lng: p.lng })}
        >
          {savedPlaceChipLabel(p.kind, p.label)}
        </Button>,
      );
    }
    for (const p of recents) {
      if (places.some((s) => s.label === p.label)) continue;
      if (stop === "origin" && originPin?.label === p.label) continue;
      if (stop === "destination" && destPin?.label === p.label) continue;
      chips.push(
        <Button
          key={`${stop}-recent-${p.label}`}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => applySaved(stop, p)}
        >
          {p.label.split(",")[0] ?? p.label}
        </Button>,
      );
    }
    return chips;
  }

  const composer = (
    <TripComposer
      collapsed={Boolean(wide && estimate && !composerOpen)}
      onExpand={() => setComposerOpen(true)}
      health={health}
      stale={stale}
      maps={maps}
      setMaps={setMaps}
      mapsInvalid={errorSource === "maps" && Boolean(error)}
      onMapsSubmit={() => void runMaps(maps)}
      origin={origin}
      destination={destination}
      originPin={originPin}
      destPin={destPin}
      viaDrafts={viaDrafts}
      focusStop={focusStop}
      pinArmed={pinArmed}
      onArmPin={armPin}
      onFocusStop={(stop) => setFocusStop(stop)}
      onOriginChange={(text) => {
        setOrigin(text);
        if (originPin && text !== originPin.label) setOriginPin(null);
      }}
      onOriginSelect={(place) => {
        rememberPlace(place);
        setOrigin(place.label);
        setOriginPin(place);
        setFocusStop("destination");
        setPinArmed(true);
        scheduleEstimate();
      }}
      onOriginClear={() => {
        setOrigin("");
        setOriginPin(null);
      }}
      onDestinationChange={(text) => {
        setDestination(text);
        if (destPin && text !== destPin.label) setDestPin(null);
      }}
      onDestinationSelect={(place) => {
        rememberPlace(place);
        setDestination(place.label);
        setDestPin(place);
        scheduleEstimate();
      }}
      onDestinationClear={() => {
        setDestination("");
        setDestPin(null);
      }}
      onViaChange={(index, text) =>
        setViaDrafts((drafts) =>
          drafts.map((d, i) =>
            i === index ? { ...d, text, pin: d.pin && text === d.pin.label ? d.pin : null } : d,
          ),
        )
      }
      onViaSelect={(index, place) => {
        rememberPlace(place);
        setViaDrafts((drafts) =>
          drafts.map((d, i) => (i === index ? { ...d, text: place.label, pin: place } : d)),
        );
        scheduleEstimate();
      }}
      onViaClear={(index) =>
        setViaDrafts((drafts) => drafts.map((d, i) => (i === index ? { ...d, text: "", pin: null } : d)))
      }
      onRemoveVia={(index) => {
        setViaDrafts((drafts) => drafts.filter((_, i) => i !== index));
        setFocusStop("destination");
      }}
      onAddStop={() => {
        setViaDrafts((drafts) => [...drafts, { id: crypto.randomUUID(), text: "", pin: null }]);
        armPin(viaDrafts.length);
      }}
      departsAt={departsAt}
      setDepartsAt={setDepartsAt}
      onNow={() => setDepartsAt(nowLocal())}
      loading={loading}
      onSubmit={onSubmit}
      geoError={geoError}
      originDescribedBy={originDescribedBy}
      destDescribedBy={destDescribedBy}
      tripInvalid={errorSource === "trip" && Boolean(error)}
      originShortcuts={shortcutButtons("origin")}
      destShortcuts={shortcutButtons("destination")}
      viaShortcuts={(index) => shortcutButtons(index)}
      vehicleLabel={carLabel}
      onOpenVehicle={() => setCarOpen(true)}
      {...(bias ? { bias } : {})}
    />
  );

  const shouldStagger = Boolean(estimate) && !revealed.current && !reduce;
  const showResultDetail = wide || resultOpen;
  const result: ReactNode =
    estimate ? (
      <m.section
        key="result"
        aria-live="polite"
        {...(shouldStagger
          ? { variants: staggerChildren, initial: "initial" as const }
          : { initial: false as const })}
        animate="animate"
        exit={reduce ? fade.exit : fadeUp.exit}
        transition={fadeUp.transition}
        className={
          wide
            ? "cq relative rounded-[2px] border border-border bg-card p-4"
            : "cq relative bg-card p-3"
        }
      >
        {loading ? <div className="absolute inset-0 z-10 bg-forecourt/40" aria-busy="true" /> : null}
        <m.div {...(shouldStagger ? { variants: reveal } : {})}>
          <PumpReadout value={pounds} />
        </m.div>
        <m.p {...(shouldStagger ? { variants: reveal } : {})} className="tabular mt-2 text-mist">
          {band}
        </m.p>
        {estimate.warnings.map((w) => (
          <p key={w.message} className="mt-2 text-warning">
            {w.message}
          </p>
        ))}
        {wide ? null : (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            aria-expanded={resultOpen}
            onClick={() => setResultOpen((open) => !open)}
          >
            {resultOpen ? "Hide breakdown" : "Breakdown"}
          </Button>
        )}
        {showResultDetail ? (
          <>
            {estimate.price ? (
              <p
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
              </p>
            ) : null}
            {estimate.cheapestFill?.stations[0] ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="pressable min-h-11 w-full rounded-[2px] border border-border p-3 text-left transition-transform duration-150 hover:-translate-y-px active:scale-[0.99] motion-reduce:transform-none"
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
                  <p className="text-sm" title={estimate.cheapestFill.stations[0].name}>
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
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="diesel">{estimate.consumption.label}</Badge>
              <span className="tabular text-sm">{estimate.consumption.display}</span>
            </div>
            {estimate.energy.arrivalStateOfCharge ? (
              <p className="mt-2 text-sm">{arrivalCopy(estimate.energy.arrivalStateOfCharge)}</p>
            ) : null}
            {typeof estimate.co2Kg === "number" ? (
              <p className="tabular mt-2 text-sm text-mist">About {estimate.co2Kg.toFixed(1)} kg CO₂</p>
            ) : null}
            {hmrc ? <p className="tabular mt-2 text-sm text-mist">{hmrc}</p> : null}
            <div>
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
            </div>
            {estimate.charges.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm">
                {estimate.charges.map((charge) => (
                  <li
                    key={charge.id}
                    className="cq-stack flex flex-wrap items-baseline justify-between gap-2"
                    title={charge.name}
                  >
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
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-mist">
              Brim is an estimate. You remain responsible for paying or staying out. Cars, vans and
              motorcycles only; HGV, bus and taxi classes are not modelled.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => void saveVehicle()}>
                {savedLabel === "vehicle" ? "Saved" : "Save this car"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void saveJourney()}>
                {savedLabel === "journey" ? "Saved" : "Save journey"}
              </Button>
              {vehicleId !== "inline" ? (
                <Button type="button" variant="ghost" onClick={() => setFillOpen(true)}>
                  {savedBev ? "Log a charge" : "Log a fill-up"}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setAuthOpen(true)}>
                Sign in to sync
              </Button>
            </div>
          </>
        ) : null}
      </m.section>
    ) : null;

  const resultSlot = (
    <div className={wide ? "relative min-h-[7rem]" : "relative min-h-[4.5rem]"}>
      <AnimatePresence initial={false}>
        {loading && !estimate ? (
          <m.div key="skeleton" {...fade} aria-busy="true">
            <Card {...(wide ? {} : { className: "border-0 p-0" })}>
              <Skeleton className="mb-3 h-16 w-48" />
              <Skeleton className="h-4 w-24" />
            </Card>
          </m.div>
        ) : null}
        {result}
      </AnimatePresence>
    </div>
  );

  const errorLine = error ? (
    <p
      id={errorSource === "maps" ? "maps-error" : "trip-error"}
      className={wide ? "mb-2 text-warning" : "px-3 pt-2 text-warning"}
      role="alert"
    >
      {error}
    </p>
  ) : null;

  return (
    <main className="relative mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2px] border border-border">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Suspense
            fallback={
              <div className="h-full min-h-40" aria-busy="true">
                <Skeleton className="h-full w-full" />
              </div>
            }
          >
            <RouteMap {...mapProps} />
          </Suspense>
        </div>

        {pinArmed ? <PinHud focusStop={focusStop} onCancel={() => setPinArmed(false)} /> : null}

        {wide ? (
          <aside className="absolute left-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto">
            <Card>{composer}</Card>
          </aside>
        ) : null}

        {wide ? (
          <div className="absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-[min(20rem,calc(100%-1.5rem))] overflow-y-auto">
            {errorLine}
            {resultSlot}
          </div>
        ) : null}
      </div>

      {wide ? null : (
        <>
          {error || loading || estimate ? (
            <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border bg-card">
              {errorLine}
              {resultSlot}
            </div>
          ) : null}
          <div className="shrink-0 border-t border-border bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="grid grid-cols-3 gap-1">
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 flex-col items-stretch py-1"
                onClick={() => {
                  setFocusStop("origin");
                  setComposerOpen(true);
                  setTripOpen(true);
                }}
              >
                <span className="text-xs text-mist">From</span>
                <span className="truncate text-sm">{origin || "Set"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 flex-col items-stretch py-1"
                onClick={() => {
                  setFocusStop("destination");
                  setComposerOpen(true);
                  setTripOpen(true);
                }}
              >
                <span className="text-xs text-mist">To</span>
                <span className="truncate text-sm">{destination || "Set"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 flex-col items-stretch py-1"
                onClick={() => setCarOpen(true)}
              >
                <span className="text-xs text-mist">Car</span>
                <span className="truncate text-sm">{carLabel}</span>
              </Button>
            </div>
          </div>
          <Drawer open={tripOpen} onOpenChange={setTripOpen}>
            <DrawerContent className="max-h-[min(85dvh,100%)]">
              <DrawerTitle className="display mb-3 text-xl">Edit trip</DrawerTitle>
              {composer}
            </DrawerContent>
          </Drawer>
        </>
      )}

      {carOpen ? (
        <Suspense fallback={null}>
          <VehicleSheet
        open={carOpen}
        onOpenChange={setCarOpen}
        wide={wide}
        garage={garage}
        vehicleId={vehicleId}
        setVehicleId={setVehicleId}
        electricTrip={electricTrip}
        chargingLocation={chargingLocation}
        setChargingLocation={setChargingLocation}
        networkId={networkId}
        setNetworkId={setNetworkId}
        evNetworks={evNetworks}
        homePence={homePence}
        setHomePence={setHomePence}
        offpeakPence={offpeakPence}
        setOffpeakPence={setOffpeakPence}
        offpeakWindow={offpeakWindow}
        setOffpeakWindow={setOffpeakWindow}
        hasHeatPump={hasHeatPump}
        setHasHeatPump={setHasHeatPump}
        catalogue={catalogue}
        catalogueOpen={catalogueOpen}
        setCatalogueOpen={setCatalogueOpen}
        onPickCar={onPickCar}
        onPickFromReg={onPickFromReg}
        applyVes={applyVes}
        propulsion={propulsion}
        setPropulsion={setPropulsion}
        vehicleKind={vehicleKind}
        setVehicleKind={setVehicleKind}
        vehicleYear={vehicleYear}
        setVehicleYear={setVehicleYear}
        euroStatus={euroStatus}
        setEuroStatus={setEuroStatus}
        setEuroFromDvla={setEuroFromDvla}
        mpg={mpg}
        setMpg={setMpg}
        overrideMpg={overrideMpg}
        setOverrideMpg={setOverrideMpg}
        miKwh={miKwh}
        setMiKwh={setMiKwh}
        overrideMiKwh={overrideMiKwh}
        setOverrideMiKwh={setOverrideMiKwh}
        tank={tank}
        setTank={setTank}
        battery={battery}
        setBattery={setBattery}
        start={start}
        setStart={setStart}
        onUseCar={() => {
          setCarOpen(false);
          scheduleEstimate();
        }}
          />
        </Suspense>
      ) : null}

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keep this car</DialogTitle>
            <DialogDescription>
              You can estimate without an account. Sign in only if you want this car on other
              devices.
            </DialogDescription>
          </DialogHeader>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <AuthPanel
              defaultTab="signup"
              idPrefix="estimate-auth"
              onSuccess={() => void onAuthSuccess()}
            />
          </Suspense>
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
              <Input
                id="est-odo"
                className="tabular"
                inputMode="decimal"
                enterKeyHint="next"
                value={fillOdo}
                onChange={(ev) => setFillOdo(ev.target.value)}
                required
              />
            </FormItem>
            <FormItem>
              <Label htmlFor="est-qty">{savedBev ? "kWh" : "Litres"}</Label>
              <Input
                id="est-qty"
                className="tabular"
                inputMode="decimal"
                enterKeyHint="next"
                value={fillQty}
                onChange={(ev) => setFillQty(ev.target.value)}
                required
              />
            </FormItem>
            <FormItem>
              <Label htmlFor="est-gbp">Price £</Label>
              <Input
                id="est-gbp"
                className="tabular"
                inputMode="decimal"
                enterKeyHint="next"
                value={fillPrice}
                onChange={(ev) => setFillPrice(ev.target.value)}
              />
            </FormItem>
            <FormItem>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={fillBrim} onChange={(ev) => setFillBrim(ev.target.checked)} />
                {savedBev ? "Charged to full" : "Filled to brim"}
              </label>
            </FormItem>
            <FormItem>
              <Label htmlFor="est-when">When</Label>
              <Input
                id="est-when"
                type="datetime-local"
                enterKeyHint="done"
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
