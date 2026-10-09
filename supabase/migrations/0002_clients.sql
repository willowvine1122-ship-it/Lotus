-- Clients and sub-accounts: the fields the agency fills in when it opens a
-- client, the daily metric rows the Daily Diagnostic reads, profiles for
-- display names, and invites for client logins that have not signed up yet.

create type account_status as enum ('onboarding', 'active', 'paused');

alter table accounts
  add column status              account_status not null default 'onboarding',
  add column industry            text,
  add column website             text,
  add column location            text,
  add column tags                text[] not null default '{}',
  add column monthly_budget_cents bigint,
  add column monthly_goal_cents   bigint,
  add column avg_job_value_cents  bigint,
  add column started_on          date not null default current_date;

-- Display names and avatar tones for everyone who appears in the UI.
create table profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  initials   text not null,
  tone       text not null default 'ink',
  created_at timestamptz not null default now()
);

-- Which agency members look after which client.
create table account_assignees (
  account_id uuid not null references accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  primary key (account_id, user_id)
);

-- One row per client per day; the Daily Diagnostic sums these over a range.
create table daily_metrics (
  account_id    uuid not null references accounts(id) on delete cascade,
  day           date not null,
  spend_cents   bigint not null default 0,
  leads         integer not null default 0,
  appointments  integer not null default 0,
  showed        integer not null default 0,
  closed        integer not null default 0,
  raised_cents  bigint not null default 0,
  donations     integer not null default 0,
  new_donors    integer not null default 0,
  new_recurring integer not null default 0,
  source        text not null default 'manual',
  primary key (account_id, day)
);

-- Client logins invited by the agency; a row becomes an account_members row
-- when the person accepts.
create table account_invites (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        member_role not null default 'client',
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by  uuid references auth.users(id),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (account_id, email)
);

-- Row-level security ---------------------------------------------------

alter table profiles enable row level security;
alter table account_assignees enable row level security;
alter table daily_metrics enable row level security;
alter table account_invites enable row level security;

create policy profiles_read on profiles for select using (true);
create policy profiles_self on profiles for all using (user_id = auth.uid());

create policy assignees_read on account_assignees for select using (can_access_account(account_id));
create policy assignees_agency on account_assignees for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

create policy metrics_read on daily_metrics for select using (can_access_account(account_id));
create policy metrics_agency on daily_metrics for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

-- Only the agency sees and manages invites; clients never see each other's.
create policy invites_agency on account_invites for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));
