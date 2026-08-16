import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, m } from "motion/react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";
import { popover as popoverMotion } from "../motion.js";
import { OverlayOpenProvider, useControllableOpen, useOverlayOpen } from "../overlay-open.js";

export function Popover({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange);
  return (
    <OverlayOpenProvider value={isOpen}>
      <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props}>
        {children}
      </PopoverPrimitive.Root>
    </OverlayOpenProvider>
  );
}

export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", side = "bottom", sideOffset = 8, children, ...props }, ref) => {
  const open = useOverlayOpen();
  const motion = popoverMotion(side);
  return (
    <PopoverPrimitive.Portal forceMount>
      <AnimatePresence>
        {open ? (
          <PopoverPrimitive.Content
            key="popover"
            ref={ref}
            align={align}
            side={side}
            sideOffset={sideOffset}
            className={cn("z-50 w-72 rounded-[2px] border border-border bg-card p-3 text-pump", className)}
            {...props}
          >
            <m.div initial={motion.initial} animate={motion.animate} transition={motion.transition}>
              {children}
            </m.div>
          </PopoverPrimitive.Content>
        ) : null}
      </AnimatePresence>
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";
