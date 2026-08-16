import { describe, expect, it } from "vitest";
import { hmrcAmapPence } from "./hmrc.js";

describe("HMRC AMAP", () => {
  it("uses 45p until 10,000 miles then 25p, including a crossing journey", () => {
    const split = hmrcAmapPence(200, 9_900);
    expect(split.bandMiles45).toBe(100);
    expect(split.bandMiles25).toBe(100);
    expect(split.approvedPence).toBe(100 * 45 + 100 * 25);
    expect(split.crossedThreshold).toBe(true);
  });

  it("stays on 45p below the threshold", () => {
    const flat = hmrcAmapPence(50, 100);
    expect(flat.bandMiles25).toBe(0);
    expect(flat.approvedPence).toBe(50 * 45);
  });
});
