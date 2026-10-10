-- Reputation: reviews pulled from Google and Facebook, the requests that
-- asked for them, and per-client request settings. Reporting: the weekly
-- client report each sub-account receives and the record of every send.

create type review_source as enum ('google', 'facebook');
create type review_request_channel as enum ('sms', 'email');
create type review_request_trigger as enum ('job', 'appointment', 'donation', 'manual');
create type review_request_status as enum ('sent', 'opened', 'reviewed');

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  source      review_source not null,
  external_id text,
  rating      smallint not null check (rating between 1 and 5),
  author      text not null,
  body        text not null default '',
  contact_id  uuid references contacts(id) on delete set null,
  reply_body  text,
  reply_by    uuid references auth.users(id) on delete set null,
  replied_at  timestamptz,
  reviewed_at timestamptz not null default now(),
  unique (account_id, source, external_id)
);
create index reviews_account_idx on reviews(account_id, reviewed_at desc);

create table review_requests (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  channel     review_request_channel not null,
  trigger     review_request_trigger not null default 'manual',
  status      review_request_status not null default 'sent',
  review_id   uuid references reviews(id) on delete set null,
  sent_at     timestamptz not null default now(),
  opened_at   timestamptz
);
create index review_requests_account_idx on review_requests(account_id, sent_at desc);

create table reputation_settings (
  account_id        uuid primary key references accounts(id) on delete cascade,
  auto_after_job    boolean not null default true,
  auto_after_appt   boolean not null default false,
  auto_after_gift   boolean not null default true,
  channel           review_request_channel not null default 'sms',
  delay_hours       integer not null default 2,
  google_url        text,
  facebook_url      text,
  message           text not null default 'Hi {first}, thanks for choosing {client}. Would you leave us a quick review? It takes a minute and helps a lot.'
);

create table report_configs (
  account_id  uuid primary key references accounts(id) on delete cascade,
  enabled     boolean not null default true,
  range_days  integer not null default 30 check (range_days in (7, 30, 90)),
  sections    text[] not null default array['summary', 'performance', 'volume', 'months', 'note'],
  recipients  text[] not null default '{}',
  weekday     smallint not null default 1 check (weekday between 0 and 6),
  hour        smallint not null default 8 check (hour between 0 and 23),
  note        text
);

create table report_sends (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  recipients  text[] not null,
  range_days  integer not null,
  kind        text not null check (kind in ('schedule', 'manual'))
);
create index report_sends_account_idx on report_sends(account_id, sent_at desc);

alter table reviews enable row level security;
alter table review_requests enable row level security;
alter table reputation_settings enable row level security;
alter table report_configs enable row level security;
alter table report_sends enable row level security;

create policy "members read reviews" on reviews for select using (can_access_account(account_id));
create policy "members write reviews" on reviews for all using (can_access_account(account_id));
create policy "members read review_requests" on review_requests for select using (can_access_account(account_id));
create policy "members write review_requests" on review_requests for all using (can_access_account(account_id));
create policy "members read reputation_settings" on reputation_settings for select using (can_access_account(account_id));
create policy "members write reputation_settings" on reputation_settings for all using (can_access_account(account_id));
create policy "members read report_configs" on report_configs for select using (can_access_account(account_id));
create policy "members write report_configs" on report_configs for all using (can_access_account(account_id));
create policy "members read report_sends" on report_sends for select using (can_access_account(account_id));
create policy "members write report_sends" on report_sends for all using (can_access_account(account_id));
