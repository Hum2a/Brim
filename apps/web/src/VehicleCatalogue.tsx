import { useEffect, useState } from "react";
import { Button } from "@brim/ui-kit/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@brim/ui-kit/command";
import { Label } from "@brim/ui-kit/label";
import { Popover, PopoverContent, PopoverTrigger } from "@brim/ui-kit/popover";
import { api } from "./api.js";

export type CatalogueVehicle = {
  id: string;
  make: string;
  model: string;
  derivative?: string;
  propulsion: "petrol" | "diesel" | "hybrid" | "phev" | "bev";
  transmission?: string;
  engineCc?: number;
  co2Gkm?: number;
  officialConsumption: number;
  officialUnit: "mpg" | "l/100km" | "mi/kWh" | "kWh/100km";
  officialCycle: "WLTP" | "NEDC";
};

function figure(v: CatalogueVehicle): string {
  if (v.officialUnit === "mpg") return `${v.officialConsumption} mpg`;
  if (v.officialUnit === "mi/kWh") return `${v.officialConsumption} mi/kWh`;
  return `${v.officialConsumption} ${v.officialUnit}`;
}

export function catalogueLabel(v: CatalogueVehicle): string {
  const spec = v.derivative ? ` ${v.derivative}` : "";
  return `${v.make} ${v.model}${spec} · ${v.propulsion} · ${figure(v)} · ${v.officialCycle}`;
}

export function VehicleCatalogue({
  selected,
  onSelect,
}: {
  selected: CatalogueVehicle | null;
  onSelect: (vehicle: CatalogueVehicle | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CatalogueVehicle[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      void api<{ vehicles: CatalogueVehicle[] }>(`/v1/vehicles/catalogue?q=${encodeURIComponent(q)}`)
        .then((r) => setHits(r.vehicles))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="space-y-2">
      <Label>Car</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left">
            {selected ? catalogueLabel(selected) : "Search make and model"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(calc(100vw-2rem),28rem)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder="Ford Focus, Nissan Leaf…"
              aria-label="Search cars"
            />
            <CommandList>
              {q.trim().length >= 2 ? (
                <CommandEmpty>No match. Type mpg below instead.</CommandEmpty>
              ) : null}
              {hits.map((v) => (
                <CommandItem
                  key={v.id}
                  value={v.id}
                  onSelect={() => {
                    onSelect(v);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="tabular">{catalogueLabel(v)}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Type details instead
        </Button>
      ) : (
        <p className="text-xs text-mist">UK type-approved cars. Grey imports and motorbikes stay on manual mpg.</p>
      )}
    </div>
  );
}
