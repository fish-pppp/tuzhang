-- Custom avatars (uploaded photos). Better Auth's "user"."image" stores a short
-- public path `/api/avatar/<userId>?v=<ts>` so the session cookie stays small;
-- the bytes live here. Applied on Neon at deploy and on PGLite at startup.

create table if not exists user_avatars (
  user_id    text primary key,
  mime       text not null,
  data       text not null,
  updated_at timestamptz not null default now()
);
