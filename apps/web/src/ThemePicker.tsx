import { applyTheme, cn, THEMES } from "@brim/ui-kit";
import { useState } from "react";

export function ThemePicker({ initialId }: { initialId: string }) {
  const [selected, setSelected] = useState(initialId);

  return (
    <section className="mt-8">
      <h2 className="display mb-1 text-2xl">Paint</h2>
      <p className="mb-4 text-sm text-mist">
        Stays on this device. The numbers do not change.
      </p>
      <div
        role="radiogroup"
        aria-label="Paint"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {THEMES.map((theme) => {
          const on = theme.id === selected;
          return (
            <label
              key={theme.id}
              className={cn(
                "mb-0 flex min-h-11 cursor-pointer flex-row items-stretch gap-0 rounded-[2px] border border-border",
                "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
                on && "border-ring ring-1 ring-ring",
              )}
            >
              <input
                type="radio"
                name="brim-theme"
                value={theme.id}
                checked={on}
                className="sr-only"
                onChange={() => {
                  applyTheme(theme.id);
                  setSelected(theme.id);
                }}
              />
              <span
                className="flex min-h-11 w-full items-center gap-2 px-2 py-2 text-left text-sm"
                style={{
                  background: theme.tokens.forecourt,
                  color: theme.tokens.pump,
                }}
              >
                <span
                  className="h-6 w-1 shrink-0 rounded-[2px]"
                  style={{ background: theme.tokens.gauge }}
                  aria-hidden
                />
                <span className="leading-tight">{theme.name}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
