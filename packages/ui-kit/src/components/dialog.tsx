import type { HTMLAttributes, ReactNode } from "react";

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-[2px] border border-[var(--pump)]/20 bg-[var(--forecourt)] p-4">
        <h2 id="dialog-title" className="display mb-3 text-xl">
          {title}
        </h2>
        {children}
        <button type="button" className="mt-4 text-sm underline" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function Popover({ children }: HTMLAttributes<HTMLDivElement>) {
  return <div className="rounded-[2px] border border-[var(--pump)]/20 bg-[var(--forecourt)] p-2">{children}</div>;
}
