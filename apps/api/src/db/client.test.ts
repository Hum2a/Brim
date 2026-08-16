import { describe, expect, it } from "vitest";
import { createAuth, createDb } from "./client.js";

describe("per-request factories", () => {
  it("createDb refuses a live env without DATABASE_URL", () => {
    expect(() => createDb({ BRIM_FIXTURES: "0" })).toThrow(/DATABASE_URL/);
  });

  it("createDb allows fixture mode without a database", () => {
    expect(createDb({ BRIM_FIXTURES: "1" }).memory).toBeDefined();
  });

  it("createAuth refuses missing secret outside fixtures", () => {
    expect(() => createAuth({})).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("createAuth uses a fixture secret when BRIM_FIXTURES=1", () => {
    expect(createAuth({ BRIM_FIXTURES: "1" }).secret).toContain("fixture");
  });
});
