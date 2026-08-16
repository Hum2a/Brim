import { Command as CommandPrimitive } from "cmdk";
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils.js";

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn("flex w-full flex-col overflow-hidden rounded-[2px] bg-transparent text-pump", className)}
    {...props}
  />
));
Command.displayName = "Command";

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    ref={ref}
    className={cn(
      "min-h-11 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CommandInput.displayName = "CommandInput";

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn("max-h-60 overflow-y-auto p-1", className)} {...props} />
));
CommandList.displayName = "CommandList";

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "flex min-h-11 cursor-pointer items-center rounded-[2px] px-2 py-2 text-sm outline-none aria-selected:bg-lift",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export function CommandEmpty({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <CommandPrimitive.Empty className={cn("px-2 py-6 text-center text-sm text-mist", className)} {...props} />;
}
