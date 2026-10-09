-- CRM: pipelines and stages per client, the fields the contact page shows,
-- and the activity trail (calls, texts, emails, bookings, gifts, notes).

create type contact_source as enum ('meta', 'google', 'website', 'referral', 'donation-page', 'import', 'manual');
create type stage_outcome as enum ('won', 'lost');
create type activity_kind as enum ('call', 'sms', 'email', 'form', 'appointment', 'donation', 'note', 'stage', 'task');

create table pipelines (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name        text not null,
  position    integer not null,
  outcome     stage_outcome,
  unique (pipeline_id, position)
);

alter table contacts
  add column company          text,
  add column city             text,
  add column source_kind      contact_source not null default 'manual',
  add column stage_id         uuid references pipeline_stages(id) on delete set null,
  add column owner_id         uuid references auth.users(id) on delete set null,
  add column value_cents      bigint not null default 0,
  add column recurring        boolean not null default false,
  add column dnd_email        boolean not null default false,
  add column dnd_sms          boolean not null default false,
  add column dnd_call         boolean not null default false,
  add column custom_fields    jsonb not null default '{}'::jsonb,
  add column last_activity_at timestamptz not null default now();
create index contacts_stage_idx on contacts(account_id, stage_id);
create index contacts_activity_idx on contacts(account_id, last_activity_at desc);

create table contact_activities (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  kind         activity_kind not null,
  title        text not null,
  body         text,
  actor_id     uuid references auth.users(id) on delete set null,
  amount_cents bigint,
  metadata     jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);
create index contact_activities_contact_idx on contact_activities(contact_id, occurred_at desc);

-- Keep last_activity_at and lifetime value in step with the trail.
create or replace function touch_contact_activity() returns trigger language plpgsql as $$
begin
  update contacts
     set last_activity_at = greatest(last_activity_at, new.occurred_at),
         value_cents = case when new.kind = 'donation' and new.amount_cents is not null then value_cents + new.amount_cents else value_cents end
   where id = new.contact_id;
  return new;
end;
$$;
create trigger contact_activities_touch after insert on contact_activities
  for each row execute function touch_contact_activity();

-- Row-level security ---------------------------------------------------

alter table pipelines enable row level security;
alter table pipeline_stages enable row level security;
alter table contact_activities enable row level security;

create policy pipelines_read on pipelines for select using (can_access_account(account_id));
create policy pipelines_agency on pipelines for all
  using (is_agency_member((select agency_id from accounts where id = account_id)));

create policy stages_read on pipeline_stages for select
  using (can_access_account((select account_id from pipelines where id = pipeline_id)));
create policy stages_agency on pipeline_stages for all
  using (is_agency_member((select agency_id from accounts a join pipelines p on p.account_id = a.id where p.id = pipeline_id)));

create policy activities_read on contact_activities for select using (can_access_account(account_id));
create policy activities_write on contact_activities for all using (can_access_account(account_id));
