import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { Trip } from "./types";

const saveSchema = z.object({
  name: z.string().min(1).max(80),
  payload: z.string().min(2).max(200_000),
});

export const loadSavedTrip = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ name: string; payload: string }>`
      select name, payload from trips where user_id = ${context.userId} limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    try {
      const trip = JSON.parse(row.payload) as Trip;
      if (!trip || !Array.isArray(trip.members) || !Array.isArray(trip.expenses)) {
        return null;
      }
      return { ...trip, name: row.name || trip.name };
    } catch {
      return null;
    }
  });

export const saveTrip = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into trips (user_id, name, payload, updated_at)
      values (${context.userId}, ${data.name}, ${data.payload}, now())
      on conflict (user_id) do update
        set name = excluded.name,
            payload = excluded.payload,
            updated_at = now()
    `;
    return { ok: true as const };
  });
