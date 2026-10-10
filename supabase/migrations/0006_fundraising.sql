-- Fundraising: campaigns with a public checkout, donors (contacts who give),
-- donations, and monthly recurring plans. Donors reference contacts so a
-- donor and a lead are one person in the CRM. Public gifts are written by the
-- server with the service role after the payment provider confirms them, so
-- there is no anonymous insert policy; agency members and the client's own
-- logins read through can_access_account like every other sub-account table.

create type gift_frequency as enum ('one_time', 'monthly');
create type campaign_status as enum ('draft', 'live', 'ended');
create type donation_status as enum ('succeeded', 'refunded', 'failed');
create type recurring_status as enum ('active', 'past_due', 'paused', 'canceled');

-- Campaigns -------------------------------------------------------------

create table campaigns (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts(id) on delete cascade,
  slug              text not null unique,        -- /donate/[slug]
  title             text not null,
  summary           text,
  story             text[] not null default '{}',
  goal_cents        bigint not null default 0,
  currency          text not null default 'usd',
  amounts_one_time  bigint[] not null default '{2500,5000,10000,25000,50000,100000}',
  amounts_monthly   bigint[] not null default '{1000,2500,5000,7500,10000,20000}',
  impact            jsonb not null default '{}',  -- { "<cents>": "what it does" }
  default_frequency gift_frequency not null default 'monthly',
  designations      text[] not null default '{"Where it''s needed most"}',
  status            campaign_status not null default 'draft',
  created_at        timestamptz not null default now()
);
create index campaigns_account_idx on campaigns(account_id);

-- Donors ----------------------------------------------------------------
-- One row per contact who has given to the account. Totals are maintained
-- by the trigger below so the donor table sorts without aggregating.

create table donors (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts(id) on delete cascade,
  contact_id         uuid not null references contacts(id) on delete cascade,
  country_code       char(2),
  anonymous          boolean not null default false,
  stripe_customer_id text,
  lifetime_cents     bigint not null default 0,
  gift_count         integer not null default 0,
  first_gift_at      timestamptz,
  last_gift_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (account_id, contact_id)
);
create index donors_account_last_gift_idx on donors(account_id, last_gift_at desc);

-- Recurring plans ---------------------------------------------------------

create table recurring_plans (
  id                     uuid primary key default gen_random_uuid(),
  account_id             uuid not null references accounts(id) on delete cascade,
  donor_id               uuid not null references donors(id) on delete cascade,
  campaign_id            uuid references campaigns(id) on delete set null,
  amount_cents           bigint not null check (amount_cents > 0),
  fee_covered_cents      bigint not null default 0,
  designation            text,
  status                 recurring_status not null default 'active',
  stripe_subscription_id text unique,
  started_at             timestamptz not null default now(),
  next_charge_on         date,
  canceled_at            timestamptz
);
create index recurring_plans_account_idx on recurring_plans(account_id, status);
create index recurring_plans_donor_idx on recurring_plans(donor_id);

-- Donations -------------------------------------------------------------

create table donations (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts(id) on delete cascade,
  donor_id           uuid not null references donors(id) on delete cascade,
  campaign_id        uuid references campaigns(id) on delete set null,
  recurring_plan_id  uuid references recurring_plans(id) on delete set null,
  amount_cents       bigint not null check (amount_cents > 0),
  fee_covered_cents  bigint not null default 0,
  currency           text not null default 'usd',
  frequency          gift_frequency not null,
  designation        text,
  country_code       char(2),
  status             donation_status not null default 'succeeded',
  payment_ref        text unique,                 -- Stripe PaymentIntent / invoice id
  created_at         timestamptz not null default now()
);
create index donations_account_created_idx on donations(account_id, created_at desc);
create index donations_donor_idx on donations(donor_id, created_at desc);
create index donations_campaign_idx on donations(campaign_id);

-- Keep donor totals and the contact's lifetime value in step with gifts.
create or replace function refresh_donor_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.donor_id, old.donor_id);
begin
  update donors d set
    lifetime_cents = coalesce(t.total, 0),
    gift_count     = coalesce(t.n, 0),
    first_gift_at  = t.first_at,
    last_gift_at   = t.last_at
  from (
    select sum(amount_cents) as total, count(*) as n, min(created_at) as first_at, max(created_at) as last_at
    from donations where donor_id = target and status = 'succeeded'
  ) t
  where d.id = target;

  update contacts c set
    lifetime_donated_cents = d.lifetime_cents,
    last_donated_at        = d.last_gift_at
  from donors d
  where d.id = target and c.id = d.contact_id;
  return null;
end;
$$;

create trigger donations_refresh_donor
  after insert or update of amount_cents, status or delete on donations
  for each row execute function refresh_donor_totals();

-- Row-level security ---------------------------------------------------

alter table campaigns enable row level security;
alter table donors enable row level security;
alter table recurring_plans enable row level security;
alter table donations enable row level security;

-- Live campaigns are public: the checkout page reads them without a session.
create policy campaigns_public_read on campaigns for select using (status = 'live' or can_access_account(account_id));
create policy campaigns_agency_write on campaigns for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

create policy donors_read on donors for select using (can_access_account(account_id));
create policy donors_agency_write on donors for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

create policy plans_read on recurring_plans for select using (can_access_account(account_id));
create policy plans_agency_write on recurring_plans for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

create policy donations_read on donations for select using (can_access_account(account_id));
create policy donations_agency_write on donations for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));
