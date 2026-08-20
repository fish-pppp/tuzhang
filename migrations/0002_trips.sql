create table if not exists trips (
  user_id    text primary key,
  name       text not null,
  payload    text not null,
  updated_at timestamptz not null default now()
);
