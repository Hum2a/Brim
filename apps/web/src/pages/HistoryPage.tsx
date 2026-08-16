import { m } from "motion/react";
import { useEffect, useState } from "react";
import { reveal, staggerChildren, usePrefersReducedMotion } from "@brim/ui-kit";
import { Button } from "@brim/ui-kit/button";
import { Card } from "@brim/ui-kit/card";
import { toast } from "@brim/ui-kit/toast";
import { api, apiBase } from "../api.js";

type Row = {
  id: string;
  origin: string;
  destination: string;
  totalPence: number;
  createdAt: string;
};

export function HistoryPage() {
  const reduce = usePrefersReducedMotion();
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
    <main className="mx-auto w-[min(720px,calc(100%-1.5rem))] py-8">
      <m.div variants={staggerChildren} initial={reduce ? false : "initial"} animate="animate">
        <m.div variants={reveal}>
          <h1 className="display mb-2 text-4xl">Journeys</h1>
          <p className="mb-6 text-mist">Snapshots. The number will not move if constants change.</p>
        </m.div>
        <m.div variants={reveal}>
          <Button
            type="button"
            variant="ghost"
            className="mb-6"
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
        </m.div>
        <ul className="grid gap-3">
          {rows.map((r) => (
            <m.li key={r.id} layout variants={reveal}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="text-left" onClick={() => setDetail(r.id)}>
                  <p>
                    {r.origin} → {r.destination}
                  </p>
                  <p className="tabular text-sm text-mist">
                    £{(r.totalPence / 100).toFixed(2)} · {r.createdAt.slice(0, 10)}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="warning"
                  size="sm"
                  onClick={async () => {
                    if (!confirm("Delete this journey permanently?")) return;
                    await api(`/v1/journeys/${r.id}`, { method: "DELETE" });
                    toast("Journey deleted.");
                    await refresh();
                  }}
                >
                  Delete
                </Button>
              </Card>
            </m.li>
          ))}
        </ul>
        {detail ? (
          <p className="mt-4 text-sm text-mist">Opened {detail}. Stored as the snapshot from the day you saved it.</p>
        ) : null}
      </m.div>
    </main>
  );
}
