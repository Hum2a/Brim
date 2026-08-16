import { describe, expect, it } from "vitest";
import { brimEstimateUrl } from "./url.js";

describe("brimEstimateUrl", () => {
  it("opens the web app with a dummy Maps directions URL in ?url=", () => {
    const page = "https://www.google.com/maps/dir/Crawley/London/";
    expect(brimEstimateUrl("http://localhost:5173", page)).toBe(
      `http://localhost:5173/?url=${encodeURIComponent(page)}`,
    );
  });

  it("strips a trailing slash on the web origin", () => {
    const page = "https://maps.google.co.uk/maps/dir/Manchester/Leeds/";
    expect(brimEstimateUrl("http://localhost:5173/", page)).toBe(
      `http://localhost:5173/?url=${encodeURIComponent(page)}`,
    );
  });

  it("encodes a dummy short Maps link without putting it in the path", () => {
    const page = "https://maps.app.goo.gl/brimtest";
    const out = brimEstimateUrl("https://brim.example", page);
    expect(out.startsWith("https://brim.example/?url=")).toBe(true);
    expect(out.includes("/maps/")).toBe(false);
    expect(out).toContain(encodeURIComponent(page));
  });
});
