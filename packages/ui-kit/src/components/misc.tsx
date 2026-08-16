import type { FormHTMLAttributes, ReactNode } from "react";

export function Command({ children }: { children: ReactNode }) {
  return <div className="rounded-[2px] border border-[var(--pump)]/20 p-2">{children}</div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "text-[var(--gauge)]" : "text-[var(--pump)]/70"}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Form({ children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props}>{children}</form>;
}

export function Toast({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-[2px] border border-[var(--diesel)] px-3 py-2 text-sm">
      {message}
    </div>
  );
}

export function Drawer({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 rounded-t-[2px] border border-[var(--pump)]/20 bg-[var(--forecourt)] p-4">
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`h-4 animate-pulse bg-[var(--pump)]/10 ${className ?? ""}`} />;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative" title={label}>
      {children}
    </span>
  );
}
