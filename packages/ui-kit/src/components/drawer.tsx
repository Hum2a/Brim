import type { ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../lib/utils.js";
import { useVisualViewportBottomInset } from "../visual-viewport.js";

export function Drawer(props: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root repositionInputs={false} {...props} />;
}

export function DrawerTrigger(props: ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger {...props} />;
}

export const DrawerTitle = DrawerPrimitive.Title;
export const DrawerDescription = DrawerPrimitive.Description;

export function DrawerContent({ className, children, style, ...props }: ComponentProps<typeof DrawerPrimitive.Content>) {
  const keyboardInset = useVisualViewportBottomInset();
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-forecourt/70" />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[min(85dvh,100%)] flex-col overflow-hidden rounded-t-[2px] border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className,
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
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}
