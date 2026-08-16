import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";
import { duration, easeOut, fadeScale } from "../motion.js";
import { OverlayOpenProvider, useControllableOpen, useOverlayOpen } from "../overlay-open.js";

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

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const open = useOverlayOpen();
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
                "fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-border bg-card p-6 text-pump",
                className,
              )}
              {...props}
            >
              <m.div
                initial={{ y: 12, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                transition={fadeScale.transition}
              >
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
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
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
