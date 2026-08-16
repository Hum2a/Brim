import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-[2px] bg-white/10", className)} {...props} />;
}
