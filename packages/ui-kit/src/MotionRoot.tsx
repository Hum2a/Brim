import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";
import { TooltipProvider } from "./components/tooltip.js";
import { Toaster } from "./components/toast.js";
import { usePrefersReducedMotion } from "./motion.js";

export function MotionRoot({ children }: { children: ReactNode }) {
  const reduce = usePrefersReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduce ? "always" : "never"}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
