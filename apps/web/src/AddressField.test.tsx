/** @vitest-environment jsdom */

import { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressField } from "./AddressField.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => undefined;
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => undefined;
}

function Harness({
  onSelect,
}: {
  onSelect: (place: { label: string; lat: number; lng: number }) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <AddressField id="from" label="From" value={value} onChange={setValue} onSelect={onSelect} />
  );
}

describe("AddressField", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
  });

  it("selecting a hit sets pin coords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/v1/places?")) {
          return new Response(
            JSON.stringify({
              places: [
                {
                  label: "Station Road, Crawley",
                  lat: 51.1139,
                  lng: -0.187,
                  placeId: "fixture:station-road-crawley",
                },
              ],
            }),
            { status: 200 },
          );
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const selected: Array<{ label: string; lat: number; lng: number }> = [];
    await act(async () => {
      root.render(<Harness onSelect={(place) => selected.push(place)} />);
    });

    const input = host.querySelector("#from");
    expect(input).toBeTruthy();
    await act(async () => {
      const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      native?.call(input, "Station");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    const option = [...document.querySelectorAll("[cmdk-item], [role='option']")].find((el) =>
      el.textContent?.includes("Station Road, Crawley"),
    );
    expect(option).toBeTruthy();
    await act(async () => {
      option?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      option?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(selected[0]?.lat).toBeCloseTo(51.1139, 3);
    expect(selected[0]?.lng).toBeCloseTo(-0.187, 3);
  });
});
