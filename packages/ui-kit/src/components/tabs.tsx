import * as TabsPrimitive from "@radix-ui/react-tabs";
import { m } from "motion/react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils.js";
import { stiff, tabPanel, usePrefersReducedMotion } from "../motion.js";

type TabsMeta = {
  value?: string | undefined;
  direction: 1 | -1;
  register: (value: string) => void;
};

const TabsMetaContext = createContext<TabsMeta | null>(null);

function useTabsMeta(): TabsMeta | null {
  return useContext(TabsMetaContext);
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const current = value ?? uncontrolled ?? defaultValue;
  const order = useRef<string[]>([]);
  const prev = useRef(current);

  const direction = useMemo<1 | -1>(() => {
    const a = order.current.indexOf(prev.current ?? "");
    const b = order.current.indexOf(current ?? "");
    if (a < 0 || b < 0 || b >= a) return 1;
    return -1;
  }, [current]);

  useEffect(() => {
    prev.current = current;
  }, [current]);

  const meta = useMemo<TabsMeta>(
    () => ({
      value: current,
      direction,
      register: (next) => {
        if (!order.current.includes(next)) order.current.push(next);
      },
    }),
    [current, direction],
  );

  return (
    <TabsMetaContext.Provider value={meta}>
      <TabsPrimitive.Root
        {...(value !== undefined ? { value } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        onValueChange={(next) => {
          if (value === undefined) setUncontrolled(next);
          onValueChange?.(next);
        }}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsMetaContext.Provider>
  );
}

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const meta = useTabsMeta();
  const reduce = usePrefersReducedMotion();
  const localRef = useRef<HTMLDivElement | null>(null);
  const [ink, setInk] = useState({ x: 0, width: 1 });

  function assignRef(node: HTMLDivElement | null) {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  useLayoutEffect(() => {
    const list = localRef.current;
    if (!list) return;
    const active = list.querySelector('[data-state="active"]');
    if (!(active instanceof HTMLElement)) return;
    setInk({ x: active.offsetLeft, width: Math.max(active.offsetWidth, 1) });
  }, [meta?.value, children]);

  return (
    <TabsPrimitive.List
      ref={assignRef}
      className={cn("relative inline-flex gap-1 rounded-[2px] border border-border bg-forecourt p-1", className)}
      {...props}
    >
      {reduce ? (
        <span
          className="pointer-events-none absolute top-1 bottom-1 left-0 z-0 w-px rounded-[2px] bg-lift"
          style={{
            transform: `translateX(${ink.x}px) scaleX(${ink.width})`,
            transformOrigin: "left center",
          }}
        />
      ) : (
        <m.span
          className="pointer-events-none absolute top-1 bottom-1 left-0 z-0 w-px rounded-[2px] bg-lift"
          style={{ originX: 0 }}
          animate={{ x: ink.x, scaleX: ink.width }}
          transition={stiff}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const meta = useTabsMeta();
  useEffect(() => {
    if (value) meta?.register(value);
  }, [meta, value]);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative z-10 min-h-11 rounded-[2px] px-3 py-2 text-sm text-mist transition-colors data-[state=active]:text-pump",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const meta = useTabsMeta();
  const reduce = usePrefersReducedMotion();
  const motion = tabPanel(meta?.direction ?? 1);
  return (
    <TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...props}>
      {reduce ? (
        children
      ) : (
        <m.div initial={motion.initial} animate={motion.animate} transition={motion.transition}>
          {children}
        </m.div>
      )}
    </TabsPrimitive.Content>
  );
});
TabsContent.displayName = "TabsContent";
