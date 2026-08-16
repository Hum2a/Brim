import { describe, expect, it } from "vitest";
import { runSync } from "./index.js";

describe("runSync", () => {
  it("returns without throwing when secrets are missing", async () => {
    await expect(runSync({}, "2026-08-16T12:00:00Z")).resolves.toBeUndefined();
  });
});
