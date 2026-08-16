export const THEME_STORAGE_KEY = "brim-theme";
export const DEFAULT_THEME_ID = "wet-tarmac";

export type ThemeTokens = {
  forecourt: string;
  pump: string;
  gauge: string;
  diesel: string;
  warning: string;
  mist: string;
  night: string;
  card: string;
  lift: string;
};

export type BrimTheme = {
  id: string;
  name: string;
  tokens: ThemeTokens;
};

type CoreTokens = {
  forecourt: string;
  pump: string;
  gauge: string;
  diesel: string;
  warning: string;
  mist: string;
};

export function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount);
}

function rgbToHslParts(hex: string): string {
  let [r, g, b] = hexToRgb(hex);
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function finish(core: CoreTokens): ThemeTokens {
  const dark = relativeLuminance(hexToRgb(core.forecourt)) < 0.45;
  return {
    ...core,
    night: mix(core.forecourt, "#000000", dark ? 0.35 : 0.06),
    card: mix(core.forecourt, core.pump, dark ? 0.07 : 0.05),
    lift: mix(core.forecourt, core.pump, dark ? 0.14 : 0.1),
  };
}

function theme(id: string, name: string, core: CoreTokens): BrimTheme {
  return { id, name, tokens: finish(core) };
}

export const THEMES: BrimTheme[] = [
  theme("wet-tarmac", "Wet Tarmac", {
    forecourt: "#14171a",
    pump: "#f2f0eb",
    gauge: "#e8b33c",
    diesel: "#1f6f63",
    warning: "#c4472f",
    mist: "#8ba3c7",
  }),
  theme("unleaded-dreams", "Unleaded Dreams", {
    forecourt: "#101814",
    pump: "#e7f3e4",
    gauge: "#d4e04a",
    diesel: "#2f8f4e",
    warning: "#d45a32",
    mist: "#8fb89a",
  }),
  theme("diesel-catastrophe", "Diesel Catastrophe", {
    forecourt: "#0d1612",
    pump: "#e4efe6",
    gauge: "#c6d64a",
    diesel: "#3d7a4a",
    warning: "#c45c2e",
    mist: "#8aa894",
  }),
  theme("mot-failure", "MOT Failure", {
    forecourt: "#1a1410",
    pump: "#f3ece3",
    gauge: "#f0a020",
    diesel: "#4a7d5a",
    warning: "#e0563a",
    mist: "#c4a78a",
  }),
  theme("bus-lane-tears", "Bus Lane Tears", {
    forecourt: "#0e1624",
    pump: "#e6eef8",
    gauge: "#f0c43a",
    diesel: "#2a7d8f",
    warning: "#d1504a",
    mist: "#8aa4c8",
  }),
  theme("congestion-marmalade", "Congestion Marmalade", {
    forecourt: "#1c120c",
    pump: "#f6ead8",
    gauge: "#f08a1e",
    diesel: "#3d6b48",
    warning: "#d44528",
    mist: "#c49a72",
  }),
  theme("m25-forever", "M25 Forever", {
    forecourt: "#17181b",
    pump: "#ecece8",
    gauge: "#e2c04a",
    diesel: "#4a6e62",
    warning: "#c85a48",
    mist: "#9aa3ad",
  }),
  theme("pothole-opera", "Pothole Opera", {
    forecourt: "#16121c",
    pump: "#efe8f4",
    gauge: "#e0b14a",
    diesel: "#3d6e78",
    warning: "#c4566a",
    mist: "#a898c0",
  }),
  theme("fog-lamp-disco", "Fog Lamp Disco", {
    forecourt: "#0b1220",
    pump: "#e4eef8",
    gauge: "#7ec8ff",
    diesel: "#2f8f9a",
    warning: "#ff6b4a",
    mist: "#8eb0d0",
  }),
  theme("gritter-ballet", "Gritter Ballet", {
    forecourt: "#eef1ec",
    pump: "#1a2330",
    gauge: "#8a5200",
    diesel: "#0f5c50",
    warning: "#b13220",
    mist: "#4a5a6a",
  }),
  theme("layby-philosopher", "Layby Philosopher", {
    forecourt: "#121a14",
    pump: "#e8f0e4",
    gauge: "#c8d24a",
    diesel: "#3d7a52",
    warning: "#c45a38",
    mist: "#8aa890",
  }),
  theme("hard-shoulder-hymn", "Hard Shoulder Hymn", {
    forecourt: "#1a1010",
    pump: "#f4e8e4",
    gauge: "#f0a040",
    diesel: "#3d6e58",
    warning: "#e04830",
    mist: "#c49890",
  }),
  theme("service-station-romance", "Service Station Romance", {
    forecourt: "#1a1018",
    pump: "#f8e8f0",
    gauge: "#ff7ab0",
    diesel: "#2a8f7a",
    warning: "#e05070",
    mist: "#c490b0",
  }),
  theme("ulez-confession", "ULEZ Confession", {
    forecourt: "#0e1a14",
    pump: "#e6f4ea",
    gauge: "#3dd68c",
    diesel: "#1f8f63",
    warning: "#e05040",
    mist: "#7ab89a",
  }),
  theme("dartford-ghost", "Dartford Ghost", {
    forecourt: "#e6ecf2",
    pump: "#1b2430",
    gauge: "#7a4a00",
    diesel: "#0e5a52",
    warning: "#a82820",
    mist: "#4a5c70",
  }),
  theme("cats-eye-fever", "Cats Eye Fever", {
    forecourt: "#0a0c0e",
    pump: "#f0f2e8",
    gauge: "#f2c23a",
    diesel: "#2a6e58",
    warning: "#e05030",
    mist: "#8aa0b0",
  }),
  theme("brake-dust-sonata", "Brake Dust Sonata", {
    forecourt: "#1a1210",
    pump: "#f2e6dc",
    gauge: "#e08a48",
    diesel: "#4a6e58",
    warning: "#c44830",
    mist: "#c4a090",
  }),
  theme("windscreen-washer", "Windscreen Washer", {
    forecourt: "#0c1820",
    pump: "#e4f4f8",
    gauge: "#4ad4e0",
    diesel: "#2a8f8a",
    warning: "#e06048",
    mist: "#7ab0c4",
  }),
  theme("indicator-anxiety", "Indicator Anxiety", {
    forecourt: "#14120e",
    pump: "#f4efe4",
    gauge: "#ffb000",
    diesel: "#3d6e58",
    warning: "#e05020",
    mist: "#c4b090",
  }),
  theme("reverse-beeper", "Reverse Beeper", {
    forecourt: "#f0d84a",
    pump: "#141414",
    gauge: "#6b2e00",
    diesel: "#0d4a3c",
    warning: "#9a1800",
    mist: "#4a4408",
  }),
  theme("clutch-burn-sunday", "Clutch Burn Sunday", {
    forecourt: "#1c100c",
    pump: "#f4e4d4",
    gauge: "#f07828",
    diesel: "#3d6a48",
    warning: "#d43818",
    mist: "#c49878",
  }),
  theme("roundabout-spiral", "Roundabout Spiral", {
    forecourt: "#0e1c1c",
    pump: "#e4f4f0",
    gauge: "#3ad4b0",
    diesel: "#2a8f7a",
    warning: "#e05848",
    mist: "#7ab8b0",
  }),
  theme("yellow-box-panic", "Yellow Box Panic", {
    forecourt: "#121210",
    pump: "#f8f0c8",
    gauge: "#ffe14a",
    diesel: "#3d7a58",
    warning: "#e04020",
    mist: "#c4b878",
  }),
  theme("speed-camera-ballet", "Speed Camera Ballet", {
    forecourt: "#10100c",
    pump: "#f4f0d8",
    gauge: "#f0d020",
    diesel: "#2a6e58",
    warning: "#e03828",
    mist: "#b8b080",
  }),
  theme("high-vis-midnight", "High Vis Midnight", {
    forecourt: "#0c0c0c",
    pump: "#f4f4e8",
    gauge: "#d6ff2a",
    diesel: "#3d8f4a",
    warning: "#ff4a2a",
    mist: "#a0a888",
  }),
  theme("salt-spreader", "Salt Spreader", {
    forecourt: "#eceae4",
    pump: "#1c1c1a",
    gauge: "#7a4e00",
    diesel: "#0e5a48",
    warning: "#a82818",
    mist: "#5a5a52",
  }),
  theme("black-ice-hymn", "Black Ice Hymn", {
    forecourt: "#0c141c",
    pump: "#e8f0f8",
    gauge: "#8ec8f0",
    diesel: "#2a7a8a",
    warning: "#e05860",
    mist: "#7aa0c0",
  }),
  theme("petrol-cap-odyssey", "Petrol Cap Odyssey", {
    forecourt: "#0c1810",
    pump: "#e8f4e8",
    gauge: "#8fd44a",
    diesel: "#2a8f4a",
    warning: "#d45030",
    mist: "#7ab088",
  }),
  theme("spare-wheel-gospel", "Spare Wheel Gospel", {
    forecourt: "#121416",
    pump: "#e8ecec",
    gauge: "#c8d0d4",
    diesel: "#3d6e68",
    warning: "#c45048",
    mist: "#8a9aa4",
  }),
  theme("tyre-pressure-psalm", "Tyre Pressure Psalm", {
    forecourt: "#12181e",
    pump: "#e8eef4",
    gauge: "#4aa8e0",
    diesel: "#2a7a78",
    warning: "#d05058",
    mist: "#7a98b0",
  }),
  theme("jump-lead-waltz", "Jump Lead Waltz", {
    forecourt: "#160c0c",
    pump: "#f8e8e8",
    gauge: "#f0c040",
    diesel: "#2a6e58",
    warning: "#e02828",
    mist: "#c49090",
  }),
  theme("exhaust-note", "Exhaust Note", {
    forecourt: "#161616",
    pump: "#d8d8d4",
    gauge: "#e0b04a",
    diesel: "#4a6e62",
    warning: "#c05040",
    mist: "#9a9a94",
  }),
  theme("chicane-daydream", "Chicane Daydream", {
    forecourt: "#0c1812",
    pump: "#e4f0e8",
    gauge: "#50d080",
    diesel: "#1f8f58",
    warning: "#d05038",
    mist: "#7ab098",
  }),
  theme("pit-lane-lemonade", "Pit Lane Lemonade", {
    forecourt: "#f3e27a",
    pump: "#1a2e12",
    gauge: "#6b3200",
    diesel: "#0d4a32",
    warning: "#8a1800",
    mist: "#4a4a18",
  }),
  theme("rally-stage-custard", "Rally Stage Custard", {
    forecourt: "#f3e4b0",
    pump: "#2a1a0a",
    gauge: "#6b3800",
    diesel: "#1a4a32",
    warning: "#8a2010",
    mist: "#5a4830",
  }),
  theme("tow-hitch-sonnet", "Tow Hitch Sonnet", {
    forecourt: "#1a1c1e",
    pump: "#e8eaec",
    gauge: "#d0a040",
    diesel: "#3d6e68",
    warning: "#c05048",
    mist: "#8a98a4",
  }),
  theme("mudflap-opera", "Mudflap Opera", {
    forecourt: "#1a1410",
    pump: "#efe4d4",
    gauge: "#d4923a",
    diesel: "#4a6a48",
    warning: "#c04830",
    mist: "#b89878",
  }),
  theme("roof-box-theology", "Roof Box Theology", {
    forecourt: "#0e1830",
    pump: "#e8eef8",
    gauge: "#f0c04a",
    diesel: "#2a7a8a",
    warning: "#e05850",
    mist: "#8aa4c8",
  }),
  theme("handbrake-haiku", "Handbrake Haiku", {
    forecourt: "#f6f3ec",
    pump: "#161616",
    gauge: "#8a4200",
    diesel: "#0e5a48",
    warning: "#a82018",
    mist: "#5a5a52",
  }),
  theme("temporary-traffic-lights", "Temporary Traffic Lights", {
    forecourt: "#101010",
    pump: "#f0ece4",
    gauge: "#f0b000",
    diesel: "#1f8f4a",
    warning: "#e02820",
    mist: "#a0a098",
  }),
];

export function themeById(id: string | null | undefined): BrimTheme {
  const match = THEMES.find((item) => item.id === id);
  if (match) return match;
  const fallback = THEMES.find((item) => item.id === DEFAULT_THEME_ID);
  if (!fallback) throw new Error("Wet Tarmac is missing from the theme catalog.");
  return fallback;
}

export function readStoredTheme(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

function setVar(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value);
}

export function applyTheme(id: string | null | undefined): BrimTheme {
  const theme = themeById(id);
  const t = theme.tokens;
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  setVar("--forecourt", t.forecourt);
  setVar("--pump", t.pump);
  setVar("--gauge", t.gauge);
  setVar("--diesel", t.diesel);
  setVar("--warning", t.warning);
  setVar("--night", t.night);
  setVar("--mist", t.mist);
  setVar("--lift", t.lift);

  const pumpHsl = rgbToHslParts(t.pump);
  const forecourtHsl = rgbToHslParts(t.forecourt);
  const gaugeHsl = rgbToHslParts(t.gauge);
  const dieselHsl = rgbToHslParts(t.diesel);
  const warningHsl = rgbToHslParts(t.warning);
  const mistHsl = rgbToHslParts(t.mist);
  const cardHsl = rgbToHslParts(t.card);
  const dark = relativeLuminance(hexToRgb(t.forecourt)) < 0.45;
  const border = dark ? `${pumpHsl} / 0.14` : `${forecourtHsl} / 0.22`;

  setVar("--background", forecourtHsl);
  setVar("--foreground", pumpHsl);
  setVar("--card", cardHsl);
  setVar("--card-foreground", pumpHsl);
  setVar("--popover", cardHsl);
  setVar("--popover-foreground", pumpHsl);
  setVar("--primary", gaugeHsl);
  setVar("--primary-foreground", forecourtHsl);
  setVar("--secondary", dieselHsl);
  setVar("--secondary-foreground", pumpHsl);
  setVar("--muted", cardHsl);
  setVar("--muted-foreground", mistHsl);
  setVar("--accent", cardHsl);
  setVar("--accent-foreground", pumpHsl);
  setVar("--destructive", warningHsl);
  setVar("--destructive-foreground", pumpHsl);
  setVar("--border", border);
  setVar("--input", border);
  setVar("--ring", gaugeHsl);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.forecourt);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  } catch {
    /* private mode */
  }
  return theme;
}
