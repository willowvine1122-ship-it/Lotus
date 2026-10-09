-- Funnels and websites: a funnel is an ordered set of steps (pages), each a
-- list of blocks stored as JSON so the editor, preview and public page share
-- one renderer. Submissions create contacts; daily stats feed the board.

create type funnel_status as enum ('draft', 'live');

create table funnels (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  status      funnel_status not null default 'draft',
  template    text not null default 'blank',
  brand_color text,
  domain      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index funnels_account_idx on funnels(account_id);

create table funnel_steps (
  id        uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references funnels(id) on delete cascade,
  name      text not null,
  path      text not null default '',
  position  integer not null,
  blocks    jsonb not null default '[]'::jsonb,
  unique (funnel_id, position),
  unique (funnel_id, path)
);

create table funnel_submissions (
  id         uuid primary key default gen_random_uuid(),
  funnel_id  uuid not null references funnels(id) on delete cascade,
  step_id    uuid not null references funnel_steps(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  values     jsonb not null default '{}'::jsonb,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index funnel_submissions_funnel_idx on funnel_submissions(funnel_id, created_at desc);

create table funnel_daily_stats (
  funnel_id uuid not null references funnels(id) on delete cascade,
  day       date not null,
  visitors  integer not null default 0,
  leads     integer not null default 0,
  primary key (funnel_id, day)
);

-- Row-level security ---------------------------------------------------

alter table funnels enable row level security;
alter table funnel_steps enable row level security;
alter table funnel_submissions enable row level security;
alter table funnel_daily_stats enable row level security;

create policy funnels_read on funnels for select using (can_access_account(account_id));
create policy funnels_agency on funnels for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

create policy steps_read on funnel_steps for select
  using (can_access_account((select account_id from funnels where id = funnel_id)));
create policy steps_agency on funnel_steps for all
  using (is_agency_member((select agency_id from accounts a join funnels f on f.account_id = a.id where f.id = funnel_id)));

create policy submissions_read on funnel_submissions for select
  using (can_access_account((select account_id from funnels where id = funnel_id)));
-- Public pages insert through a service role; no anon write policy here.

create policy stats_read on funnel_daily_stats for select
  using (can_access_account((select account_id from funnels where id = funnel_id)));
