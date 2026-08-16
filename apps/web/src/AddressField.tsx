import { useEffect, useId, useRef, useState } from "react";
import { Command, CommandEmpty, CommandItem, CommandList } from "@brim/ui-kit/command";
import { Input } from "@brim/ui-kit/input";
import { Label } from "@brim/ui-kit/label";
import { Popover, PopoverAnchor, PopoverContent } from "@brim/ui-kit/popover";
import {
  fetchPlaceSuggestions,
  newPlaceSession,
  resolvePlaceSuggestion,
  type Place,
  type PlaceSuggestion,
} from "./places-client.js";

type AddressFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
  onFocusField?: () => void;
  describedBy?: string | undefined;
  invalid?: boolean;
};

export function AddressField({
  id,
  label,
  value,
  onChange,
  onSelect,
  onFocusField,
  describedBy,
  invalid,
}: AddressFieldProps) {
  const listId = useId();
  const session = useRef(newPlaceSession());
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      void fetchPlaceSuggestions(q, session.current).then((next) => {
        setHits(next);
        setOpen(next.length > 0);
      });
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [value]);

  async function pick(hit: PlaceSuggestion) {
    setBusy(true);
    try {
      const place = await resolvePlaceSuggestion(hit, session.current);
      if (!place) return;
      onChange(place.label);
      onSelect(place);
      setHits([]);
      setOpen(false);
      session.current = newPlaceSession();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open && !busy} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div>
            <Input
              id={id}
              value={value}
              role="combobox"
              aria-expanded={open && !busy}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              autoComplete="off"
              placeholder="Street, postcode, or place"
              onFocus={() => {
                onFocusField?.();
                if (hits.length > 0) setOpen(true);
              }}
              onChange={(ev) => {
                onChange(ev.target.value);
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Escape") setOpen(false);
              }}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          onOpenAutoFocus={(ev) => ev.preventDefault()}
          onCloseAutoFocus={(ev) => ev.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-1"
        >
          <Command shouldFilter={false}>
            <CommandList id={listId}>
              <CommandEmpty>No matching address. Keep typing a UK street or postcode.</CommandEmpty>
              {hits.map((hit) => (
                <CommandItem
                  key={hit.placeId ?? hit.label}
                  value={hit.label}
                  onSelect={() => void pick(hit)}
                >
                  {hit.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
