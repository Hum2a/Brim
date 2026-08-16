import { Button } from "@brim/ui-kit/button";
import { pinHudCopy } from "./vehicle-label.js";
import type { FocusStop } from "./types.js";

export function PinHud({
  focusStop,
  onCancel,
}: {
  focusStop: FocusStop;
  onCancel: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-[2px] border border-border bg-card px-3 py-2">
        <p className="text-sm">{pinHudCopy(focusStop)}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
