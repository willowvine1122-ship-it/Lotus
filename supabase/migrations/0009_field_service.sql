-- Field service and payments: technicians, a price book, jobs and their
-- crews, estimates with good / better / best options, invoices, payments.
-- Every table carries account_id so row-level security is one check.

alter type activity_kind add value if not exists 'job';
alter type activity_kind add value if not exists 'estimate';
alter type activity_kind add value if not exists 'invoice';
alter type activity_kind add value if not exists 'payment';

create type job_status as enum ('unscheduled', 'scheduled', 'en_route', 'in_progress', 'completed', 'canceled');
create type estimate_status as enum ('draft', 'sent', 'approved', 'declined');
create type invoice_status as enum ('draft', 'sent', 'paid', 'void');
create type payment_method as enum ('card', 'ach', 'cash', 'check');

-- Per-account document numbers (J-1001, E-2001, INV-3001).
create table document_counters (
  account_id uuid primary key references accounts(id) on delete cascade,
  next_job      integer not null default 1001,
  next_estimate integer not null default 2001,
  next_invoice  integer not null default 3001
);

create or replace function next_document_number(target uuid, kind text)
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into document_counters (account_id) values (target) on conflict do nothing;
  if kind = 'job' then
    update document_counters set next_job = next_job + 1 where account_id = target returning next_job - 1 into n;
    return 'J-' || n;
  elsif kind = 'estimate' then
    update document_counters set next_estimate = next_estimate + 1 where account_id = target returning next_estimate - 1 into n;
    return 'E-' || n;
  else
    update document_counters set next_invoice = next_invoice + 1 where account_id = target returning next_invoice - 1 into n;
    return 'INV-' || n;
  end if;
end;
$$;

-- Crew and price book ---------------------------------------------------

create table technicians (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null, -- set once they sign in to the crew app
  name       text not null,
  role       text not null default 'Technician',
  phone      text,
  color      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index technicians_account_idx on technicians(account_id) where active;

create table price_book_items (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name       text not null,
  unit_cents bigint not null check (unit_cents >= 0),
  taxable    boolean not null default true,
  archived   boolean not null default false,
  unique (account_id, name)
);

-- Jobs ------------------------------------------------------------------

create table jobs (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete restrict,
  number       text not null,
  title        text not null,
  address      text not null,
  status       job_status not null default 'unscheduled',
  starts_at    timestamptz,
  duration_min integer not null default 120 check (duration_min between 15 and 1440),
  notes        text,
  estimate_id  uuid, -- fk added below, estimates reference jobs too
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (account_id, number),
  check (status = 'unscheduled' or starts_at is not null)
);
create index jobs_board_idx on jobs(account_id, starts_at);
create index jobs_status_idx on jobs(account_id, status);
create index jobs_contact_idx on jobs(contact_id);

create table job_technicians (
  job_id        uuid not null references jobs(id) on delete cascade,
  technician_id uuid not null references technicians(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  is_lead       boolean not null default false,
  primary key (job_id, technician_id)
);
create index job_technicians_tech_idx on job_technicians(technician_id);

-- Estimates -------------------------------------------------------------

create table estimates (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete restrict,
  number      text not null,
  title       text not null,
  address     text not null,
  status      estimate_status not null default 'draft',
  message     text,
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 5000),
  approved_option_id uuid,
  job_id      uuid references jobs(id) on delete set null,
  public_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  decided_at  timestamptz,
  expires_on  date not null,
  unique (account_id, number)
);
create index estimates_status_idx on estimates(account_id, status, sent_at desc);

alter table jobs add constraint jobs_estimate_fk foreign key (estimate_id) references estimates(id) on delete set null;

create table estimate_options (
  id          uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  position    smallint not null,
  unique (estimate_id, position)
);

alter table estimates add constraint estimates_option_fk foreign key (approved_option_id) references estimate_options(id) on delete set null;

-- Invoices and payments -------------------------------------------------

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete restrict,
  job_id       uuid references jobs(id) on delete set null,
  estimate_id  uuid references estimates(id) on delete set null,
  number       text not null,
  title        text not null,
  status       invoice_status not null default 'draft',
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 5000),
  memo         text,
  issued_on    date not null default current_date,
  due_on       date not null,
  public_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  unique (account_id, number)
);
create index invoices_status_idx on invoices(account_id, status, due_on);
-- One live invoice per job.
create unique index invoices_job_unique on invoices(job_id) where job_id is not null and status <> 'void';

create table payments (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  invoice_id   uuid not null references invoices(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  method       payment_method not null,
  reference    text,              -- check number, bank reference
  stripe_payment_intent text unique,
  recorded_by  uuid references auth.users(id) on delete set null,
  paid_at      timestamptz not null default now()
);
create index payments_invoice_idx on payments(invoice_id);
create index payments_account_idx on payments(account_id, paid_at desc);

-- Line items: one table, exactly one parent.
create table line_items (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  job_id        uuid references jobs(id) on delete cascade,
  option_id     uuid references estimate_options(id) on delete cascade,
  invoice_id    uuid references invoices(id) on delete cascade,
  position      smallint not null,
  name          text not null,
  description   text,
  quantity      numeric(12, 2) not null check (quantity > 0),
  unit_cents    bigint not null check (unit_cents >= 0),
  check (num_nonnulls(job_id, option_id, invoice_id) = 1)
);
create index line_items_job_idx on line_items(job_id) where job_id is not null;
create index line_items_option_idx on line_items(option_id) where option_id is not null;
create index line_items_invoice_idx on line_items(invoice_id) where invoice_id is not null;

-- Invoice totals and status, derived; "overdue" is sent with a balance past due_on.
create or replace view invoice_balances with (security_invoker = true) as
select
  i.id,
  i.account_id,
  coalesce(sum(round(li.quantity * li.unit_cents)), 0)::bigint as subtotal_cents,
  round(coalesce(sum(round(li.quantity * li.unit_cents)), 0) * i.tax_rate_bps / 10000.0)::bigint as tax_cents,
  coalesce((select sum(p.amount_cents) from payments p where p.invoice_id = i.id), 0)::bigint as paid_cents
from invoices i
left join line_items li on li.invoice_id = i.id
group by i.id;

-- Paid in full flips the invoice to paid.
create or replace function settle_invoice() returns trigger language plpgsql as $$
declare total bigint; paid bigint;
begin
  select b.subtotal_cents + b.tax_cents, b.paid_cents into total, paid from invoice_balances b where b.id = new.invoice_id;
  if paid >= total then
    update invoices set status = 'paid' where id = new.invoice_id and status <> 'void';
  elsif (select status from invoices where id = new.invoice_id) = 'draft' then
    update invoices set status = 'sent', sent_at = coalesce(sent_at, now()) where id = new.invoice_id;
  end if;
  return new;
end;
$$;
create trigger payments_settle after insert on payments for each row execute function settle_invoice();

-- Row-level security ---------------------------------------------------
-- Agency staff and the client's own logins can see and work their account's
-- field service records. Customers reach estimates and invoices only through
-- public_token, via a server route, never through these tables directly.

alter table document_counters enable row level security;
alter table technicians       enable row level security;
alter table price_book_items  enable row level security;
alter table jobs              enable row level security;
alter table job_technicians   enable row level security;
alter table estimates         enable row level security;
alter table estimate_options  enable row level security;
alter table invoices          enable row level security;
alter table payments          enable row level security;
alter table line_items        enable row level security;

create policy counters_access    on document_counters for all using (can_access_account(account_id));
create policy technicians_access on technicians       for all using (can_access_account(account_id));
create policy price_book_access  on price_book_items  for all using (can_access_account(account_id));
create policy jobs_access        on jobs              for all using (can_access_account(account_id));
create policy job_techs_access   on job_technicians   for all using (can_access_account(account_id));
create policy estimates_access   on estimates         for all using (can_access_account(account_id));
create policy options_access     on estimate_options  for all using (can_access_account(account_id));
create policy invoices_access    on invoices          for all using (can_access_account(account_id));
create policy line_items_access  on line_items        for all using (can_access_account(account_id));

-- Payments are append-only for staff; corrections are refunds, not edits.
create policy payments_read   on payments for select using (can_access_account(account_id));
create policy payments_insert on payments for insert with check (can_access_account(account_id));
