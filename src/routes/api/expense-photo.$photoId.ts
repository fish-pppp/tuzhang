import { createFileRoute } from "@tanstack/react-router";
import { decodeExpenseJpeg, isExpensePhotoId } from "@/lib/split/photo";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/expense-photo/$photoId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const photoId = params.photoId;
        if (!isExpensePhotoId(photoId)) {
          return new Response("Not found", { status: 404 });
        }
        const sql = await getSql();
        const rows = await sql<{ mime: string; data: string }>`
          select mime, data from group_expense_photos where id = ${photoId} limit 1
        `;
        const row = rows[0];
        if (!row) {
          return new Response("Not found", { status: 404 });
        }
        let body: Uint8Array;
        try {
          body = decodeExpenseJpeg(row.data);
        } catch {
          return new Response("Not found", { status: 404 });
        }
        const bytes = new Uint8Array(body.byteLength);
        bytes.set(body);
        return new Response(bytes, {
          headers: {
            "content-type": row.mime || "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
