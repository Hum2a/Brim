import { describe, expect, it } from "vitest";
import { duration, fadeUp, motionSafe, popover, reduced, staggerChildren, tabPanel } from "./motion.js";

describe("motion presets", () => {
  it("keeps durations in the agreed bands", () => {
    expect(duration.feedback).toBeGreaterThanOrEqual(0.12);
    expect(duration.feedback).toBeLessThanOrEqual(0.16);
    expect(duration.control).toBeGreaterThanOrEqual(0.16);
    expect(duration.control).toBeLessThanOrEqual(0.22);
    expect(duration.panel).toBeGreaterThanOrEqual(0.22);
    expect(duration.panel).toBeLessThanOrEqual(0.3);
    expect(duration.route).toBeGreaterThanOrEqual(0.15);
    expect(duration.route).toBeLessThanOrEqual(0.22);
  });

  it("staggers newly revealed items between 25ms and 45ms", () => {
    const ms = staggerChildren.animate.transition.staggerChildren * 1000;
    expect(ms).toBeGreaterThanOrEqual(25);
    expect(ms).toBeLessThanOrEqual(45);
  });

  it("strips travel and scale under reduced motion", () => {
    const next = reduced(fadeUp);
    expect(next.initial).not.toHaveProperty("y");
    expect(next.animate).not.toHaveProperty("y");
    expect(next.exit).not.toHaveProperty("y");
    expect(motionSafe(true, fadeUp).initial).not.toHaveProperty("y");
    expect(motionSafe(false, fadeUp).initial).toMatchObject({ y: 8 });
  });

  it("opens popovers along the triggering edge", () => {
    expect(popover("bottom").initial).toMatchObject({ y: -6 });
    expect(popover("top").initial).toMatchObject({ y: 6 });
    expect(popover("right").initial).toMatchObject({ x: -6 });
  });

  it("slides tab panels a few pixels in the travel direction", () => {
    expect(tabPanel(1).initial).toMatchObject({ x: 6 });
    expect(tabPanel(-1).initial).toMatchObject({ x: -6 });
  });
});
