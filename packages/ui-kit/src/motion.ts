import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

const ReducedMotionContext = createContext<boolean | null>(null);

export function ReducedMotionProvider({
  value,
  children,
}: {
  value: boolean | null;
  children: ReactNode;
}) {
  return createElement(ReducedMotionContext.Provider, { value }, children);
}

export const duration = {
  feedback: 0.14,
  control: 0.18,
  panel: 0.24,
  route: 0.18,
  opacity: 0.08,
} as const;

export const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const stiff = { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.55 };

type AxisState = { opacity: number; x?: number; y?: number; scale?: number };

function transition(ms: number) {
  return { duration: ms, ease: easeOut };
}

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transition(duration.control),
};

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: transition(duration.route),
};

export const fadeScale = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
  transition: transition(duration.panel),
};

export const pageTransition = fadeUp;

export const reveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: transition(duration.control) },
};

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.03 } },
};

export type OverlaySide = "top" | "bottom" | "left" | "right";

export function popover(side: OverlaySide = "bottom"): {
  initial: AxisState;
  animate: AxisState;
  exit: AxisState;
  transition: { duration: number; ease: typeof easeOut };
} {
  const offset = 6;
  const from: AxisState =
    side === "top"
      ? { opacity: 0, y: offset }
      : side === "bottom"
        ? { opacity: 0, y: -offset }
        : side === "left"
          ? { opacity: 0, x: offset }
          : { opacity: 0, x: -offset };
  return {
    initial: from,
    animate: { opacity: 1, x: 0, y: 0 },
    exit: from,
    transition: transition(duration.control),
  };
}

export function drawer(side: "left" | "right" | "bottom"): {
  initial: AxisState;
  animate: AxisState;
  exit: AxisState;
  transition: { duration: number; ease: typeof easeOut };
} {
  const from: AxisState =
    side === "right" ? { opacity: 0, x: 16 } : side === "left" ? { opacity: 0, x: -16 } : { opacity: 0, y: 16 };
  return {
    initial: from,
    animate: { opacity: 1, x: 0, y: 0 },
    exit: from,
    transition: transition(duration.panel),
  };
}

export function tabPanel(direction: 1 | -1): {
  initial: AxisState;
  animate: AxisState;
  exit: AxisState;
  transition: { duration: number; ease: typeof easeOut };
} {
  return {
    initial: { opacity: 0, x: 6 * direction },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -6 * direction },
    transition: transition(duration.control),
  };
}

const MOTION_KEYS = new Set(["x", "y", "scale", "filter", "rotate"]);

function stripMotion(state: unknown): unknown {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;
  const next: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  for (const key of MOTION_KEYS) delete next[key];
  if (next.transition && typeof next.transition === "object") {
    next.transition = { ...(next.transition as Record<string, unknown>), duration: duration.opacity };
  }
  return next;
}

export function reduced<T extends Record<string, unknown>>(variant: T): T {
  const out: Record<string, unknown> = { ...variant };
  for (const key of ["initial", "animate", "exit"] as const) {
    if (key in out) out[key] = stripMotion(out[key]);
  }
  if (out.transition && typeof out.transition === "object") {
    out.transition = { ...(out.transition as Record<string, unknown>), duration: duration.opacity };
  }
  return out as T;
}

export function motionSafe<T extends Record<string, unknown>>(reduceMotion: boolean, variant: T): T {
  return reduceMotion ? reduced(variant) : variant;
}

export function usePrefersReducedMotion(): boolean {
  const override = useContext(ReducedMotionContext);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (override !== null) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [override]);
  return override ?? reduce;
}
