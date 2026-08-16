import { Toaster as Sonner, toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      toastOptions={{
        classNames: {
          toast:
            "rounded-[2px] border border-[var(--glass-border)] bg-[var(--glass)] text-[var(--pump)] shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-xl",
        },
      }}
    />
  );
}

export { toast };
