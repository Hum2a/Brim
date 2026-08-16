import { createContext, useContext, useState, type ReactNode } from "react";

const OverlayOpenContext = createContext(false);

export function OverlayOpenProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <OverlayOpenContext.Provider value={value}>{children}</OverlayOpenContext.Provider>;
}

export function useOverlayOpen(): boolean {
  return useContext(OverlayOpenContext);
}

export function useControllableOpen(
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
): [boolean, (next: boolean) => void] {
  const [uncontrolled, setUncontrolled] = useState(!!defaultOpen);
  const isControlled = open !== undefined;
  const current = isControlled ? open : uncontrolled;
  function set(next: boolean) {
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
  }
  return [current, set];
}
