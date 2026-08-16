import type { FormHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";
import { Label } from "./label.js";

export function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cn("space-y-1", className)} {...props} />;
}

export function FormItem({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 space-y-1.5", className)} {...props} />;
}

export { Label };
