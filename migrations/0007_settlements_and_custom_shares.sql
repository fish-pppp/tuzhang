-- Early / offline settlements lock a batch of bills. Custom share amounts
-- let a bill skip equal AA.

alter table group_expense_shares
  add column if not exists amount_cents integer;

create table if not exists group_settlements (
  id         text primary key,
  group_id   text not null references groups(id) on delete cascade,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists group_settlements_group_id_idx
  on group_settlements (group_id, created_at desc);

create table if not exists group_settlement_transfers (
  settlement_id text not null references group_settlements(id) on delete cascade,
  from_id       text not null,
  to_id         text not null,
  cents         integer not null,
  primary key (settlement_id, from_id, to_id)
);

alter table group_expenses
  add column if not exists settlement_id text references group_settlements(id);

create index if not exists group_expenses_settlement_id_idx
  on group_expenses (settlement_id)
  where settlement_id is not null;
