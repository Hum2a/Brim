import { VCA_VEHICLE_FIXTURES } from "./vca-vehicles.js";
import { UK_PLACES } from "../places.js";

export type FixtureName = "health" | "uk-places" | "vca-vehicles";

const registry: Record<FixtureName, unknown> = {
  health: {
    status: "ok",
    version: "0.0.0",
    commit: "fixture",
    fixtureMode: true,
  },
  "uk-places": UK_PLACES,
  "vca-vehicles": VCA_VEHICLE_FIXTURES,
};

function envFlag(explicit: string | undefined): string | undefined {
  if (explicit !== undefined) return explicit;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.BRIM_FIXTURES;
}

export function loadFixture<T>(name: FixtureName, fixtureFlag: string | undefined = undefined): T {
  if (envFlag(fixtureFlag) !== "1") {
    throw new Error(
      "loadFixture() requires BRIM_FIXTURES=1. Recorded responses are only available in fixture mode.",
    );
  }
  const value = registry[name];
  if (value === undefined) {
    throw new Error(`Unknown fixture: ${name}`);
  }
  return value as T;
}

export function isFixtureMode(flag: string | undefined = undefined): boolean {
  return envFlag(flag) === "1";
}
