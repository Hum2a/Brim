import {
  applyTheme,
  cn,
  readStoredTheme,
  THEME_CHANGE_EVENT,
  THEMES,
  themeById,
} from "@brim/ui-kit";
import { Button } from "@brim/ui-kit/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@brim/ui-kit/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@brim/ui-kit/popover";
import { useEffect, useId, useState } from "react";
import { useMediaQuery } from "./use-media-query.js";

function currentThemeId(fallback?: string): string {
  return themeById(fallback ?? readStoredTheme()).id;
}

function useActiveThemeId(initialId?: string) {
  const [selected, setSelected] = useState(() => currentThemeId(initialId));

  useEffect(() => {
    const sync = () => setSelected(currentThemeId());
    document.documentElement.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      document.documentElement.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return selected;
}

function ThemeSwatchGrid({
  initialId,
  onPicked,
}: {
  initialId?: string;
  onPicked?: () => void;
}) {
  const selected = useActiveThemeId(initialId);
  const name = `brim-theme-${useId()}`;

  return (
    <div role="radiogroup" aria-label="Paint" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              name={name}
              value={theme.id}
              checked={on}
              className="sr-only"
              onChange={() => {
                applyTheme(theme.id);
                onPicked?.();
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
  );
}

export function ThemePicker({ initialId }: { initialId?: string }) {
  return (
    <section className="mt-8">
      <h2 className="display mb-1 text-2xl">Paint</h2>
      <p className="mb-4 text-sm text-mist">Stays on this device. The numbers do not change.</p>
      <ThemeSwatchGrid {...(initialId ? { initialId } : {})} />
    </section>
  );
}

export function ThemeMenu() {
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  if (wide) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost">
            Paint
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(28rem,calc(100vw-2rem))] max-h-[min(70dvh,36rem)] overflow-y-auto"
        >
          <p className="mb-3 text-sm text-mist">Stays on this device. The numbers do not change.</p>
          <ThemeSwatchGrid onPicked={close} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" variant="ghost">
          Paint
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle className="display mb-1 text-xl">Paint</DrawerTitle>
        <DrawerDescription className="mb-3 text-sm text-mist">
          Stays on this device. The numbers do not change.
        </DrawerDescription>
        <ThemeSwatchGrid onPicked={close} />
      </DrawerContent>
    </Drawer>
  );
}
