export type HeraldEntry = {
  id: string;
  date: string;
  title: string;
  body: string;
};

/** Dated in-app changelog. No network, no analytics, no VRMs. */
export const WHATS_NEW: HeraldEntry[] = [
  {
    id: "p5-prices",
    date: "2026-03-15",
    title: "Live forecourt prices",
    body: "Estimates use Fuel Finder prices near the start of the trip, not a national average.",
  },
  {
    id: "p6-ev",
    date: "2026-04-15",
    title: "Electric and plug-in hybrid",
    body: "Battery cars and PHEVs get energy cost, home versus public charging, and an arrival charge estimate.",
  },
  {
    id: "p7-charges",
    date: "2026-05-15",
    title: "Tolls and clean-air zones",
    body: "ULEZ, CAZ, Dart Charge and tolls are included when the route and the car match.",
  },
  {
    id: "p8-fill-on-route",
    date: "2026-06-15",
    title: "Fill up on the way",
    body: "See cheaper stations along the route, not only at the origin.",
  },
  {
    id: "p9-reg",
    date: "2026-07-15",
    title: "Look up a UK registration",
    body: "Paste a plate to match a catalogue car. You can still type make and model instead. A registration is never required.",
  },
  {
    id: "p10-fill-ups",
    date: "2026-08-15",
    title: "Calibrate from fill-ups",
    body: "Log brim-to-brim fill-ups on a saved car. After three intervals, estimates use your real consumption.",
  },
];

export const HERALD_OPEN_EVENT = "brim:herald-open";

export function heraldStorageKey(id: string): string {
  return `brim:herald:${id}`;
}

export function unseenHeraldEntries(): HeraldEntry[] {
  try {
    return WHATS_NEW.filter((entry) => !localStorage.getItem(heraldStorageKey(entry.id)));
  } catch {
    return [];
  }
}

export function markHeraldSeen(entries: HeraldEntry[]): void {
  try {
    for (const entry of entries) {
      localStorage.setItem(heraldStorageKey(entry.id), "1");
    }
  } catch {
    /* private mode: skip persistence */
  }
}

export function openHerald(): void {
  window.dispatchEvent(new Event(HERALD_OPEN_EVENT));
}
