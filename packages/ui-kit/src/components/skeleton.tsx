import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[2px] bg-lift", className)} {...props} />;
}
