import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[11px] uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border-glass-border text-mist",
        diesel: "border-diesel/40 text-diesel",
        warning: "border-warning/40 text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
