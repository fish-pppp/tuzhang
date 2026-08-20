import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { memberBalance } from "./calc";
import { newId } from "./money";
import type { Expense, Member, Trip } from "./types";

export type GroupSummary = {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  createdBy: string;
  myPaidCents: number;
  myShareCents: number;
  myNetCents: number;
  expenseCount: number;
};

export type GroupPayload = Trip & {
  inviteCode: string;
  createdBy: string;
};

const nameSchema = z.string().trim().min(1).max(80);
const codeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine((s) => s.length >= 4 && s.length <= 12, "邀请码无效");
const groupIdSchema = z.string().min(1).max(80);
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  avatarUrl: z.string().max(2000).nullable().optional(),
});

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function requireMember(
  sql: Awaited<ReturnType<typeof getSql>>,
  groupId: string,
  userId: string,
) {
  const rows = await sql<{ user_id: string }>`
    select user_id from group_members
    where group_id = ${groupId} and user_id = ${userId}
    limit 1
  `;
  if (!rows[0]) {
    throw new Error("你不在这个群组里");
  }
}

async function loadGroupTrip(
  sql: Awaited<ReturnType<typeof getSql>>,
  groupId: string,
): Promise<GroupPayload | null> {
  const groups = await sql<{
    id: string;
    name: string;
    invite_code: string;
    created_by: string;
  }>`
    select id, name, invite_code, created_by from groups where id = ${groupId} limit 1
  `;
  const group = groups[0];
  if (!group) return null;

  const memberRows = await sql<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  }>`
    select user_id, display_name, avatar_url
    from group_members
    where group_id = ${groupId}
    order by joined_at asc
  `;
  const members: Member[] = memberRows.map((m) => ({
    id: m.user_id,
    name: m.display_name,
    avatar: m.avatar_url,
  }));

  const expenseRows = await sql<{
    id: string;
    title: string;
    amount_cents: number;
    payer_id: string;
    created_at: string;
  }>`
    select id, title, amount_cents, payer_id, created_at::text as created_at
    from group_expenses
    where group_id = ${groupId}
    order by created_at desc
  `;
  const shareRows = await sql<{ expense_id: string; user_id: string }>`
    select s.expense_id, s.user_id
    from group_expense_shares s
    join group_expenses e on e.id = s.expense_id
    where e.group_id = ${groupId}
  `;
  const sharesByExpense = new Map<string, string[]>();
  for (const row of shareRows) {
    const list = sharesByExpense.get(row.expense_id) ?? [];
    list.push(row.user_id);
    sharesByExpense.set(row.expense_id, list);
  }
  const expenses: Expense[] = expenseRows.map((e) => ({
    id: e.id,
    title: e.title,
    amountCents: Number(e.amount_cents),
    payerId: e.payer_id,
    participantIds: sharesByExpense.get(e.id) ?? [],
    createdAt: e.created_at,
  }));

  return {
    id: group.id,
    name: group.name,
    inviteCode: group.invite_code,
    createdBy: group.created_by,
    members,
    expenses,
  };
}

export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      invite_code: string;
      created_by: string;
      member_count: number;
    }>`
      select g.id, g.name, g.invite_code, g.created_by,
             (select count(*)::int from group_members m where m.group_id = g.id) as member_count
      from groups g
      join group_members me on me.group_id = g.id
      where me.user_id = ${context.userId}
      order by g.created_at desc
    `;

    const expenseRows = await sql<{
      id: string;
      group_id: string;
      amount_cents: number;
      payer_id: string;
    }>`
      select e.id, e.group_id, e.amount_cents, e.payer_id
      from group_expenses e
      join group_members me on me.group_id = e.group_id
      where me.user_id = ${context.userId}
    `;
    const shareRows = await sql<{ expense_id: string; user_id: string }>`
      select s.expense_id, s.user_id
      from group_expense_shares s
      join group_expenses e on e.id = s.expense_id
      join group_members me on me.group_id = e.group_id
      where me.user_id = ${context.userId}
    `;
    const sharesByExpense = new Map<string, string[]>();
    for (const row of shareRows) {
      const list = sharesByExpense.get(row.expense_id) ?? [];
      list.push(row.user_id);
      sharesByExpense.set(row.expense_id, list);
    }
    const expensesByGroup = new Map<string, Expense[]>();
    for (const e of expenseRows) {
      const list = expensesByGroup.get(e.group_id) ?? [];
      list.push({
        id: e.id,
        title: "",
        amountCents: Number(e.amount_cents),
        payerId: e.payer_id,
        participantIds: sharesByExpense.get(e.id) ?? [],
        createdAt: "",
      });
      expensesByGroup.set(e.group_id, list);
    }

    return rows.map((r): GroupSummary => {
      const bal = memberBalance(expensesByGroup.get(r.id) ?? [], context.userId);
      return {
        id: r.id,
        name: r.name,
        inviteCode: r.invite_code,
        memberCount: Number(r.member_count),
        createdBy: r.created_by,
        myPaidCents: bal.paidCents,
        myShareCents: bal.shareCents,
        myNetCents: bal.netCents,
        expenseCount: bal.expenseCount,
      };
    });
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ name: nameSchema }).merge(profileSchema).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = newId();
    let code = inviteCode();
    let inserted = false;
    for (let i = 0; i < 6; i += 1) {
      try {
        await sql`
          insert into groups (id, name, invite_code, created_by)
          values (${id}, ${data.name}, ${code}, ${context.userId})
        `;
        inserted = true;
        break;
      } catch {
        code = inviteCode();
      }
    }
    if (!inserted) throw new Error("创建群组失败，请再试一次");
    const avatar = data.avatarUrl ?? null;
    await sql`
      insert into group_members (group_id, user_id, display_name, avatar_url)
      values (${id}, ${context.userId}, ${data.displayName}, ${avatar})
    `;
    return { id, inviteCode: code, name: data.name };
  });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ code: codeSchema }).merge(profileSchema).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const groups = await sql<{ id: string; name: string }>`
      select id, name from groups where invite_code = ${data.code} limit 1
    `;
    const group = groups[0];
    if (!group) throw new Error("邀请码无效");

    const avatar = data.avatarUrl ?? null;
    await sql`
      insert into group_members (group_id, user_id, display_name, avatar_url)
      values (${group.id}, ${context.userId}, ${data.displayName}, ${avatar})
      on conflict (group_id, user_id) do update
        set display_name = excluded.display_name,
            avatar_url = excluded.avatar_url
    `;
    return { id: group.id, name: group.name };
  });

export const loadGroup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ groupId: groupIdSchema }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    const trip = await loadGroupTrip(sql, data.groupId);
    if (!trip) throw new Error("群组不存在");
    return trip;
  });

export const renameGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ groupId: groupIdSchema, name: nameSchema }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    await sql`update groups set name = ${data.name} where id = ${data.groupId}`;
    return { ok: true as const };
  });

export const updateMyName = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        displayName: z.string().trim().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    await sql`
      update group_members
      set display_name = ${data.displayName}
      where group_id = ${data.groupId} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const addGroupExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        title: z.string().trim().min(1).max(40),
        amountCents: z.number().int().positive(),
        payerId: z.string().min(1),
        participantIds: z.array(z.string().min(1)).min(1),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    const members = await sql<{ user_id: string }>`
      select user_id from group_members where group_id = ${data.groupId}
    `;
    const allowed = new Set(members.map((m) => m.user_id));
    if (!allowed.has(data.payerId)) throw new Error("付款人不在群组里");
    const participants = [...new Set(data.participantIds)].filter((id) =>
      allowed.has(id),
    );
    if (participants.length === 0) throw new Error("至少选择一位一起 AA 的人");
    const id = newId();
    await sql`
      insert into group_expenses (id, group_id, title, amount_cents, payer_id, created_by)
      values (${id}, ${data.groupId}, ${data.title}, ${data.amountCents}, ${data.payerId}, ${context.userId})
    `;
    for (const userId of participants) {
      await sql`
        insert into group_expense_shares (expense_id, user_id)
        values (${id}, ${userId})
      `;
    }
    return { id };
  });

export const removeGroupExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ groupId: groupIdSchema, expenseId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    await sql`
      delete from group_expenses
      where id = ${data.expenseId} and group_id = ${data.groupId}
    `;
    return { ok: true as const };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ groupId: groupIdSchema }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    await sql`
      delete from group_members
      where group_id = ${data.groupId} and user_id = ${context.userId}
    `;
    const leftover = await sql<{ n: number }>`
      select count(*)::int as n from group_members where group_id = ${data.groupId}
    `;
    if ((leftover[0]?.n ?? 0) === 0) {
      await sql`delete from groups where id = ${data.groupId}`;
    }
    return { ok: true as const };
  });
