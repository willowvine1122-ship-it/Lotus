-- Estimate builder: each client's price book, reusable estimate templates,
-- and what an estimate carries beyond its options (optional add-ons, terms,
-- deposit, the customer's signature and deposit payment). Builds on the
-- estimates table from 0009_field_service.

create type price_item_kind as enum ('item', 'addon');

create table price_book_items (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  name         text not null,
  description  text,
  category     text not null,
  unit_cents   int not null check (unit_cents >= 0),
  unit         text,
  kind         price_item_kind not null default 'item',
  updated_at   timestamptz not null default now()
);
create index price_book_items_account_idx on price_book_items(account_id, category);

-- options: [{ name, lineItems[] }]; add_ons: lineItems[].
create table estimate_templates (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  name         text not null,
  title        text not null,
  message      text,
  options      jsonb not null,
  add_ons      jsonb not null default '[]'::jsonb,
  terms        text not null default '',
  deposit_pct  int not null default 0 check (deposit_pct between 0 and 100),
  valid_days   int not null default 30 check (valid_days between 1 and 365),
  uses         int not null default 0,
  updated_at   timestamptz not null default now()
);
create index estimate_templates_account_idx on estimate_templates(account_id);

alter table estimates
  add column template_id        uuid references estimate_templates(id) on delete set null,
  add column add_ons            jsonb not null default '[]'::jsonb,
  add column chosen_add_on_ids  text[] not null default '{}',
  add column terms              text,
  add column deposit_pct        int not null default 0 check (deposit_pct between 0 and 100),
  add column viewed_at          timestamptz;

-- One signature per estimate; the drawn image is a small PNG kept in Storage, path here.
create table estimate_signatures (
  estimate_id  uuid primary key references estimates(id) on delete cascade,
  name         text not null,
  image_path   text,
  ip           inet,
  user_agent   text,
  signed_at    timestamptz not null default now()
);

create table estimate_deposits (
  estimate_id   uuid primary key references estimates(id) on delete cascade,
  amount_cents  int not null check (amount_cents > 0),
  reference     text not null,
  paid_at       timestamptz not null default now()
);

alter table price_book_items enable row level security;
alter table estimate_templates enable row level security;
alter table estimate_signatures enable row level security;
alter table estimate_deposits enable row level security;

create policy price_book_items_rw on price_book_items for all using (can_access_account(account_id));
create policy estimate_templates_rw on estimate_templates for all using (can_access_account(account_id));
-- Signatures and deposits are written by the customer's link (service role); people read them.
create policy estimate_signatures_read on estimate_signatures for select
  using (can_access_account((select account_id from estimates where id = estimate_id)));
create policy estimate_deposits_read on estimate_deposits for select
  using (can_access_account((select account_id from estimates where id = estimate_id)));
