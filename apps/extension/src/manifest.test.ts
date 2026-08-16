import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../manifest.json"), "utf8"),
) as {
  permissions?: string[];
  host_permissions?: string[];
};

describe("extension manifest", () => {
  it("keeps MV3 permissions minimal with no Google hosts", () => {
    expect(manifest.permissions).toEqual(["contextMenus", "activeTab"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.permissions?.includes("tabs")).toBe(false);
  });
});
