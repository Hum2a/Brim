import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, m } from "motion/react";
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";
import { duration, easeOut } from "../motion.js";
import { OverlayOpenProvider, useControllableOpen, useOverlayOpen } from "../overlay-open.js";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange);
  return (
    <OverlayOpenProvider value={isOpen}>
      <TooltipPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props}>
        {children}
      </TooltipPrimitive.Root>
    </OverlayOpenProvider>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => {
  const open = useOverlayOpen();
  return (
    <TooltipPrimitive.Portal forceMount>
      <AnimatePresence>
        {open ? (
          <TooltipPrimitive.Content
            key="tooltip"
            ref={ref}
            sideOffset={sideOffset}
            className={cn("z-50 rounded-[2px] border border-border bg-card px-2 py-1 text-xs text-pump", className)}
            {...props}
          >
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration.feedback, ease: easeOut }}
            >
              {children}
            </m.div>
          </TooltipPrimitive.Content>
        ) : null}
      </AnimatePresence>
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
