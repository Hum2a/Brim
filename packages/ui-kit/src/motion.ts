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

export const stiff = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };
export const soft = { type: "spring" as const, stiffness: 120, damping: 22, mass: 0.9 };

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const pageTransition = {
  initial: { opacity: 0, y: 18, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(8px)" },
  transition: { duration: 0.45, ease: easeOut },
};

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

export const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

export const pumpGlow = {
  rest: { filter: "drop-shadow(0 0 0 rgba(232,179,60,0))" },
  lit: { filter: "drop-shadow(0 0 28px rgba(232,179,60,0.55))" },
};

export function usePrefersReducedMotion(): boolean {
  const override = useContext(ReducedMotionContext);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return override ?? reduce;
}

export function motionSafe<T extends { transition?: { duration?: number } }>(reduce: boolean, variant: T): T {
  if (!reduce) return variant;
  return { ...variant, transition: { duration: 0 } };
}
