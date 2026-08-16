import type { FormEvent, ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@brim/ui-kit/accordion";
import { Button } from "@brim/ui-kit/button";
import { Form, FormItem } from "@brim/ui-kit/form";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { AddressField } from "../AddressField.js";
import type { FocusStop, Health, MapBias, Place, ViaDraft } from "./types.js";

function StopBadge({ label }: { label: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-border text-xs">
      {label}
    </span>
  );
}

export function TripComposer({
  collapsed,
  onExpand,
  health,
  stale,
  maps,
  setMaps,
  mapsInvalid,
  onMapsSubmit,
  origin,
  destination,
  originPin,
  destPin,
  viaDrafts,
  focusStop,
  pinArmed,
  onArmPin,
  onFocusStop,
  onOriginChange,
  onOriginSelect,
  onOriginClear,
  onDestinationChange,
  onDestinationSelect,
  onDestinationClear,
  onViaChange,
  onViaSelect,
  onViaClear,
  onRemoveVia,
  onAddStop,
  departsAt,
  setDepartsAt,
  onNow,
  loading,
  onSubmit,
  geoError,
  originDescribedBy,
  destDescribedBy,
  tripInvalid,
  originShortcuts,
  destShortcuts,
  viaShortcuts,
  vehicleLabel,
  onOpenVehicle,
  bias,
}: {
  collapsed: boolean;
  onExpand: () => void;
  health: Health | null;
  stale: boolean;
  maps: string;
  setMaps: (value: string) => void;
  mapsInvalid: boolean;
  onMapsSubmit: () => void;
  origin: string;
  destination: string;
  originPin: Place | null;
  destPin: Place | null;
  viaDrafts: ViaDraft[];
  focusStop: FocusStop;
  pinArmed: boolean;
  onArmPin: (stop: FocusStop) => void;
  onFocusStop: (stop: FocusStop) => void;
  onOriginChange: (text: string) => void;
  onOriginSelect: (place: Place) => void;
  onOriginClear: () => void;
  onDestinationChange: (text: string) => void;
  onDestinationSelect: (place: Place) => void;
  onDestinationClear: () => void;
  onViaChange: (index: number, text: string) => void;
  onViaSelect: (index: number, place: Place) => void;
  onViaClear: (index: number) => void;
  onRemoveVia: (index: number) => void;
  onAddStop: () => void;
  departsAt: string;
  setDepartsAt: (value: string) => void;
  onNow: () => void;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  geoError: string | null;
  originDescribedBy: string;
  destDescribedBy: string;
  tripInvalid: boolean;
  originShortcuts: ReactNode;
  destShortcuts: ReactNode;
  viaShortcuts: (index: number) => ReactNode;
  vehicleLabel: string;
  onOpenVehicle: () => void;
  bias?: MapBias;
}) {
  const originArmed = pinArmed && focusStop === "origin";
  const destArmed = pinArmed && focusStop === "destination";

  if (collapsed) {
    return (
      <>
        <p className="mb-1 text-mist">True journey cost</p>
        {stale ? (
          <p className="mb-3 text-sm text-warning">Last estimate on this device. Edit the trip or move a pin to refresh.</p>
        ) : null}
        <div className="mb-3 flex gap-2">
          <div className="flex flex-col items-center" aria-hidden>
            <StopBadge label="A" />
            <div className="my-1 w-px flex-1 bg-border" />
            <StopBadge label="B" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="truncate text-sm">{origin || "From"}</p>
            <p className="truncate text-sm">{destination || "To"}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" className="mb-2 w-full justify-start" onClick={onOpenVehicle}>
          {vehicleLabel}
        </Button>
        <Button type="button" className="w-full" onClick={onExpand}>
          Edit trip
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="mb-1 text-mist">True journey cost</p>
      <h1 className="display mb-4 text-2xl">Add your car and we will stop guessing.</h1>
      {health ? (
        <p className="tabular mb-3 text-xs text-mist">
          API {health.status}
          {health.fixtureMode ? " · fixtures" : ""}
        </p>
      ) : (
        <p className="mb-3 text-sm text-warning">
          Could not reach the API - start it with npm run dev:fixtures, then retry.
        </p>
      )}
      {stale ? (
        <p className="mb-3 text-sm text-warning">
          Showing the last estimate stored on this device. Move a pin or tap Estimate to refresh.
        </p>
      ) : null}

      <Form onSubmit={onSubmit}>
        <div className="mb-3 flex gap-2">
          <div className="flex flex-col items-center pt-7" aria-hidden>
            <StopBadge label="A" />
            <div className="my-1 w-px flex-1 bg-border" />
            {viaDrafts.map((via, index) => (
              <div key={via.id} className="flex flex-col items-center">
                <StopBadge label={String(index + 1)} />
                <div className="my-1 w-px flex-1 bg-border" />
              </div>
            ))}
            <StopBadge label="B" />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={
                originArmed
                  ? "mb-3 rounded-[2px] ring-2 ring-ring ring-offset-2 ring-offset-card"
                  : "mb-3"
              }
            >
              <AddressField
                id="origin"
                label="From"
                value={origin}
                onChange={onOriginChange}
                onSelect={onOriginSelect}
                onClear={onOriginClear}
                onFocusField={() => onFocusStop("origin")}
                committed={Boolean(originPin)}
                shortcuts={originShortcuts}
                invalid={tripInvalid}
                {...(originDescribedBy ? { describedBy: originDescribedBy } : {})}
                {...(bias ? { bias } : {})}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                aria-pressed={originArmed}
                onClick={() => onArmPin("origin")}
              >
                Pin
              </Button>
            </div>
            {viaDrafts.map((via, index) => {
              const armed = pinArmed && focusStop === index;
              return (
                <div
                  key={via.id}
                  className={armed ? "mb-3 rounded-[2px] ring-2 ring-ring ring-offset-2 ring-offset-card" : "mb-3"}
                >
                  <AddressField
                    id={`via-${via.id}`}
                    label={`Stop ${index + 1}`}
                    value={via.text}
                    onChange={(text) => onViaChange(index, text)}
                    onSelect={(place) => onViaSelect(index, place)}
                    onClear={() => onViaClear(index)}
                    onFocusField={() => onFocusStop(index)}
                    committed={Boolean(via.pin)}
                    shortcuts={viaShortcuts(index)}
                    {...(bias ? { bias } : {})}
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={armed}
                      onClick={() => onArmPin(index)}
                    >
                      Pin
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveVia(index)}>
                      Remove stop
                    </Button>
                  </div>
                </div>
              );
            })}
            <div
              className={
                destArmed ? "rounded-[2px] ring-2 ring-ring ring-offset-2 ring-offset-card" : undefined
              }
            >
              <AddressField
                id="destination"
                label="To"
                value={destination}
                onChange={onDestinationChange}
                onSelect={onDestinationSelect}
                onClear={onDestinationClear}
                onFocusField={() => onFocusStop("destination")}
                committed={Boolean(destPin)}
                shortcuts={destShortcuts}
                invalid={tripInvalid}
                {...(destDescribedBy ? { describedBy: destDescribedBy } : {})}
                {...(bias ? { bias } : {})}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                aria-pressed={destArmed}
                onClick={() => onArmPin("destination")}
              >
                Pin
              </Button>
            </div>
            {geoError ? (
              <p id="geo-error" className="mt-1 text-xs text-warning" role="alert">
                {geoError}
              </p>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onAddStop}>
          Add stop
        </Button>
        <FormItem>
          <Label htmlFor="leave">Leave</Label>
          <div className="flex gap-1">
            <Input
              id="leave"
              type="datetime-local"
              enterKeyHint="next"
              value={departsAt}
              onChange={(ev) => setDepartsAt(ev.target.value)}
            />
            <Button type="button" variant="ghost" size="sm" onClick={onNow}>
              Now
            </Button>
          </div>
        </FormItem>
        <Button type="submit">{loading ? "Working out the number…" : "Estimate"}</Button>
      </Form>
      <Accordion type="single" collapsible className="mt-3">
        <AccordionItem value="maps">
          <AccordionTrigger>Have a Maps link?</AccordionTrigger>
          <AccordionContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onMapsSubmit();
              }}
            >
              <FormItem>
                <Label htmlFor="maps">Paste a Maps link</Label>
                <Input
                  id="maps"
                  value={maps}
                  onChange={(ev) => setMaps(ev.target.value)}
                  inputMode="url"
                  enterKeyHint="go"
                  autoComplete="off"
                  aria-invalid={mapsInvalid ? true : undefined}
                  aria-describedby={mapsInvalid ? "maps-error maps-help" : "maps-help"}
                />
                <p id="maps-help" className="text-xs text-mist">
                  A Google, Apple, or Bing Maps directions link. If it cannot be read, type the places
                  above.
                </p>
              </FormItem>
              <Button type="submit" variant="ghost">
                Estimate from link
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Button type="button" variant="ghost" className="mt-3 w-full justify-start" onClick={onOpenVehicle}>
        {vehicleLabel}
      </Button>
    </>
  );
}
