import * as SelectPrimitive from "@radix-ui/react-select";
import { AnimatePresence, m } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";
import { popover as popoverMotion } from "../motion.js";
import { OverlayOpenProvider, useControllableOpen, useOverlayOpen } from "../overlay-open.js";

export function Select({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof SelectPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange);
  return (
    <OverlayOpenProvider value={isOpen}>
      <SelectPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props}>
        {children}
      </SelectPrimitive.Root>
    </OverlayOpenProvider>
  );
}

export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "pressable flex h-10 w-full items-center justify-between rounded-[2px] border border-input bg-forecourt px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-70" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", side = "bottom", ...props }, ref) => {
  const open = useOverlayOpen();
  const motion = popoverMotion(side);
  return (
    <SelectPrimitive.Portal>
      <AnimatePresence>
        {open ? (
          <SelectPrimitive.Content
            key="select"
            ref={ref}
            position={position}
            side={side}
            className={cn("z-50 min-w-[8rem] overflow-hidden rounded-[2px] border border-border bg-card text-pump", className)}
            {...props}
          >
            <m.div initial={motion.initial} animate={motion.animate} transition={motion.transition}>
              <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
            </m.div>
          </SelectPrimitive.Content>
        ) : null}
      </AnimatePresence>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-[2px] py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-white/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-pump" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
