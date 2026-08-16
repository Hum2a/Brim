import { z } from "zod";
import type { Context } from "hono";
import type { ApiBindings } from "./env.js";
import { cookieHeader, encodeSession, ensureAnon, readSession } from "./auth.js";
import { deleteJourney, getJourney, listJourneys, saveJourney } from "./db/repo.js";
import type { JourneyRow } from "./db/memory.js";

const saveBody = z.object({
  origin: z.string(),
  destination: z.string(),
  vehicleId: z.string().optional(),
  departsAt: z.string().optional(),
  estimate: z.record(z.string(), z.unknown()),
});

async function owner(c: Context<{ Bindings: ApiBindings }>) {
  const session = await ensureAnon(c.env, await readSession(c.env, c.req.header("Cookie")));
  c.header("Set-Cookie", cookieHeader(await encodeSession(c.env, session), c.req.url));
  return session;
}

export async function saveJourneyHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const parsed = saveBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
  const estimate = parsed.data.estimate as {
    distanceMeters: number;
    durationSeconds: number;
    charges: unknown;
    cost: { energyPence: { point: number }; chargesPence: number; totalPence: { point: number } };
  };
  const row: JourneyRow = {
    id: crypto.randomUUID(),
    owner_id: session.ownerId,
    origin_label: parsed.data.origin,
    dest_label: parsed.data.destination,
    distance_meters: estimate.distanceMeters,
    duration_seconds: estimate.durationSeconds,
    estimate_json: estimate,
    charges_json: estimate.charges,
    is_saved: true,
    created_at: new Date().toISOString(),
  };
  if (parsed.data.vehicleId) row.vehicle_id = parsed.data.vehicleId;
  if (parsed.data.departsAt) row.departs_at = parsed.data.departsAt;
  return c.json(saveJourney(row), 201);
}

export async function listJourneysHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const limit = Number(c.req.query("limit") ?? 50);
  const items = listJourneys(session.ownerId).slice(0, Number.isFinite(limit) ? limit : 50);
  return c.json({
    journeys: items.map((j) => ({
      id: j.id,
      origin: j.origin_label,
      destination: j.dest_label,
      distanceMeters: j.distance_meters,
      totalPence: (j.estimate_json as { cost?: { totalPence?: { point?: number } } }).cost?.totalPence?.point ?? 0,
      vehicleId: j.vehicle_id,
      createdAt: j.created_at,
    })),
  });
}

export async function getJourneyHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const row = getJourney(session.ownerId, c.req.param("id") ?? "");
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
}

export async function deleteJourneyHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  if (!deleteJourney(session.ownerId, c.req.param("id") ?? "")) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export async function exportJourneysHandler(c: Context<{ Bindings: ApiBindings }>) {
  const session = await owner(c);
  const rows = listJourneys(session.ownerId);
  const header = "date,from,to,miles,vehicle,energy cost,charges,total,HMRC approved amount,difference";
  const lines = rows.map((j) => {
    const estimate = j.estimate_json as {
      cost: { energyPence: { point: number }; chargesPence: number; totalPence: { point: number } };
      hmrc?: { approvedPence: number };
    };
    const miles = (j.distance_meters / 1609.344).toFixed(1);
    const energy = (estimate.cost.energyPence.point / 100).toFixed(2);
    const charges = (estimate.cost.chargesPence / 100).toFixed(2);
    const total = (estimate.cost.totalPence.point / 100).toFixed(2);
    const hmrc = ((estimate.hmrc?.approvedPence ?? 0) / 100).toFixed(2);
    const diff = ((estimate.cost.totalPence.point - (estimate.hmrc?.approvedPence ?? 0)) / 100).toFixed(2);
    return [
      j.created_at.slice(0, 10),
      csvEscape(j.origin_label),
      csvEscape(j.dest_label),
      miles,
      j.vehicle_id ?? "",
      energy,
      charges,
      total,
      hmrc,
      diff,
    ].join(",");
  });
  const body = `\uFEFF${header}\n${lines.join("\n")}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"brim-journeys.csv\"",
    },
  });
}
