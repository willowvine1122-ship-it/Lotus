-- CRM opportunities: several pipelines per client, deals that belong to a
-- contact, a status apart from the stage (won, lost, abandoned), lost
-- reasons, win probabilities per stage, and a stage history for
-- time-in-stage and conversion reporting.

create type opportunity_status as enum ('open', 'won', 'lost', 'abandoned');
create type opportunity_event_kind as enum ('created', 'stage', 'status', 'value', 'owner', 'note');

alter table pipelines
  add column is_primary boolean not null default false,
  add column position   integer not null default 0,
  add column stale_days integer not null default 14 check (stale_days between 1 and 365);
-- One primary pipeline per client: the one a contact's stage lives in.
create unique index pipelines_one_primary on pipelines(account_id) where is_primary;

alter table pipeline_stages
  add column probability smallint not null default 0 check (probability between 0 and 100);

create table opportunities (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete cascade,
  pipeline_id      uuid not null references pipelines(id) on delete cascade,
  stage_id         uuid not null references pipeline_stages(id) on delete restrict,
  contact_id       uuid not null references contacts(id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 120),
  value_cents      bigint not null default 0 check (value_cents >= 0),
  status           opportunity_status not null default 'open',
  owner_id         uuid references auth.users(id) on delete set null,
  source           contact_source not null default 'manual',
  tags             text[] not null default '{}',
  lost_reason      text,
  close_on         date,
  stage_entered_at timestamptz not null default now(),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'lost' or lost_reason is not null)
);
create index opportunities_board_idx on opportunities(pipeline_id, stage_id, status);
create index opportunities_contact_idx on opportunities(contact_id);
create index opportunities_account_idx on opportunities(account_id, updated_at desc);

create table opportunity_events (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  kind           opportunity_event_kind not null,
  label          text not null,
  stage_id       uuid references pipeline_stages(id) on delete set null,
  body           text,
  actor_id       uuid references auth.users(id) on delete set null,
  occurred_at    timestamptz not null default now()
);
create index opportunity_events_opp_idx on opportunity_events(opportunity_id, occurred_at);

create table lost_reasons (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 40),
  position   integer not null default 0,
  unique (account_id, label)
);

-- Stage moves keep stage_entered_at and the history honest, whoever writes them.
create or replace function track_opportunity_stage() returns trigger language plpgsql as $$
begin
  if new.stage_id is distinct from old.stage_id then
    new.stage_entered_at := now();
    insert into opportunity_events (opportunity_id, kind, label, stage_id)
      values (new.id, 'stage', 'Moved to ' || (select name from pipeline_stages where id = new.stage_id), new.stage_id);
  end if;
  if new.status is distinct from old.status then
    new.closed_at := case when new.status in ('won', 'lost') then now() else null end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger opportunities_stage before update on opportunities
  for each row execute function track_opportunity_stage();

-- Row-level security ---------------------------------------------------

alter table opportunities enable row level security;
alter table opportunity_events enable row level security;
alter table lost_reasons enable row level security;

create policy opportunities_rw on opportunities for all using (can_access_account(account_id));
create policy opportunity_events_rw on opportunity_events for all
  using (can_access_account((select account_id from opportunities where id = opportunity_id)));
create policy lost_reasons_read on lost_reasons for select using (can_access_account(account_id));
create policy lost_reasons_agency on lost_reasons for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));
