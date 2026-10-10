-- Lotus foundation: agencies, client sub-accounts, memberships, contacts,
-- daily diagnostics, notes and tasks. Every table that belongs to a client
-- carries account_id and is protected by row-level security so a user only
-- ever sees the accounts they are a member of.

create extension if not exists "pgcrypto";

-- Enums -----------------------------------------------------------------

create type account_mode as enum ('marketing', 'fundraising');
create type member_role as enum ('owner', 'admin', 'member', 'client');
create type health_status as enum ('green', 'amber', 'red');
create type task_status as enum ('todo', 'in_progress', 'done');

-- Agencies and sub-accounts --------------------------------------------

create table agencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  brand_color text default '#7c3aed',
  created_at  timestamptz not null default now()
);

create table accounts (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references agencies(id) on delete cascade,
  name        text not null,
  slug        text not null,
  mode        account_mode not null default 'marketing',
  logo_url    text,
  brand_color text,
  timezone    text not null default 'America/New_York',
  created_at  timestamptz not null default now(),
  unique (agency_id, slug)
);

-- Who can see what. Agency members get every account under the agency;
-- client members get only the accounts they are attached to.
create table agency_members (
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      member_role not null default 'member',
  primary key (agency_id, user_id)
);

create table account_members (
  account_id uuid not null references accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'client',
  primary key (account_id, user_id)
);

-- Shared CRM core ------------------------------------------------------

create table contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  first_name  text,
  last_name   text,
  email       text,
  phone       text,
  tags        text[] not null default '{}',
  source      text,
  -- Fundraising mode fields; null for marketing accounts.
  lifetime_donated_cents bigint not null default 0,
  last_donated_at        timestamptz,
  created_at  timestamptz not null default now()
);
create index contacts_account_idx on contacts(account_id);
create index contacts_email_idx on contacts(account_id, email);

-- Daily Diagnostic ------------------------------------------------------
-- One row per account per day. Metrics is a JSON blob whose shape depends
-- on the account mode (see src/lib/types.ts). Summary is the AI paragraph.

create table daily_diagnostics (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  day         date not null,
  health      health_status not null default 'green',
  metrics     jsonb not null default '{}'::jsonb,
  alerts      text[] not null default '{}',
  summary     text,
  created_at  timestamptz not null default now(),
  unique (account_id, day)
);

create table diagnostic_notes (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  diagnostic_id uuid references daily_diagnostics(id) on delete set null,
  author_id     uuid not null references auth.users(id),
  body          text not null,
  mentions      uuid[] not null default '{}',
  seen_by       uuid[] not null default '{}',
  internal_only boolean not null default true,
  created_at    timestamptz not null default now()
);
create index diagnostic_notes_account_idx on diagnostic_notes(account_id, created_at desc);

-- Client project management --------------------------------------------

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  title       text not null,
  status      task_status not null default 'todo',
  assignee_id uuid references auth.users(id),
  due_on      date,
  created_at  timestamptz not null default now()
);
create index tasks_account_idx on tasks(account_id, status);

-- Row-level security ---------------------------------------------------

create or replace function can_access_account(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a
    join agency_members am on am.agency_id = a.agency_id
    where a.id = target and am.user_id = auth.uid()
  ) or exists (
    select 1 from account_members m
    where m.account_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function is_agency_member(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from agency_members am
    where am.agency_id = target and am.user_id = auth.uid()
  );
$$;

alter table agencies          enable row level security;
alter table accounts          enable row level security;
alter table agency_members    enable row level security;
alter table account_members   enable row level security;
alter table contacts          enable row level security;
alter table daily_diagnostics enable row level security;
alter table diagnostic_notes  enable row level security;
alter table tasks             enable row level security;

create policy "agency members see their agency"
  on agencies for select using (is_agency_member(id));

create policy "members see accounts they can access"
  on accounts for select using (can_access_account(id));
create policy "agency members manage accounts"
  on accounts for all using (is_agency_member(agency_id));

create policy "agency members see membership"
  on agency_members for select using (is_agency_member(agency_id));
create policy "account members see membership"
  on account_members for select using (can_access_account(account_id));

create policy "account access: contacts"
  on contacts for all using (can_access_account(account_id));
create policy "account access: diagnostics"
  on daily_diagnostics for all using (can_access_account(account_id));
create policy "account access: tasks"
  on tasks for all using (can_access_account(account_id));

-- Internal notes are hidden from client-role members.
create policy "notes: agency sees all, clients see shared"
  on diagnostic_notes for select using (
    can_access_account(account_id)
    and (not internal_only or is_agency_member((select agency_id from accounts where id = account_id)))
  );
create policy "notes: agency writes"
  on diagnostic_notes for insert with check (
    is_agency_member((select agency_id from accounts where id = account_id))
  );
