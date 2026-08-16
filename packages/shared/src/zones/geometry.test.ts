import { describe, expect, it } from "vitest";
import { findPlaceByLabel } from "../places.js";
import { CHARGE_CATALOGUE, schemeById } from "../zones/catalogue.js";
import { detectHitsFromLine } from "../zones/detect.js";
import { lineIntersectsPolygon, lineNearPolygon, pointInPolygon } from "../zones/geometry.js";

function line(origin: string, dest: string) {
  const a = findPlaceByLabel(origin)!;
  const b = findPlaceByLabel(dest)!;
  return [
    { lat: a.lat, lng: a.lng },
    { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 },
    { lat: b.lat, lng: b.lng },
  ];
}

describe("zone geometry", () => {
  it("places London inside ULEZ and CC, Crawley outside both", () => {
    const ulez = schemeById("london-ulez")!;
    const cc = schemeById("london-cc")!;
    const london = findPlaceByLabel("London")!;
    const crawley = findPlaceByLabel("Crawley")!;
    expect(pointInPolygon(london.lng, london.lat, ulez.geometry)).toBe(true);
    expect(pointInPolygon(london.lng, london.lat, cc.geometry)).toBe(true);
    expect(pointInPolygon(crawley.lng, crawley.lat, ulez.geometry)).toBe(false);
    expect(pointInPolygon(crawley.lng, crawley.lat, cc.geometry)).toBe(false);
  });

  it("intersects Crawley to London with ULEZ and CC", () => {
    const hits = detectHitsFromLine(line("Crawley", "London"), CHARGE_CATALOGUE);
    expect(hits.some((h) => h.scheme.id === "london-ulez" && h.relation === "intersects")).toBe(true);
    expect(hits.some((h) => h.scheme.id === "london-cc" && h.relation === "intersects")).toBe(true);
  });

  it("treats a parallel line south of ULEZ as a near miss", () => {
    const ulez = schemeById("london-ulez")!;
    const points = [
      { lat: 51.282, lng: -0.3 },
      { lat: 51.282, lng: -0.1 },
    ];
    expect(lineIntersectsPolygon(points, ulez.geometry)).toBe(false);
    expect(lineNearPolygon(points, ulez.geometry)).toBe(true);
  });
});
