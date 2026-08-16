import { useEffect, useState } from "react";
import { Button } from "@brim/ui-kit/button";
import { api, apiBase } from "../api.js";

type Row = {
  id: string;
  origin: string;
  destination: string;
  totalPence: number;
  createdAt: string;
};

export function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<string | null>(null);

  async function refresh() {
    const res = await api<{ journeys: Row[] }>("/v1/journeys");
    setRows(res.journeys);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-4">
      <p>
        <a href="/" className="underline">
          Back
        </a>
      </p>
      <h1 className="display mb-4 text-3xl">Journeys</h1>
      <Button
        type="button"
        variant="ghost"
        className="mb-4"
        onClick={async () => {
          const res = await fetch(`${apiBase}/v1/journeys/export`, { credentials: "include" });
          const blob = await res.blob();
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = "brim-journeys.csv";
          a.click();
          URL.revokeObjectURL(href);
        }}
      >
        Download CSV
      </Button>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className="mb-3 border-b border-[var(--pump)]/10 pb-3">
            <button type="button" className="text-left" onClick={() => setDetail(r.id)}>
              {r.origin} → {r.destination}
            </button>
            <p className="tabular text-sm opacity-70">
              £{(r.totalPence / 100).toFixed(2)} · {r.createdAt.slice(0, 10)}
            </p>
            <Button
              type="button"
              variant="warning"
              onClick={async () => {
                if (!confirm("Delete this journey permanently?")) return;
                await api(`/v1/journeys/${r.id}`, { method: "DELETE" });
                await refresh();
              }}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {detail ? <p className="text-sm opacity-70">Stored as the snapshot from the day you saved it. The number will not move if constants change.</p> : null}
    </main>
  );
}
