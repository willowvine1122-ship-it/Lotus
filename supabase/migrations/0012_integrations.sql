-- Integrations: connected apps per client, incoming webhooks (a secret URL
-- any tool can POST to), outgoing webhooks (signed POSTs from a workflow
-- step), API keys for the REST API, and one log row per event in or out.
-- OAuth tokens live in Supabase Vault; integration_connections only keeps
-- the vault id and the account label shown in the UI.

create type integration_log_kind as enum ('app_event', 'app_action', 'webhook_in', 'webhook_out', 'api');
create type integration_log_status as enum ('ok', 'failed');

alter type workflow_trigger add value if not exists 'webhook_received';
alter type workflow_trigger add value if not exists 'app_event';
alter type workflow_step_type add value if not exists 'send_webhook';
alter type workflow_step_type add value if not exists 'app_action';

create table integration_connections (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  app_id          text not null,
  account_label   text not null,
  token_secret_id uuid,
  connected_by    uuid references auth.users(id) on delete set null,
  connected_at    timestamptz not null default now(),
  unique (account_id, app_id)
);

-- mapping: { firstName, lastName, email, phone, company, city } -> payload
-- key, dots for nested keys. Empty keys fall back to the usual names.
create table incoming_webhooks (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  token       text not null unique,
  mapping     jsonb not null default '{}'::jsonb,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- Each delivery is signed: X-Lotus-Signature: t=<unix>,v1=<hmac-sha256(secret, t.body)>.
create table outgoing_webhooks (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  url         text not null check (url ~ '^https?://'),
  secret      text not null,
  created_at  timestamptz not null default now()
);

-- Only a sha-256 of the key is stored; the key is shown once when made.
create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  label        text not null,
  prefix       text not null,
  hash         text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create table integration_logs (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  kind        integration_log_kind not null,
  ref         text not null,
  title       text not null,
  status      integration_log_status not null,
  detail      text,
  payload     jsonb,
  code        int,
  contact_id  uuid references contacts(id) on delete set null,
  at          timestamptz not null default now()
);
create index integration_logs_account_idx on integration_logs(account_id, at desc);
create index integration_logs_ref_idx on integration_logs(ref, at desc);

alter table integration_connections enable row level security;
alter table incoming_webhooks enable row level security;
alter table outgoing_webhooks enable row level security;
alter table api_keys enable row level security;
alter table integration_logs enable row level security;

create policy integration_connections_rw on integration_connections for all using (can_access_account(account_id));
create policy incoming_webhooks_rw on incoming_webhooks for all using (can_access_account(account_id));
create policy outgoing_webhooks_rw on outgoing_webhooks for all using (can_access_account(account_id));
create policy api_keys_rw on api_keys for all using (can_access_account(account_id));
-- Logs are written by the webhook and API routes (service role); people read them.
create policy integration_logs_read on integration_logs for select using (can_access_account(account_id));
