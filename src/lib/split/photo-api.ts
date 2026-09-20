import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { newId } from "./money";
import {
  decodeExpenseJpeg,
  expensePhotoPublicUrl,
  isExpensePhotoId,
  MAX_EXPENSE_PHOTOS,
  PHOTO_MAX_BASE64,
} from "./photo";

const groupIdSchema = z.string().min(1).max(80);

async function requireMember(
  sql: Awaited<ReturnType<typeof getSql>>,
  groupId: string,
  userId: string,
) {
  const rows = await sql<{ user_id: string }>`
    select user_id from group_members
    where group_id = ${groupId}
      and user_id = ${userId}
      and removed_at is null
    limit 1
  `;
  if (!rows[0]) {
    throw new Error("你不在这个群组里");
  }
}

export const uploadExpensePhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        base64: z.string().min(80).max(PHOTO_MAX_BASE64),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    decodeExpenseJpeg(data.base64);
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from group_expense_photos
      where group_id = ${data.groupId}
        and uploaded_by = ${context.userId}
        and expense_id is null
    `;
    if ((pending[0]?.n ?? 0) >= MAX_EXPENSE_PHOTOS) {
      throw new Error(`最多 ${MAX_EXPENSE_PHOTOS} 张照片`);
    }
    const id = newId();
    if (!isExpensePhotoId(id)) {
      throw new Error("生成照片编号失败，请再试一次");
    }
    await sql`
      insert into group_expense_photos
        (id, group_id, expense_id, uploaded_by, mime, data, sort_order)
      values
        (${id}, ${data.groupId}, null, ${context.userId}, ${"image/jpeg"}, ${data.base64}, 0)
    `;
    return { id, url: expensePhotoPublicUrl(id, Date.now()) };
  });

export const discardExpensePhotos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        photoIds: z.array(z.string().min(8).max(80)).max(MAX_EXPENSE_PHOTOS),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const ids = [...new Set(data.photoIds)].filter(isExpensePhotoId);
    if (ids.length === 0) return { ok: true as const };
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    await sql`
      delete from group_expense_photos
      where group_id = ${data.groupId}
        and uploaded_by = ${context.userId}
        and expense_id is null
        and id = any(${ids}::text[])
    `;
    return { ok: true as const };
  });
