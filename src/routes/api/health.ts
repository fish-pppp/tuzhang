import { createFileRoute } from "@tanstack/react-router";

/**
 * Liveness probe for Docker / a reverse proxy. Does not touch the database
 * so a slow Postgres cannot flap the container.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { ok: true, service: "tuzhang" },
          {
            headers: { "cache-control": "no-store" },
          },
        ),
    },
  },
});
