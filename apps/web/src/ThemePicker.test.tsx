/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemePicker } from "./ThemePicker.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ThemePicker", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("lists forty paints and persists the choice", async () => {
    await act(async () => {
      root.render(<ThemePicker initialId="wet-tarmac" />);
    });

    const radios = host.querySelectorAll('input[name="brim-theme"]');
    expect(radios).toHaveLength(40);
    expect(host.textContent).toContain("Wet Tarmac");
    expect(host.textContent).toContain("Temporary Traffic Lights");
    expect(host.querySelector('[role="radiogroup"]')).toBeTruthy();

    const lemonade = [...radios].find(
      (el) => el instanceof HTMLInputElement && el.value === "pit-lane-lemonade",
    );
    expect(lemonade).toBeTruthy();
    await act(async () => {
      if (lemonade instanceof HTMLInputElement) lemonade.click();
    });

    expect(document.documentElement.dataset.theme).toBe("pit-lane-lemonade");
    expect(localStorage.getItem("brim-theme")).toBe("pit-lane-lemonade");
  });
});
