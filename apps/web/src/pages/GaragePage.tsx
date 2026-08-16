import { m } from "motion/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { reveal, staggerChildren, usePrefersReducedMotion } from "@brim/ui-kit";
import { Button } from "@brim/ui-kit/button";
import { Card } from "@brim/ui-kit/card";
import { Form, FormItem } from "@brim/ui-kit/form";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@brim/ui-kit/select";
import { Skeleton } from "@brim/ui-kit/skeleton";
import { toast } from "@brim/ui-kit/toast";
import { api } from "../api.js";
import { AuthPanel } from "../AuthPanel.js";
import { euroFromVes, RegLookup, type VesSummary } from "../RegLookup.js";
import { VehicleCatalogue, type CatalogueVehicle } from "../VehicleCatalogue.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@brim/ui-kit/dialog";

type Vehicle = {
  id: string;
  nickname?: string;
  propulsion: string;
  kind?: string;
  year?: number;
  euro_status?: string;
  make?: string;
  model?: string;
  tank_litres?: number;
  battery_kwh_usable?: number;
  has_heat_pump?: boolean;
  is_default?: boolean;
};

type FillUp = {
  id: string;
  odometerMiles: number;
  quantity: number;
  unit: string;
  pricePence: number;
  brim: boolean;
  occurredAt: string;
};

type Calibration = {
  sampleCount: number;
  value?: number;
  unit?: string;
  confidence: string;
};

type Tariff = {
  id: string;
  pence_per_kwh: number;
  is_default: boolean;
  offpeak_pence?: number;
  offpeak_window?: string;
};

function title(v: Vehicle) {
  return v.nickname ?? [v.make, v.model].filter(Boolean).join(" ") ?? v.propulsion;
}

export function GaragePage() {
  const reduce = usePrefersReducedMotion();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [fills, setFills] = useState<FillUp[]>([]);
  const [calib, setCalib] = useState<Calibration | null>(null);
  const [homePence, setHomePence] = useState("7.5");
  const [offpeakPence, setOffpeakPence] = useState("");
  const [offpeakWindow, setOffpeakWindow] = useState("");
  const [hasHeatPump, setHasHeatPump] = useState(false);
  const [nickname, setNickname] = useState("");
  const [kind, setKind] = useState("car");
  const [year, setYear] = useState("");
  const [euroStatus, setEuroStatus] = useState("");
  const [tank, setTank] = useState("");
  const [battery, setBattery] = useState("");
  const [odo, setOdo] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [brim, setBrim] = useState(true);
  const [note, setNote] = useState("");
  const [catalogue, setCatalogue] = useState<CatalogueVehicle | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [pendingVrm, setPendingVrm] = useState<string | undefined>();
  const [pendingVes, setPendingVes] = useState<VesSummary | undefined>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ vehicles: Vehicle[] }>("/v1/vehicles");
      setVehicles(res.vehicles);
      setSelected((cur) => cur ?? res.vehicles.find((v) => v.is_default)?.id ?? res.vehicles[0]?.id ?? null);
    } catch {
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const vehicle = vehicles.find((v) => v.id === selected);

  useEffect(() => {
    if (!vehicle) {
      setFills([]);
      setCalib(null);
      return;
    }
    setNickname(vehicle.nickname ?? "");
    setKind(vehicle.kind ?? "car");
    setYear(vehicle.year !== undefined ? String(vehicle.year) : "");
    setEuroStatus(vehicle.euro_status ?? "");
    setTank(vehicle.tank_litres !== undefined ? String(vehicle.tank_litres) : "");
    setBattery(vehicle.battery_kwh_usable !== undefined ? String(vehicle.battery_kwh_usable) : "");
    setHasHeatPump(vehicle.has_heat_pump === true);
    void api<{ fillUps: FillUp[] }>(`/v1/vehicles/${vehicle.id}/fill-ups`)
      .then((r) => setFills(r.fillUps))
      .catch(() => setFills([]));
    void api<Calibration>(`/v1/vehicles/${vehicle.id}/calibration`)
      .then(setCalib)
      .catch(() => setCalib(null));
    if (vehicle.propulsion === "bev" || vehicle.propulsion === "phev") {
      void api<{ tariffs: Tariff[] }>(`/v1/vehicles/${vehicle.id}/tariffs`)
        .then((r) => {
          const home = r.tariffs.find((t) => t.is_default) ?? r.tariffs[0];
          if (home) {
            setHomePence(String(home.pence_per_kwh));
            setOffpeakPence(home.offpeak_pence !== undefined ? String(home.offpeak_pence) : "");
            setOffpeakWindow(home.offpeak_window ?? "");
          }
        })
        .catch(() => undefined);
    }
  }, [vehicle]);

  async function saveMeta() {
    if (!vehicle) return;
    try {
      await api(`/v1/vehicles/${vehicle.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nickname: nickname || undefined,
          kind,
          year: year ? Number(year) : undefined,
          euroStatus: euroStatus || undefined,
          euroStatusSource: euroStatus ? "derived" : undefined,
          tankLitres: tank ? Number(tank) : undefined,
          batteryKwhUsable: battery ? Number(battery) : undefined,
          hasHeatPump,
        }),
      });
      if (vehicle.propulsion === "bev" || vehicle.propulsion === "phev") {
        const pence = Number(homePence);
        if (Number.isFinite(pence) && pence > 0) {
          const payload: Record<string, unknown> = { kind: "home", pencePerKwh: pence, isDefault: true };
          const offpeak = Number(offpeakPence);
          if (Number.isFinite(offpeak) && offpeak > 0) payload.offpeakPence = offpeak;
          if (offpeakWindow.trim()) payload.offpeakWindow = offpeakWindow.trim();
          await api(`/v1/vehicles/${vehicle.id}/tariffs`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
      }
      toast("Saved.");
      await refresh();
    } catch {
      setAuthOpen(true);
    }
  }

  async function setDefault() {
    if (!vehicle) return;
    try {
      await api("/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({ defaultVehicleId: vehicle.id }),
      });
      toast("This is now the default car.");
      await refresh();
    } catch {
      setAuthOpen(true);
    }
  }

  async function removeCar() {
    if (!vehicle) return;
    if (!confirm("Delete this car and its fill-ups permanently?")) return;
    await api(`/v1/vehicles/${vehicle.id}`, { method: "DELETE" });
    setSelected(null);
    toast("Car deleted.");
    await refresh();
  }

  async function logFill(e: FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    const pounds = Number(price);
    try {
      await api("/v1/fill-ups", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: vehicle.id,
          odometerMiles: Number(odo),
          quantity: Number(qty),
          unit: vehicle.propulsion === "bev" ? "kwh" : "litres",
          price: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
          brim,
          note: note || undefined,
        }),
      });
      setOdo("");
      setQty("");
      setPrice("");
      setNote("");
      toast("Fill-up stored.");
      const fillsRes = await api<{ fillUps: FillUp[] }>(`/v1/vehicles/${vehicle.id}/fill-ups`);
      setFills(fillsRes.fillUps);
      setCalib(await api<Calibration>(`/v1/vehicles/${vehicle.id}/calibration`));
    } catch {
      setAuthOpen(true);
    }
  }

  async function addFromCatalogue(vehicle: CatalogueVehicle, vrm?: string, ves?: VesSummary) {
    try {
      const euro = euroFromVes(ves?.euroStatus);
      await api("/v1/vehicles", {
        method: "POST",
        body: JSON.stringify({
          nickname: `${vehicle.make} ${vehicle.model}`,
          kind: "car",
          propulsion: vehicle.propulsion,
          make: vehicle.make,
          model: vehicle.model,
          ...(vehicle.derivative ? { derivative: vehicle.derivative } : {}),
          ...(vehicle.transmission ? { transmission: vehicle.transmission } : {}),
          ...(vehicle.engineCc !== undefined ? { engineCc: vehicle.engineCc } : {}),
          ...(vehicle.co2Gkm !== undefined ? { co2Gkm: vehicle.co2Gkm } : {}),
          officialConsumption: vehicle.officialConsumption,
          officialUnit: vehicle.officialUnit,
          officialCycle: vehicle.officialCycle,
          vcaMatchId: vehicle.id,
          ...(ves?.year !== undefined ? { year: ves.year } : {}),
          ...(euro ? { euroStatus: euro, euroStatusSource: ves?.euroStatus ? "dvla" : "derived" } : {}),
          ...(vrm ? { vrm } : {}),
        }),
      });
      setCatalogue(null);
      setPendingVrm(undefined);
      setPendingVes(undefined);
      toast("Car saved.");
      await refresh();
    } catch {
      setAuthOpen(true);
    }
  }

  const electric = vehicle?.propulsion === "bev" || vehicle?.propulsion === "phev";
  const addCar = (
    <div className="grid gap-4">
      <RegLookup
        onPick={(vehicleHit, vrm, ves) => {
          setPendingVrm(vrm);
          setPendingVes(ves);
          setCatalogue(vehicleHit);
        }}
        onChangeCar={() => setCatalogueOpen(true)}
        onVesOnly={(ves, vrm) => {
          setPendingVrm(vrm);
          setPendingVes(ves);
        }}
      />
      <VehicleCatalogue
        selected={catalogue}
        onSelect={(next) => {
          setCatalogue(next);
          if (next) void addFromCatalogue(next, pendingVrm, pendingVes);
        }}
        open={catalogueOpen}
        onOpenChange={setCatalogueOpen}
      />
      {catalogue && pendingVrm ? (
        <Button type="button" onClick={() => void addFromCatalogue(catalogue, pendingVrm, pendingVes)}>
          Add this car
        </Button>
      ) : null}
    </div>
  );

  return (
    <main className="mx-auto w-[min(720px,calc(100%-1.5rem))] py-8">
      <m.div variants={staggerChildren} initial={reduce ? false : "initial"} animate="animate">
        <m.div variants={reveal}>
          <h1 className="display mb-2 text-4xl">Garage</h1>
          <p className="mb-6 text-mist">The cars Brim actually knows, and the fill-ups that correct the brochure.</p>
        </m.div>
        {loading ? (
          <Card aria-busy="true">
            <Skeleton className="mb-3 h-10 w-40" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : vehicles.length === 0 ? (
          <m.div variants={reveal}>
            <Card>
              <p className="mb-4">Add your car and we will stop guessing.</p>
              {addCar}
            </Card>
          </m.div>
        ) : (
          <>
            <Card className="mb-6">
              <p className="mb-3 text-sm text-mist">Add another car</p>
              {addCar}
            </Card>
            <ul className="mb-6 grid gap-2">
              {vehicles.map((v) => (
                <li key={v.id}>
                  <Button
                    type="button"
                    variant={v.id === selected ? "default" : "ghost"}
                    onClick={() => setSelected(v.id)}
                  >
                    {title(v)}
                    {v.is_default ? " (default)" : ""}
                  </Button>
                </li>
              ))}
            </ul>
            {vehicle ? (
              <m.div variants={reveal} className="grid gap-4">
                <Card>
                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveMeta();
                    }}
                  >
                    <FormItem>
                      <Label htmlFor="nick">Nickname</Label>
                      <Input id="nick" value={nickname} onChange={(ev) => setNickname(ev.target.value)} />
                    </FormItem>
                    <FormItem>
                      <Label>Vehicle class</Label>
                      <Select value={kind} onValueChange={setKind}>
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
                      <Input id="year" className="tabular" value={year} onChange={(ev) => setYear(ev.target.value)} />
                    </FormItem>
                    <FormItem>
                      <Label htmlFor="euro">Euro standard</Label>
                      <Input id="euro" value={euroStatus} onChange={(ev) => setEuroStatus(ev.target.value)} placeholder="Euro 6" />
                    </FormItem>
                    {electric ? (
                      <>
                        <FormItem>
                          <Label htmlFor="batt">Usable battery kWh</Label>
                          <Input id="batt" className="tabular" value={battery} onChange={(ev) => setBattery(ev.target.value)} />
                        </FormItem>
                        <FormItem>
                          <Label htmlFor="tariff">Home p/kWh</Label>
                          <Input id="tariff" className="tabular" value={homePence} onChange={(ev) => setHomePence(ev.target.value)} />
                        </FormItem>
                        <FormItem>
                          <Label htmlFor="offpeak">Off-peak p/kWh</Label>
                          <Input id="offpeak" className="tabular" value={offpeakPence} onChange={(ev) => setOffpeakPence(ev.target.value)} />
                        </FormItem>
                        <FormItem>
                          <Label htmlFor="offpeak-window">Off-peak window</Label>
                          <Input id="offpeak-window" value={offpeakWindow} onChange={(ev) => setOffpeakWindow(ev.target.value)} placeholder="00:30-05:30" />
                        </FormItem>
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
                    ) : (
                      <FormItem>
                        <Label htmlFor="tank">Tank litres</Label>
                        <Input id="tank" className="tabular" value={tank} onChange={(ev) => setTank(ev.target.value)} />
                      </FormItem>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="submit">Save details</Button>
                      <Button type="button" variant="ghost" onClick={() => void setDefault()}>
                        Make default
                      </Button>
                      <Button type="button" variant="warning" onClick={() => void removeCar()}>
                        Delete car
                      </Button>
                    </div>
                  </Form>
                  {calib ? (
                    <p className="tabular mt-4 text-sm text-mist">
                      {calib.confidence === "calibrated"
                        ? `Based on your fill-ups (${calib.sampleCount} intervals${calib.value !== undefined ? `, ${calib.value.toFixed(1)} ${calib.unit}` : ""}).`
                        : calib.confidence === "building"
                          ? `${calib.sampleCount} brim interval${calib.sampleCount === 1 ? "" : "s"} so far. Need 3 for a personal figure.`
                          : "No brim fill-ups yet."}
                    </p>
                  ) : null}
                </Card>
                <Card>
                  <h2 className="mb-3 text-lg">Log a fill-up</h2>
                  <p className="mb-3 text-sm text-mist">Odometer, quantity, brim. Under fifteen seconds.</p>
                  <Form onSubmit={(e) => void logFill(e)}>
                    <FormItem>
                      <Label htmlFor="odo">Odometer miles</Label>
                      <Input id="odo" className="tabular" value={odo} onChange={(ev) => setOdo(ev.target.value)} required />
                    </FormItem>
                    <FormItem>
                      <Label htmlFor="qty">{electric ? "kWh" : "Litres"}</Label>
                      <Input id="qty" className="tabular" value={qty} onChange={(ev) => setQty(ev.target.value)} required />
                    </FormItem>
                    <FormItem>
                      <Label htmlFor="gbp">Price £</Label>
                      <Input id="gbp" className="tabular" value={price} onChange={(ev) => setPrice(ev.target.value)} />
                    </FormItem>
                    <FormItem>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={brim} onChange={(ev) => setBrim(ev.target.checked)} />
                        Filled to brim
                      </label>
                    </FormItem>
                    <FormItem>
                      <Label htmlFor="note">Note</Label>
                      <Input id="note" value={note} onChange={(ev) => setNote(ev.target.value)} />
                    </FormItem>
                    <Button type="submit" className="mt-2">
                      Store fill-up
                    </Button>
                  </Form>
                  <ul className="mt-4 grid gap-2">
                    {fills.map((f) => (
                      <li key={f.id} className="tabular text-sm text-mist">
                        {f.occurredAt.slice(0, 10)} · {f.odometerMiles.toFixed(0)} mi · {f.quantity} {f.unit}
                        {f.brim ? " · brim" : ""}
                      </li>
                    ))}
                  </ul>
                </Card>
              </m.div>
            ) : null}
          </>
        )}
      </m.div>
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keep this on other devices</DialogTitle>
            <DialogDescription>You can log fill-ups on this device. Sign in to sync.</DialogDescription>
          </DialogHeader>
          <AuthPanel defaultTab="signup" idPrefix="garage-auth" onSuccess={() => { setAuthOpen(false); void refresh(); }} />
        </DialogContent>
      </Dialog>
    </main>
  );
}
