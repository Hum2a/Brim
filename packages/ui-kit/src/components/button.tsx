import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[2px] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pump)] disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--pump)] text-[var(--forecourt)]",
        ghost: "bg-transparent text-[var(--pump)] border border-[var(--pump)]/20",
        warning: "bg-[var(--warning)] text-[var(--pump)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
