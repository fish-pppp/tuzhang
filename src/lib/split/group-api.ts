import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { memberBalance } from "./calc";
import { normalizeDeleteReason } from "./delete-reason";
import { homeGroupName } from "./home-group";
import { assertCanRemoveMember } from "./member-rules";
import { newId } from "./money";
import { buildSettlement } from "./settlement";
import { normalizeExpenseShares } from "./shares";
import type { Expense, ExpenseShare, Member, Settlement, Transfer, Trip } from "./types";

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
  /** Soft-removed people — not in `members` / 结余, but history still shows their names. */
  formerMembers: Member[];
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

/** Postgres `unique_violation` — the only error worth retrying with a new invite code. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "23505"
  );
}

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
    removed_at: string | null;
  }>`
    select m.user_id, m.display_name,
           coalesce(nullif(u."image", ''), m.avatar_url) as avatar_url,
           m.removed_at::text as removed_at
    from group_members m
    left join "user" u on u."id" = m.user_id
    where m.group_id = ${groupId}
    order by m.joined_at asc
  `;
  const members: Member[] = [];
  const formerMembers: Member[] = [];
  for (const m of memberRows) {
    const person: Member = {
      id: m.user_id,
      name: m.display_name,
      avatar: m.avatar_url,
    };
    if (m.removed_at) formerMembers.push(person);
    else members.push(person);
  }

  const expenseRows = await sql<{
    id: string;
    title: string;
    amount_cents: number;
    payer_id: string;
    created_at: string;
    deleted_at: string | null;
    deleted_by: string | null;
    delete_reason: string | null;
    settlement_id: string | null;
  }>`
    select id, title, amount_cents, payer_id, created_at::text as created_at,
           deleted_at::text as deleted_at, deleted_by, delete_reason,
           settlement_id
    from group_expenses
    where group_id = ${groupId}
    order by created_at desc
  `;
  const shareRows = await sql<{
    expense_id: string;
    user_id: string;
    amount_cents: number | null;
  }>`
    select s.expense_id, s.user_id, s.amount_cents
    from group_expense_shares s
    join group_expenses e on e.id = s.expense_id
    where e.group_id = ${groupId}
  `;
  const sharesByExpense = new Map<string, { ids: string[]; custom: ExpenseShare[] }>();
  for (const row of shareRows) {
    const list = sharesByExpense.get(row.expense_id) ?? { ids: [], custom: [] };
    list.ids.push(row.user_id);
    if (row.amount_cents != null) {
      list.custom.push({
        memberId: row.user_id,
        cents: Number(row.amount_cents),
      });
    }
    sharesByExpense.set(row.expense_id, list);
  }
  const expenses: Expense[] = expenseRows.map((e) => {
    const packed = sharesByExpense.get(e.id);
    return {
      id: e.id,
      title: e.title,
      amountCents: Number(e.amount_cents),
      payerId: e.payer_id,
      participantIds: packed?.ids ?? [],
      ...(packed && packed.custom.length === packed.ids.length && packed.custom.length > 0
        ? { shares: packed.custom }
        : {}),
      createdAt: e.created_at,
      deletedAt: e.deleted_at,
      deletedBy: e.deleted_by,
      deleteReason: e.delete_reason,
      settlementId: e.settlement_id,
    };
  });

  const settlementRows = await sql<{
    id: string;
    created_by: string;
    created_at: string;
  }>`
    select id, created_by, created_at::text as created_at
    from group_settlements
    where group_id = ${groupId}
    order by created_at desc
  `;
  const transferRows = await sql<{
    settlement_id: string;
    from_id: string;
    to_id: string;
    cents: number;
  }>`
    select t.settlement_id, t.from_id, t.to_id, t.cents
    from group_settlement_transfers t
    join group_settlements s on s.id = t.settlement_id
    where s.group_id = ${groupId}
  `;
  const transfersBySettlement = new Map<string, Transfer[]>();
  for (const row of transferRows) {
    const list = transfersBySettlement.get(row.settlement_id) ?? [];
    list.push({
      fromId: row.from_id,
      toId: row.to_id,
      cents: Number(row.cents),
    });
    transfersBySettlement.set(row.settlement_id, list);
  }
  const expensesBySettlement = new Map<string, string[]>();
  for (const expense of expenses) {
    if (!expense.settlementId) continue;
    const list = expensesBySettlement.get(expense.settlementId) ?? [];
    list.push(expense.id);
    expensesBySettlement.set(expense.settlementId, list);
  }
  const settlements: Settlement[] = settlementRows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    transfers: transfersBySettlement.get(row.id) ?? [],
    expenseIds: expensesBySettlement.get(row.id) ?? [],
  }));

  return {
    id: group.id,
    name: group.name,
    inviteCode: group.invite_code,
    createdBy: group.created_by,
    members,
    formerMembers,
    expenses,
    settlements,
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
             (select count(*)::int from group_members m
               where m.group_id = g.id and m.removed_at is null) as member_count
      from groups g
      join group_members me on me.group_id = g.id
      where me.user_id = ${context.userId}
        and me.removed_at is null
      order by g.created_at desc
    `;

    const expenseRows = await sql<{
      id: string;
      group_id: string;
      amount_cents: number;
      payer_id: string;
      settlement_id: string | null;
    }>`
      select e.id, e.group_id, e.amount_cents, e.payer_id, e.settlement_id
      from group_expenses e
      join group_members me on me.group_id = e.group_id
      where me.user_id = ${context.userId}
        and me.removed_at is null
        and e.deleted_at is null
    `;
    const shareRows = await sql<{
      expense_id: string;
      user_id: string;
      amount_cents: number | null;
    }>`
      select s.expense_id, s.user_id, s.amount_cents
      from group_expense_shares s
      join group_expenses e on e.id = s.expense_id
      join group_members me on me.group_id = e.group_id
      where me.user_id = ${context.userId}
        and me.removed_at is null
        and e.deleted_at is null
    `;
    const sharesByExpense = new Map<string, { ids: string[]; custom: ExpenseShare[] }>();
    for (const row of shareRows) {
      const list = sharesByExpense.get(row.expense_id) ?? { ids: [], custom: [] };
      list.ids.push(row.user_id);
      if (row.amount_cents != null) {
        list.custom.push({
          memberId: row.user_id,
          cents: Number(row.amount_cents),
        });
      }
      sharesByExpense.set(row.expense_id, list);
    }
    const expensesByGroup = new Map<string, Expense[]>();
    for (const e of expenseRows) {
      const packed = sharesByExpense.get(e.id);
      const list = expensesByGroup.get(e.group_id) ?? [];
      list.push({
        id: e.id,
        title: "",
        amountCents: Number(e.amount_cents),
        payerId: e.payer_id,
        participantIds: packed?.ids ?? [],
        ...(packed && packed.custom.length === packed.ids.length && packed.custom.length > 0
          ? { shares: packed.custom }
          : {}),
        createdAt: "",
        settlementId: e.settlement_id,
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

async function createOwnedGroup(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  name: string,
  displayName: string,
  avatarUrl: string | null,
): Promise<{ id: string; inviteCode: string; name: string }> {
  const id = newId();
  let code = inviteCode();
  let inserted = false;
  for (let i = 0; i < 6; i += 1) {
    try {
      await sql`
        insert into groups (id, name, invite_code, created_by)
        values (${id}, ${name}, ${code}, ${userId})
      `;
      inserted = true;
      break;
    } catch (err) {
      // Only an invite-code collision deserves another roll; anything else
      // (DB down, schema missing) must surface instead of looping 6 times.
      if (!isUniqueViolation(err)) throw err;
      code = inviteCode();
    }
  }
  if (!inserted) throw new Error("创建群组失败，请再试一次");
  await sql`
    insert into group_members (group_id, user_id, display_name, avatar_url)
    values (${id}, ${userId}, ${displayName}, ${avatarUrl})
  `;
  return { id, inviteCode: code, name };
}

export const createGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ name: nameSchema }).merge(profileSchema).parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return createOwnedGroup(
      sql,
      context.userId,
      data.name,
      data.displayName,
      data.avatarUrl ?? null,
    );
  });

/** Latest group this user created, or a new `{名字}的账本` if they have none. */
export const ensureMyHomeGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existing = await sql<{ id: string; name: string }>`
      select g.id, g.name
      from groups g
      join group_members me on me.group_id = g.id
      where me.user_id = ${context.userId}
        and me.removed_at is null
        and g.created_by = ${context.userId}
      order by g.created_at desc
      limit 1
    `;
    if (existing[0]) {
      return { id: existing[0].id, name: existing[0].name, created: false };
    }

    const users = await sql<{
      name: string | null;
      email: string | null;
      image: string | null;
    }>`
      select "name", "email", "image" from "user" where "id" = ${context.userId} limit 1
    `;
    const displayName =
      users[0]?.name?.trim() || users[0]?.email?.split("@")[0] || "途友";
    const created = await createOwnedGroup(
      sql,
      context.userId,
      homeGroupName(displayName),
      displayName,
      users[0]?.image ?? null,
    );
    return { id: created.id, name: created.name, created: true };
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
            avatar_url = excluded.avatar_url,
            removed_at = null,
            removed_by = null,
            joined_at = case
              when group_members.removed_at is not null then now()
              else group_members.joined_at
            end
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
        shares: z
          .array(
            z.object({
              memberId: z.string().min(1),
              cents: z.number().int().nonnegative(),
            }),
          )
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    const members = await sql<{ user_id: string }>`
      select user_id from group_members
      where group_id = ${data.groupId} and removed_at is null
    `;
    const allowed = new Set(members.map((m) => m.user_id));
    if (!allowed.has(data.payerId)) throw new Error("付款人不在群组里");
    const participants = [...new Set(data.participantIds)].filter((id) =>
      allowed.has(id),
    );
    if (participants.length === 0) throw new Error("至少选择一位一起分摊的人");
    const shares = normalizeExpenseShares({
      participantIds: participants,
      amountCents: data.amountCents,
      shares: data.shares,
    });
    const id = newId();
    await sql`
      insert into group_expenses (id, group_id, title, amount_cents, payer_id, created_by)
      values (${id}, ${data.groupId}, ${data.title}, ${data.amountCents}, ${data.payerId}, ${context.userId})
    `;
    try {
      if (shares) {
        const shareIds = shares.map((s) => s.memberId);
        const shareCents = shares.map((s) => s.cents);
        await sql`
          insert into group_expense_shares (expense_id, user_id, amount_cents)
          select ${id}, t.user_id, t.cents
          from unnest(${shareIds}::text[], ${shareCents}::int[]) as t(user_id, cents)
        `;
      } else {
        await sql`
          insert into group_expense_shares (expense_id, user_id)
          select ${id}, unnest(${participants}::text[])
        `;
      }
    } catch (err) {
      // No transaction on the shared Sql surface: undo the header row so a
      // failed share insert can't leave an expense nobody is splitting.
      await sql`delete from group_expenses where id = ${id}`.catch(() => undefined);
      throw err;
    }
    return { id };
  });

export const removeGroupExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        expenseId: z.string().min(1),
        reason: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const reason = normalizeDeleteReason(data.reason);
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    const locked = await sql<{ id: string }>`
      select id from group_expenses
      where id = ${data.expenseId}
        and group_id = ${data.groupId}
        and settlement_id is not null
      limit 1
    `;
    if (locked[0]) {
      throw new Error("这笔账单已经结算，不能再改");
    }
    const updated = await sql<{ id: string }>`
      update group_expenses
      set deleted_at = now(),
          deleted_by = ${context.userId},
          delete_reason = ${reason}
      where id = ${data.expenseId}
        and group_id = ${data.groupId}
        and deleted_at is null
        and settlement_id is null
      returning id
    `;
    if (!updated[0]) {
      throw new Error("这条账单已经删除过了");
    }
    return { ok: true as const };
  });

export const settleGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ groupId: groupIdSchema }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireMember(sql, data.groupId, context.userId);
    const trip = await loadGroupTrip(sql, data.groupId);
    if (!trip) throw new Error("群组不存在");
    const { settlement } = buildSettlement(trip, context.userId);
    await sql`
      insert into group_settlements (id, group_id, created_by)
      values (${settlement.id}, ${data.groupId}, ${context.userId})
    `;
    try {
      if (settlement.transfers.length > 0) {
        const fromIds = settlement.transfers.map((t) => t.fromId);
        const toIds = settlement.transfers.map((t) => t.toId);
        const cents = settlement.transfers.map((t) => t.cents);
        await sql`
          insert into group_settlement_transfers (settlement_id, from_id, to_id, cents)
          select ${settlement.id}, t.from_id, t.to_id, t.cents
          from unnest(${fromIds}::text[], ${toIds}::text[], ${cents}::int[])
            as t(from_id, to_id, cents)
        `;
      }
      const locked = await sql<{ id: string }>`
        update group_expenses
        set settlement_id = ${settlement.id}
        where group_id = ${data.groupId}
          and deleted_at is null
          and settlement_id is null
          and id = any(${settlement.expenseIds}::text[])
        returning id
      `;
      if (locked.length !== settlement.expenseIds.length) {
        throw new Error("有账单刚被别人结算或删除，请刷新后再试");
      }
    } catch (err) {
      await sql`delete from group_settlements where id = ${settlement.id}`.catch(
        () => undefined,
      );
      throw err;
    }
    return { id: settlement.id };
  });

export const removeGroupMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        groupId: groupIdSchema,
        userId: z.string().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const groups = await sql<{ created_by: string }>`
      select created_by from groups where id = ${data.groupId} limit 1
    `;
    const group = groups[0];
    if (!group) throw new Error("群组不存在");
    assertCanRemoveMember({
      actorId: context.userId,
      ownerId: group.created_by,
      targetId: data.userId,
    });
    await requireMember(sql, data.groupId, context.userId);
    const updated = await sql<{ user_id: string }>`
      update group_members
      set removed_at = now(),
          removed_by = ${context.userId}
      where group_id = ${data.groupId}
        and user_id = ${data.userId}
        and removed_at is null
      returning user_id
    `;
    if (!updated[0]) {
      throw new Error("对方已经不在这个群里");
    }
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
      select count(*)::int as n from group_members
      where group_id = ${data.groupId} and removed_at is null
    `;
    if ((leftover[0]?.n ?? 0) === 0) {
      await sql`delete from groups where id = ${data.groupId}`;
    }
    return { ok: true as const };
  });
