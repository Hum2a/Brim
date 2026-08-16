export type MapsParseOk = {
  ok: true;
  origin: string;
  destination: string;
  waypoints: string[];
  travelMode: "drive" | "transit" | "walk" | "bike" | "unknown";
};

export type MapsParseFail = {
  ok: false;
  reason: string;
};

export type MapsParseResult = MapsParseOk | MapsParseFail;

const MODE_FROM_3E: Record<string, MapsParseOk["travelMode"]> = {
  "0": "drive",
  "1": "bike",
  "2": "walk",
  "3": "transit",
};

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

function travelModeFromData(data: string | null): MapsParseOk["travelMode"] {
  if (!data) return "unknown";
  const match = /!3e(\d+)/.exec(data);
  if (!match?.[1]) return "unknown";
  return MODE_FROM_3E[match[1]] ?? "unknown";
}

/**
 * Parse a Google Maps directions URL. URL only — never the DOM. Spec §10.2.
 * Never throws; malformed input returns `{ ok: false, reason }`.
 */
export function parseMapsUrl(input: string): MapsParseResult {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "That does not look like a URL. Paste a full maps link or type the places instead." };
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "google.com" && host !== "maps.google.com" && host !== "google.co.uk" && !host.endsWith(".google.com")) {
    return { ok: false, reason: "That link is not a Google Maps directions URL." };
  }

  const dir = url.pathname.match(/\/maps\/dir\/(.+)/);
  if (!dir?.[1]) {
    return { ok: false, reason: "That Maps link has no directions. Open a route, then share or copy the link." };
  }

  const parts = dir[1]
    .split("/")
    .map(decodeSegment)
    .filter((p) => p.length > 0 && !p.startsWith("@") && !p.startsWith("data="));

  if (parts.length < 2) {
    return { ok: false, reason: "Could not find both a start and a destination in that link." };
  }

  const origin = parts[0];
  const destination = parts[parts.length - 1];
  if (!origin || !destination) {
    return { ok: false, reason: "Could not find both a start and a destination in that link." };
  }

  const waypoints = parts.slice(1, -1);
  const travelMode = travelModeFromData(url.searchParams.get("data") ?? dir[1]);

  return { ok: true, origin, destination, waypoints, travelMode };
}
