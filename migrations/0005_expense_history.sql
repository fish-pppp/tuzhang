-- Soft-delete group expenses so a deleted bill stays as history with a reason.
-- Active ledgers ignore rows where deleted_at is set.

alter table group_expenses add column if not exists deleted_at timestamptz;
alter table group_expenses add column if not exists deleted_by text;
alter table group_expenses add column if not exists delete_reason text;

create index if not exists group_expenses_group_active_idx
  on group_expenses (group_id, created_at desc)
  where deleted_at is null;
