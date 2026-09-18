import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { avatarPublicUrl, decodeJpegBase64 } from "./avatar";

const jpegBody = z.object({
  base64: z.string().min(80).max(80_000),
});

export const updateMyAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => jpegBody.parse(data))
  .handler(async ({ context, data }) => {
    decodeJpegBase64(data.base64);
    const sql = await getSql();
    const image = avatarPublicUrl(context.userId, Date.now());
    await sql`
      insert into user_avatars (user_id, mime, data, updated_at)
      values (${context.userId}, ${"image/jpeg"}, ${data.base64}, now())
      on conflict (user_id) do update
        set mime = excluded.mime,
            data = excluded.data,
            updated_at = now()
    `;
    await sql`
      update "user"
      set "image" = ${image}, "updatedAt" = now()
      where "id" = ${context.userId}
    `;
    await sql`
      update group_members
      set avatar_url = ${image}
      where user_id = ${context.userId}
    `;
    return { image };
  });

export const removeMyAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from user_avatars where user_id = ${context.userId}`;
    await sql`
      update "user"
      set "image" = null, "updatedAt" = now()
      where "id" = ${context.userId}
    `;
    await sql`
      update group_members
      set avatar_url = null
      where user_id = ${context.userId}
    `;
    return { image: null as string | null };
  });
