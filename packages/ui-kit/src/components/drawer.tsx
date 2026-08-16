import type { ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../lib/utils.js";

export function Drawer(props: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root {...props} />;
}

export function DrawerTrigger(props: ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger {...props} />;
}

export function DrawerContent({ className, children, ...props }: ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-forecourt/70" />
      <DrawerPrimitive.Content
        className={cn("fixed inset-x-0 bottom-0 z-50 rounded-t-[2px] border border-border bg-card p-4", className)}
        {...props}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}
