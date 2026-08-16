import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  THEMES,
  applyTheme,
  contrastRatio,
  hexToRgb,
  readStoredTheme,
  themeById,
} from "./themes.js";

describe("Brim tokens", () => {
  it("keeps amber on forecourt at AA for display numerals", () => {
    expect(contrastRatio("#e8b33c", "#14171a")).toBeGreaterThanOrEqual(4.5);
    expect(hexToRgb("#e8b33c")).toEqual([232, 179, 60]);
  });
});

describe("theme catalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("ships forty named paints", () => {
    expect(THEMES).toHaveLength(40);
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(40);
    expect(THEMES[0]?.id).toBe(DEFAULT_THEME_ID);
  });

  it("keeps pump and gauge readable on every forecourt", () => {
    const misses: string[] = [];
    for (const theme of THEMES) {
      const pump = contrastRatio(theme.tokens.pump, theme.tokens.forecourt);
      const gauge = contrastRatio(theme.tokens.gauge, theme.tokens.forecourt);
      if (pump < 4.5 || gauge < 4.5) {
        misses.push(
          `${theme.name}: pump ${pump.toFixed(2)}, gauge ${gauge.toFixed(2)}`,
        );
      }
    }
    expect(misses).toEqual([]);
  });

  it("falls back to Wet Tarmac for an unknown id", () => {
    expect(themeById("not-a-paint").id).toBe(DEFAULT_THEME_ID);
    expect(themeById(null).id).toBe(DEFAULT_THEME_ID);
  });

  it("writes CSS variables for the chosen paint", () => {
    const vars = new Map<string, string>();
    const dataset: Record<string, string> = {};
    const store = new Map<string, string>();
    vi.stubGlobal("document", {
      documentElement: {
        dataset,
        style: {
          setProperty: (name: string, value: string) => {
            vars.set(name, value);
          },
          getPropertyValue: (name: string) => vars.get(name) ?? "",
        },
        dispatchEvent: () => true,
      },
      querySelector: () => ({
        setAttribute: (...args: string[]) => {
          const value = args[1];
          if (value) vars.set("theme-color", value);
        },
      }),
    });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    const theme = applyTheme("pit-lane-lemonade");
    expect(theme.id).toBe("pit-lane-lemonade");
    expect(dataset.theme).toBe("pit-lane-lemonade");
    expect(vars.get("--forecourt")).toBe(theme.tokens.forecourt);
    expect(vars.get("--gauge")).toBe(theme.tokens.gauge);
    expect(vars.get("theme-color")).toBe(theme.tokens.forecourt);
    expect(store.get(THEME_STORAGE_KEY)).toBe("pit-lane-lemonade");

    const fallback = applyTheme("not-a-paint");
    expect(fallback.id).toBe(DEFAULT_THEME_ID);
    expect(dataset.theme).toBe(DEFAULT_THEME_ID);
    expect(store.get(THEME_STORAGE_KEY)).toBe(DEFAULT_THEME_ID);
  });

  it("reads the stored paint id", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "m25-forever",
    });
    expect(readStoredTheme()).toBe("m25-forever");
  });
});
