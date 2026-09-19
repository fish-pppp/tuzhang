-- Soft-remove group members so the owner can drop someone without
-- deleting historical bills or share rows. Active membership is
-- `removed_at is null`.

alter table group_members add column if not exists removed_at timestamptz;
alter table group_members add column if not exists removed_by text;

create index if not exists group_members_active_idx
  on group_members (group_id)
  where removed_at is null;
