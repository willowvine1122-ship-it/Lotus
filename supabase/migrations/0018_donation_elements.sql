-- Donation elements: Fundraise Up style embeddable pieces (donate buttons,
-- image cards, goal meters, levels, the embedded form, recent gifts, bars,
-- popups, social proof). One row per element; every placement on every
-- site reads the same row, so an edit reaches them all. Placements report
-- views and checkout opens per day, and a gift made through an element is
-- credited to it on the donation itself.

create type donation_element_type as enum (
  'donate_button', 'button_group', 'image_card', 'sticky_button',
  'goal_meter', 'stat_counter',
  'donation_form', 'donation_levels', 'impact_slider',
  'recent_donations',
  'message_bar', 'popup', 'social_proof'
);
create type donation_element_status as enum ('live', 'paused');

create table donation_elements (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  type         donation_element_type not null,
  name         text not null,
  status       donation_element_status not null default 'live',
  -- Words, gift, levels, look and overlay rules; shape in src/lib/types.ts (DonationElementConfig).
  config       jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index donation_elements_account_idx on donation_elements(account_id, status);
create index donation_elements_campaign_idx on donation_elements(campaign_id);

-- Daily counters written by the public element route (service role).
create table donation_element_days (
  element_id  uuid not null references donation_elements(id) on delete cascade,
  day         date not null,
  views       integer not null default 0,
  opens       integer not null default 0,
  primary key (element_id, day)
);

-- Which element a gift came through. Gifts and amounts are read from donations.
alter table donations add column element_id uuid references donation_elements(id) on delete set null;
create index donations_element_idx on donations(element_id, created_at desc) where element_id is not null;

alter table donation_elements enable row level security;
alter table donation_element_days enable row level security;

create policy donation_elements_rw on donation_elements for all using (can_access_account(account_id));
create policy donation_element_days_read on donation_element_days for select
  using (can_access_account((select account_id from donation_elements where id = element_id)));
