import { describe, expect, it } from "vitest";
import { createLogger, redact } from "./logger.js";

describe("redaction", () => {
  it("strips a VRM from nested payloads", () => {
    const lines: string[] = [];
    const log = createLogger((l) => lines.push(l));
    log.info({ vrm: "AB12CDE", nested: { registration: "XY98ZAB" }, note: "driver AB12CDE arrived" });
    const joined = lines.join("\n");
    expect(joined).not.toMatch(/AB12CDE/);
    expect(joined).not.toMatch(/XY98ZAB/);
    expect(joined).toMatch(/REDACTED_VRM/);
  });

  it("redact helper is the unit under test for the gate", () => {
    const out = redact({ plate: "AB12CDE" }) as { plate: string };
    expect(out.plate).toBe("[REDACTED_VRM]");
  });

  it("does not log full address strings", () => {
    const out = redact({
      address: "10 Station Road, Crawley",
      formatted_address: "Victoria Street, London",
    }) as { address: string; formatted_address: string };
    expect(out.address).toBe("[REDACTED]");
    expect(out.formatted_address).toBe("[REDACTED]");
  });
});
