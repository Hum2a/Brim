import { VCA_VEHICLE_FIXTURES } from "./vca-vehicles.js";

export type FixtureName = "health" | "uk-places" | "vca-vehicles";

const registry: Record<FixtureName, unknown> = {
  health: {
    status: "ok",
    version: "0.0.0",
    commit: "fixture",
    fixtureMode: true,
  },
  "uk-places": [
    { label: "Crawley", lat: 51.1092, lng: -0.1872 },
    { label: "London", lat: 51.5074, lng: -0.1278 },
    { label: "Manchester", lat: 53.4808, lng: -2.2426 },
    { label: "Leeds", lat: 53.8008, lng: -1.5491 },
    { label: "Birmingham", lat: 52.4862, lng: -1.8904 },
    { label: "Bristol", lat: 51.4545, lng: -2.5879 },
    { label: "Edinburgh", lat: 55.9533, lng: -3.1883 },
    { label: "Glasgow", lat: 55.8642, lng: -4.2518 },
    { label: "Cardiff", lat: 51.4816, lng: -3.1791 },
    { label: "Swansea", lat: 51.6214, lng: -3.9436 },
    { label: "Newcastle", lat: 54.9783, lng: -1.6178 },
    { label: "York", lat: 53.96, lng: -1.0873 },
  ],
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
