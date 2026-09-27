-- Optional bill currencies (AUD / NZD / VND) plus the group bank FX fee.
-- amount_cents stays the CNY cents used for splits and balances.
-- Existing CNY bills keep working: currency defaults to CNY and FX columns stay null.

alter table groups
  add column if not exists fx_fee_rate numeric(8, 6) not null default 0.005;

alter table groups
  add constraint groups_fx_fee_rate_chk
  check (fx_fee_rate >= 0 and fx_fee_rate <= 0.1);

alter table group_expenses
  add column if not exists currency text not null default 'CNY';

alter table group_expenses
  add column if not exists original_minor integer;

alter table group_expenses
  add column if not exists fx_mid_rate numeric(20, 10);

alter table group_expenses
  add column if not exists fx_fee_rate numeric(8, 6);

alter table group_expenses
  add column if not exists fx_rate numeric(20, 10);

alter table group_expenses
  add column if not exists fx_quoted_at timestamptz;

alter table group_expenses
  add column if not exists fx_cached boolean not null default false;

alter table group_expenses
  add column if not exists fx_cached_at timestamptz;

alter table group_expenses
  add constraint group_expenses_currency_chk
  check (currency in ('CNY', 'AUD', 'NZD', 'VND'));

alter table group_expenses
  add constraint group_expenses_fx_chk
  check (
    (
      currency = 'CNY'
      and original_minor is null
      and fx_mid_rate is null
      and fx_fee_rate is null
      and fx_rate is null
      and fx_quoted_at is null
      and fx_cached = false
      and fx_cached_at is null
    )
    or (
      currency in ('AUD', 'NZD', 'VND')
      and original_minor > 0
      and fx_mid_rate > 0
      and fx_fee_rate >= 0
      and fx_rate > 0
      and fx_quoted_at is not null
      and (fx_cached = false or fx_cached_at is not null)
    )
  );

-- Last successful public quote. A failed fetch never overwrites this row.
create table if not exists fx_rate_cache (
  currency   text primary key,
  mid_rate   numeric(20, 10) not null,
  quoted_at  timestamptz not null,
  fetched_at timestamptz not null default now(),
  source     text not null,
  constraint fx_rate_cache_currency_chk check (currency in ('AUD', 'NZD', 'VND')),
  constraint fx_rate_cache_mid_chk check (mid_rate > 0)
);
