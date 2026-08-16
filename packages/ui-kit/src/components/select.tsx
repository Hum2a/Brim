import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-[2px] border border-[var(--pump)]/20 bg-[var(--forecourt)] px-3 py-2 text-[var(--pump)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pump)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
