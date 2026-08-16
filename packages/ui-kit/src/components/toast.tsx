import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "rounded-[2px] border border-border bg-card text-[var(--pump)]",
        },
      }}
    />
  );
}

export { toast };
