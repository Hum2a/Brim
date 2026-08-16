import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";
import { drawer, duration, easeOut } from "../motion.js";
import { OverlayOpenProvider, useControllableOpen, useOverlayOpen } from "../overlay-open.js";

export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange);
  return (
    <OverlayOpenProvider value={isOpen}>
      <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props}>
        {children}
      </DialogPrimitive.Root>
    </OverlayOpenProvider>
  );
}

export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "right" | "left" }
>(({ className, children, side = "right", ...props }, ref) => {
  const open = useOverlayOpen();
  const motion = drawer(side);
  return (
    <DialogPrimitive.Portal forceMount>
      <AnimatePresence>
        {open ? (
          <m.div
            key="sheet"
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.panel, ease: easeOut }}
          >
            <DialogPrimitive.Overlay className="absolute inset-0 bg-forecourt/70" />
            <DialogPrimitive.Content
              ref={ref}
              className={cn(
                "fixed z-50 h-full w-[min(92vw,22rem)] border-border bg-card p-5",
                side === "right" ? "right-0 top-0 border-l" : "left-0 top-0 border-r",
                className,
              )}
              {...props}
            >
              <m.div className="h-full" initial={motion.initial} animate={motion.animate} transition={motion.transition}>
                {children}
              </m.div>
              <DialogPrimitive.Close className="absolute right-3 top-3 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </m.div>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Portal>
  );
});
SheetContent.displayName = "SheetContent";
