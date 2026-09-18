import { createFileRoute } from "@tanstack/react-router";
import { decodeJpegBase64, isAvatarUserId } from "@/lib/split/avatar";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/avatar/$userId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const userId = params.userId;
        if (!isAvatarUserId(userId)) {
          return new Response("Not found", { status: 404 });
        }
        const sql = await getSql();
        const rows = await sql<{ mime: string; data: string }>`
          select mime, data from user_avatars where user_id = ${userId} limit 1
        `;
        const row = rows[0];
        if (!row) {
          return new Response("Not found", { status: 404 });
        }
        let body: Uint8Array;
        try {
          body = decodeJpegBase64(row.data);
        } catch {
          return new Response("Not found", { status: 404 });
        }
        const bytes = new Uint8Array(body.byteLength);
        bytes.set(body);
        return new Response(bytes, {
          headers: {
            "content-type": "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
