/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PumpReadout } from "./PumpReadout.js";
import { ReducedMotionProvider } from "./motion.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PumpReadout", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("snaps to the final value and announces once when motion is reduced", () => {
    act(() => {
      root.render(
        <ReducedMotionProvider value={true}>
          <PumpReadout value={47} />
        </ReducedMotionProvider>,
      );
    });
    expect(host.textContent).toContain("47");
    const live = host.querySelector("[aria-live='polite']");
    expect(live?.textContent).toBe("£47");
  });
});
