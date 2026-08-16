import type { Dispatch, SetStateAction } from "react";
import { Badge } from "@brim/ui-kit/badge";
import { Button } from "@brim/ui-kit/button";
import { Drawer, DrawerContent, DrawerTitle } from "@brim/ui-kit/drawer";
import { FormItem } from "@brim/ui-kit/form";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@brim/ui-kit/select";
import { Sheet, SheetContent } from "@brim/ui-kit/sheet";
import { RegLookup, type VesSummary } from "../RegLookup.js";
import { VehicleCatalogue, type CatalogueVehicle } from "../VehicleCatalogue.js";
import type { EvNetworkRow, Propulsion, Vehicle, VehicleKind } from "./types.js";

export function VehicleSheet({
  open,
  onOpenChange,
  wide,
  garage,
  vehicleId,
  setVehicleId,
  electricTrip,
  chargingLocation,
  setChargingLocation,
  networkId,
  setNetworkId,
  evNetworks,
  homePence,
  setHomePence,
  offpeakPence,
  setOffpeakPence,
  offpeakWindow,
  setOffpeakWindow,
  hasHeatPump,
  setHasHeatPump,
  catalogue,
  catalogueOpen,
  setCatalogueOpen,
  onPickCar,
  onPickFromReg,
  applyVes,
  propulsion,
  setPropulsion,
  vehicleKind,
  setVehicleKind,
  vehicleYear,
  setVehicleYear,
  euroStatus,
  setEuroStatus,
  setEuroFromDvla,
  mpg,
  setMpg,
  overrideMpg,
  setOverrideMpg,
  miKwh,
  setMiKwh,
  overrideMiKwh,
  setOverrideMiKwh,
  tank,
  setTank,
  battery,
  setBattery,
  start,
  setStart,
  onUseCar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wide: boolean;
  garage: Vehicle[];
  vehicleId: string;
  setVehicleId: (id: string) => void;
  electricTrip: boolean;
  chargingLocation: "home" | "public";
  setChargingLocation: (value: "home" | "public") => void;
  networkId: string;
  setNetworkId: (id: string) => void;
  evNetworks: EvNetworkRow[];
  homePence: string;
  setHomePence: (value: string) => void;
  offpeakPence: string;
  setOffpeakPence: (value: string) => void;
  offpeakWindow: string;
  setOffpeakWindow: (value: string) => void;
  hasHeatPump: boolean;
  setHasHeatPump: Dispatch<SetStateAction<boolean>>;
  catalogue: CatalogueVehicle | null;
  catalogueOpen: boolean;
  setCatalogueOpen: (open: boolean) => void;
  onPickCar: (next: CatalogueVehicle | null) => void;
  onPickFromReg: (vehicle: CatalogueVehicle, vrm: string, ves: VesSummary) => void;
  applyVes: (ves: VesSummary, vrm: string) => void;
  propulsion: Propulsion;
  setPropulsion: (value: Propulsion) => void;
  vehicleKind: VehicleKind;
  setVehicleKind: (value: VehicleKind) => void;
  vehicleYear: string;
  setVehicleYear: (value: string) => void;
  euroStatus: string;
  setEuroStatus: (value: string) => void;
  setEuroFromDvla: (value: boolean) => void;
  mpg: string;
  setMpg: (value: string) => void;
  overrideMpg: string;
  setOverrideMpg: (value: string) => void;
  miKwh: string;
  setMiKwh: (value: string) => void;
  overrideMiKwh: string;
  setOverrideMiKwh: (value: string) => void;
  tank: string;
  setTank: (value: string) => void;
  battery: string;
  setBattery: (value: string) => void;
  start: string;
  setStart: (value: string) => void;
  onUseCar: () => void;
}) {
  const fields = (
    <>
      <h2 className="display mb-4 pr-10 text-xl">The car on this trip</h2>
      {garage.length > 0 ? (
        <FormItem>
          <Label>Saved vehicle</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger>
              <SelectValue placeholder="Type details this time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inline">Type details this time</SelectItem>
              {garage.map((v) => (
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
          <p className="mb-3 text-sm text-mist">
            Petrol prices are live from the government feed. EV charging prices are estimates you can
            correct.
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
              inputMode="decimal"
              enterKeyHint="next"
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
                  inputMode="decimal"
                  enterKeyHint="next"
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
            <label className="flex min-h-11 items-center gap-2 text-sm">
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
              enterKeyHint="next"
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
                  inputMode="decimal"
                  enterKeyHint="next"
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
                  inputMode="decimal"
                  enterKeyHint="next"
                />
              </FormItem>
              <FormItem>
                <Label htmlFor="start">Starting charge %</Label>
                <Input
                  id="start"
                  value={start}
                  onChange={(ev) => setStart(ev.target.value)}
                  className="tabular"
                  inputMode="decimal"
                  enterKeyHint="done"
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
                  inputMode="decimal"
                  enterKeyHint="next"
                />
              </FormItem>
              <FormItem>
                <Label htmlFor="start">Starting charge %</Label>
                <Input
                  id="start"
                  value={start}
                  onChange={(ev) => setStart(ev.target.value)}
                  className="tabular"
                  inputMode="decimal"
                  enterKeyHint="next"
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
                    inputMode="decimal"
                    enterKeyHint="next"
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
                  inputMode="decimal"
                  enterKeyHint="done"
                />
              </FormItem>
            </>
          ) : null}
        </>
      ) : null}
      <Button type="button" className="mt-2 w-full" onClick={onUseCar}>
        Use this car
      </Button>
    </>
  );

  if (wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left">{fields}</SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[min(85dvh,100%)]">
        <DrawerTitle className="sr-only">The car on this trip</DrawerTitle>
        {fields}
      </DrawerContent>
    </Drawer>
  );
}