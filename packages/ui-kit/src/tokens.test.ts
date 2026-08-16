import { describe, expect, it } from "vitest";

function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (rgb: [number, number, number]) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const l1 = lum(fg);
  const l2 = lum(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Brim tokens", () => {
  it("keeps amber on forecourt at AA for display numerals", () => {
    expect(contrast([232, 179, 60], [20, 23, 26])).toBeGreaterThanOrEqual(4.5);
  });
});
