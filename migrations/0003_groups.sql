create table if not exists groups (
  id          text primary key,
  name        text not null,
  invite_code text not null unique,
  created_by  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists group_members (
  group_id     text not null references groups(id) on delete cascade,
  user_id      text not null,
  display_name text not null,
  avatar_url   text,
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_id_idx on group_members (user_id);

create table if not exists group_expenses (
  id           text primary key,
  group_id     text not null references groups(id) on delete cascade,
  title        text not null,
  amount_cents integer not null,
  payer_id     text not null,
  created_by   text not null,
  created_at   timestamptz not null default now()
);
create index if not exists group_expenses_group_id_idx on group_expenses (group_id);

create table if not exists group_expense_shares (
  expense_id text not null references group_expenses(id) on delete cascade,
  user_id    text not null,
  primary key (expense_id, user_id)
);
