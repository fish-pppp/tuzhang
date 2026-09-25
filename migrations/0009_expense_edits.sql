-- Append-only edit history for a group bill. The live row stays in
-- group_expenses (created_by is already the bill creator). Each save records
-- who changed which fields, and the values before and after. Do not delete
-- or rewrite existing bills.

create table if not exists group_expense_edits (
  id         text primary key,
  expense_id text not null references group_expenses(id) on delete cascade,
  group_id   text not null references groups(id) on delete cascade,
  edited_by  text not null,
  edited_at  timestamptz not null default now(),
  changes    jsonb not null
);

create index if not exists group_expense_edits_group_edited_idx
  on group_expense_edits (group_id, edited_at desc);

create index if not exists group_expense_edits_expense_edited_idx
  on group_expense_edits (expense_id, edited_at desc);
