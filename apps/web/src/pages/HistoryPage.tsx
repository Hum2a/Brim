import { useEffect, useState } from "react";
import { Button } from "@brim/ui-kit/button";
import { Card } from "@brim/ui-kit/card";
import { toast } from "@brim/ui-kit/toast";
import { api, apiBase } from "../api.js";
import { navigate } from "../router.js";

type Row = {
  id: string;
  origin: string;
  destination: string;
  totalPence: number;
  energyPence?: number;
  chargesPence?: number;
  miles?: number;
  vehicleNickname?: string;
  hmrcPence?: number;
  createdAt: string;
};

type Detail = Row & {
  reasons?: string[];
  consumptionLabel?: string;
  hmrc?: { approvedPence?: number; ytdMiles?: number };
  totalLowPence?: number;
  totalHighPence?: number;
};

type Summary = {
  miles: number;
  actualPence: number;
  approvedPence: number;
  crossedThreshold: boolean;
};

function routeLabel(origin: string, destination: string): string {
  return `${origin} to ${destination}`;
}

export function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function refresh() {
    const res = await api<{ journeys: Row[] }>("/v1/journeys");
    setRows(res.journeys);
    setSummary(await api<Summary>("/v1/journeys/summary").catch(() => null));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function openDetail(id: string) {
    const row = await api<Detail>(`/v1/journeys/${id}`);
    setDetail(row);
  }

  return (
    <main className="mx-auto w-[min(720px,calc(100%-1.5rem))] py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="display mb-2 text-3xl md:text-4xl">Journeys</h1>
      <p className="mb-6 text-mist">Snapshots. The number will not move if constants change.</p>
      {summary ? (
        <p className="tabular mb-4 text-sm text-mist">
          This tax year: {summary.miles.toFixed(0)} miles, £{(summary.actualPence / 100).toFixed(2)} actual,
          HMRC would allow £{(summary.approvedPence / 100).toFixed(2)}
          {summary.crossedThreshold ? " (past 10,000 miles)." : "."}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="mb-6 w-full sm:w-auto"
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
      <ul className="grid gap-3">
        {rows.map((r) => {
          const label = routeLabel(r.origin, r.destination);
          return (
            <li key={r.id}>
              <Card className="grid gap-3">
                <button
                  type="button"
                  className="min-h-11 w-full text-left"
                  title={label}
                  onClick={() => void openDetail(r.id)}
                >
                  <p className="break-words">
                    <span className="line-clamp-2">{r.origin}</span>
                    <span className="text-mist"> to </span>
                    <span className="line-clamp-2">{r.destination}</span>
                  </p>
                  <p className="tabular mt-1 text-sm text-mist">
                    £{(r.totalPence / 100).toFixed(2)}
                    {r.miles !== undefined ? ` · ${r.miles.toFixed(0)} mi` : ""}
                    {r.vehicleNickname ? ` · ${r.vehicleNickname}` : ""} · {r.createdAt.slice(0, 10)}
                  </p>
                </button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/?journey=${r.id}`)}
                  >
                    Estimate again
                  </Button>
                  <Button
                    type="button"
                    variant="warning"
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      if (!confirm("Delete this journey permanently?")) return;
                      await api(`/v1/journeys/${r.id}`, { method: "DELETE" });
                      toast("Journey deleted.");
                      setDetail(null);
                      await refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {detail ? (
        <Card className="mt-6">
          <p className="mb-2 break-words" title={routeLabel(detail.origin, detail.destination)}>
            {detail.origin} to {detail.destination}
          </p>
          <p className="tabular text-sm">
            £{(detail.totalPence / 100).toFixed(2)}
            {detail.totalLowPence !== undefined && detail.totalHighPence !== undefined
              ? ` (£${(detail.totalLowPence / 100).toFixed(0)}-${(detail.totalHighPence / 100).toFixed(0)})`
              : ""}
          </p>
          {detail.consumptionLabel ? <p className="mt-2 text-sm text-mist">{detail.consumptionLabel}</p> : null}
          {detail.hmrc?.approvedPence !== undefined ? (
            <p className="tabular mt-2 text-sm text-mist">
              HMRC would allow £{(detail.hmrc.approvedPence / 100).toFixed(2)}.
            </p>
          ) : null}
          {detail.reasons && detail.reasons.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-mist">
              {detail.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-mist">Stored as the snapshot from the day you saved it.</p>
          )}
          <Button type="button" className="mt-4 w-full sm:w-auto" variant="ghost" onClick={() => navigate(`/?journey=${detail.id}`)}>
            Estimate again
          </Button>
        </Card>
      ) : null}
    </main>
  );
}
