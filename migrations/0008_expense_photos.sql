-- Receipt / proof photos attached to a group expense. Bytes live here;
-- group_expenses and the client only keep a short public path
-- `/api/expense-photo/<id>?v=<ts>`. Applied on Neon at deploy and on PGLite
-- at startup. expense_id is nullable so photos can be uploaded while the
-- bill form is still open, then attached on submit. Rolling back a failed
-- insert sets expense_id back to null (ON DELETE SET NULL) so the same
-- photos can be retried.

create table if not exists group_expense_photos (
  id           text primary key,
  group_id     text not null references groups(id) on delete cascade,
  expense_id   text references group_expenses(id) on delete set null,
  uploaded_by  text not null,
  mime         text not null,
  data         text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists group_expense_photos_expense_id_idx
  on group_expense_photos (expense_id);

create index if not exists group_expense_photos_group_pending_idx
  on group_expense_photos (group_id, uploaded_by)
  where expense_id is null;
