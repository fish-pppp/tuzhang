-- Custom splits can be entered in the bill currency. amount_cents stays the
-- CNY ledger amount. original_minor is that person's share in the bill currency
-- (cents, or whole dong). Null for RMB custom splits and for equal AA.

alter table group_expense_shares
  add column if not exists original_minor integer;

alter table group_expense_shares
  add constraint group_expense_shares_original_minor_chk
  check (original_minor is null or (original_minor >= 0 and original_minor <= 2000000000));
