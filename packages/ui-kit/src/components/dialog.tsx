import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";
import { duration, easeOut, fadeScale } from "../motion.js";
import { OverlayOpenProvider, useControllableOpen, useOverlayOpen } from "../overlay-open.js";
import { useVisualViewportBottomInset } from "../visual-viewport.js";

export function Dialog({
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

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-forecourt/70", className)} {...props} />
));
DialogOverlay.displayName = "DialogOverlay";

const closeClass =
  "absolute right-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-[2px] text-pump opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:right-2 md:top-2";

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
  const open = useOverlayOpen();
  const keyboardInset = useVisualViewportBottomInset();
  return (
    <DialogPortal forceMount>
      <AnimatePresence>
        {open ? (
          <m.div
            key="dialog"
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
                "fixed z-50 flex max-h-[min(85dvh,100%)] flex-col overflow-hidden border border-border bg-card p-6 text-pump",
                "inset-x-0 bottom-0 top-auto w-full translate-x-0 translate-y-0 rounded-t-[2px] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
                "md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(92vw,28rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2px] md:pb-6",
                className,
                "max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-[2px]",
              )}
              {...(keyboardInset > 0
                ? {
                    style: {
                      ...style,
                      paddingBottom: `calc(${keyboardInset}px + env(safe-area-inset-bottom, 0px))`,
                    },
                  }
                : style
                  ? { style }
                  : {})}
              {...props}
            >
              <m.div
                className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                initial={{ y: 12, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                transition={fadeScale.transition}
              >
                {children}
              </m.div>
              <DialogPrimitive.Close className={closeClass}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </m.div>
        ) : null}
      </AnimatePresence>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1 pr-10", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("display text-xl", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-mist", className)} {...props} />;
}
