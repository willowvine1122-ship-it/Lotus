-- Email marketing: templates, audiences (segments and fixed lists),
-- campaigns, and one row per email sent with its engagement.
-- Sending goes through Resend; its webhooks fill opened/clicked/bounced.

create type audience_kind as enum ('segment', 'list');
create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent');
create type email_send_status as enum ('queued', 'delivered', 'bounced', 'complained');

-- Templates: agency-wide (account_id null) or saved by one client.
create table email_templates (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies(id) on delete cascade,
  account_id   uuid references accounts(id) on delete cascade,
  name         text not null,
  description  text,
  mode         account_mode,
  subject      text not null default '',
  preview_text text not null default '',
  blocks       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index email_templates_account_idx on email_templates(agency_id, account_id);

-- filter: { tags: text[], stageIds: uuid[], sources: contact_source[], addedWithinDays: int }
create table email_audiences (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name       text not null,
  kind       audience_kind not null default 'segment',
  filter     jsonb not null default '{"tags":[],"stageIds":[],"sources":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_audiences_account_idx on email_audiences(account_id);

-- Members of a fixed list. Segments are evaluated from their filter at send time.
create table email_audience_members (
  audience_id uuid not null references email_audiences(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (audience_id, contact_id)
);

create table email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  name          text not null,
  subject       text not null default '',
  preview_text  text not null default '',
  from_name     text not null,
  from_email    text not null,
  audience_id   uuid references email_audiences(id) on delete set null,
  template_id   uuid references email_templates(id) on delete set null,
  blocks        jsonb not null default '[]'::jsonb,
  status        campaign_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at       timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_for is not null)
);
create index email_campaigns_account_idx on email_campaigns(account_id, created_at desc);
-- The scheduler picks up due campaigns from here.
create index email_campaigns_due_idx on email_campaigns(scheduled_for) where status = 'scheduled';

create table email_sends (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  campaign_id         uuid not null references email_campaigns(id) on delete cascade,
  contact_id          uuid references contacts(id) on delete set null,
  email               text not null,
  provider_message_id text,
  status              email_send_status not null default 'queued',
  sent_at             timestamptz not null default now(),
  opened_at           timestamptz,
  clicked_at          timestamptz,
  clicked_url         text,
  unsubscribed_at     timestamptz,
  bounced_at          timestamptz,
  unique (campaign_id, contact_id)
);
create index email_sends_campaign_idx on email_sends(campaign_id);
create index email_sends_contact_idx on email_sends(contact_id, sent_at desc);
create unique index email_sends_provider_idx on email_sends(provider_message_id) where provider_message_id is not null;

-- An unsubscribe sets the contact's do-not-email flag, so every later
-- campaign (and the inbox) respects it without a second lookup.
create or replace function email_unsubscribe_contact() returns trigger language plpgsql as $$
begin
  if new.unsubscribed_at is not null and old.unsubscribed_at is null and new.contact_id is not null then
    update contacts set dnd_email = true where id = new.contact_id;
  end if;
  return new;
end;
$$;
create trigger email_sends_unsubscribe after update of unsubscribed_at on email_sends
  for each row execute function email_unsubscribe_contact();

-- Row-level security ---------------------------------------------------

alter table email_templates enable row level security;
alter table email_audiences enable row level security;
alter table email_audience_members enable row level security;
alter table email_campaigns enable row level security;
alter table email_sends enable row level security;

create policy email_templates_read on email_templates for select
  using (is_agency_member(agency_id) or (account_id is not null and can_access_account(account_id)));
create policy email_templates_agency on email_templates for all using (is_agency_member(agency_id));

create policy email_audiences_rw on email_audiences for all using (can_access_account(account_id));
create policy email_audience_members_rw on email_audience_members for all
  using (can_access_account((select account_id from email_audiences where id = audience_id)));
create policy email_campaigns_rw on email_campaigns for all using (can_access_account(account_id));
-- Sends are written by the sender and webhooks (service role); people only read them.
create policy email_sends_read on email_sends for select using (can_access_account(account_id));
