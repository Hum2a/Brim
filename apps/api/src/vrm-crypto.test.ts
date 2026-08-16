import { describe, expect, it } from "vitest";
import { decodeVrmKey, encryptVrm, hashVrm } from "./vrm-crypto.js";

const KEY = decodeVrmKey("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE")!;

describe("vrm crypto", () => {
  it("hashes and encrypts without putting the plate in the ciphertext envelope as plaintext", async () => {
    expect(KEY.byteLength).toBe(32);
    const hash = await hashVrm(KEY, "AB12CDE");
    expect(hash).not.toMatch(/AB12CDE/i);
    expect(hash.length).toBeGreaterThan(20);
    const packed = await encryptVrm(KEY, "AB12CDE");
    expect(packed.startsWith("v1:")).toBe(true);
    expect(packed).not.toMatch(/AB12CDE/i);
  });
});
