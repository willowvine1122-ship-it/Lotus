-- Automations: workflows (a trigger and an ordered tree of steps), and one
-- run per contact per time through a workflow, with what happened at each
-- step. Execution moves to a durable queue (Inngest); a run waiting on a
-- "wait" step is picked up again at resume_at.

create type workflow_status as enum ('draft', 'active', 'paused');
create type workflow_trigger as enum (
  'contact_created', 'form_submitted', 'tag_added', 'stage_changed',
  'appointment_booked', 'appointment_no_show', 'donation_received',
  'message_received', 'email_opened', 'email_clicked'
);
create type workflow_step_type as enum (
  'send_sms', 'send_email', 'add_tag', 'remove_tag', 'move_stage',
  'assign_owner', 'create_task', 'notify', 'wait', 'branch'
);
create type workflow_lane as enum ('main', 'yes', 'no');
create type workflow_run_status as enum ('waiting', 'completed', 'failed', 'stopped');
create type workflow_run_step_status as enum ('done', 'skipped', 'failed', 'waiting');

-- trigger_filter narrows the trigger: { tag, stageId, source, channel, minAmountCents }.
create table workflows (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  name           text not null,
  status         workflow_status not null default 'draft',
  trigger_type   workflow_trigger not null,
  trigger_filter jsonb not null default '{}'::jsonb,
  allow_reentry  boolean not null default false,
  template_id    text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index workflows_account_idx on workflows(account_id, status);
-- The engine looks up active workflows by trigger on every event.
create index workflows_trigger_idx on workflows(account_id, trigger_type) where status = 'active';

-- Steps form a tree: top-level steps have no parent; an if/else step owns
-- two lanes of children. config holds the type's fields, e.g.
-- send_sms { body }, wait { amount, unit }, branch { condition: { field, op, value } }.
create table workflow_steps (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  parent_id   uuid references workflow_steps(id) on delete cascade,
  lane        workflow_lane not null default 'main',
  position    int not null,
  type        workflow_step_type not null,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (workflow_id, parent_id, lane, position) deferrable initially deferred,
  check ((parent_id is null) = (lane = 'main'))
);
create index workflow_steps_workflow_idx on workflow_steps(workflow_id);

create table workflow_runs (
  id            uuid primary key default gen_random_uuid(),
  workflow_id   uuid not null references workflows(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  status        workflow_run_status not null default 'completed',
  triggered_by  text not null,
  is_test       boolean not null default false,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  resume_at     timestamptz,
  -- Steps still to run, in order; a branch replaces itself with its chosen lane.
  pending_steps uuid[] not null default '{}',
  check ((status = 'waiting') = (resume_at is not null))
);
create index workflow_runs_workflow_idx on workflow_runs(workflow_id, started_at desc);
create index workflow_runs_contact_idx on workflow_runs(contact_id);
create index workflow_runs_due_idx on workflow_runs(resume_at) where status = 'waiting';

-- What happened at each step, in words: "Skipped: no phone number".
create table workflow_run_steps (
  id      uuid primary key default gen_random_uuid(),
  run_id  uuid not null references workflow_runs(id) on delete cascade,
  step_id uuid references workflow_steps(id) on delete set null,
  type    workflow_step_type not null,
  status  workflow_run_step_status not null,
  detail  text not null,
  at      timestamptz not null default now()
);
create index workflow_run_steps_run_idx on workflow_run_steps(run_id, at);
create index workflow_run_steps_step_idx on workflow_run_steps(step_id, status);

-- Row-level security ---------------------------------------------------

alter table workflows enable row level security;
alter table workflow_steps enable row level security;
alter table workflow_runs enable row level security;
alter table workflow_run_steps enable row level security;

create policy workflows_rw on workflows for all using (can_access_account(account_id));
create policy workflow_steps_rw on workflow_steps for all
  using (can_access_account((select account_id from workflows where id = workflow_id)));
-- Runs are written by the engine (service role); people read them and may stop one.
create policy workflow_runs_read on workflow_runs for select using (can_access_account(account_id));
create policy workflow_runs_stop on workflow_runs for update using (can_access_account(account_id));
create policy workflow_run_steps_read on workflow_run_steps for select
  using (can_access_account((select account_id from workflow_runs where id = run_id)));
