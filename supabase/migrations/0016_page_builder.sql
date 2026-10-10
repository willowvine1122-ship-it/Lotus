-- Page builder: funnel steps and website pages become a tree of sections,
-- rows, columns and elements (with phone overrides) stored as one jsonb doc,
-- so the editor, preview and public page share one renderer. The old
-- `blocks` column stays for pages nobody has opened in the builder yet.
-- Adds split tests per step, per-step and per-version stats, and orders
-- taken by order forms and one-click upsells (Stripe test mode until keys).

create type funnel_step_kind as enum ('optin', 'sales', 'order', 'upsell', 'downsell', 'thankyou', 'webinar', 'application', 'custom');

-- theme: { primary, ink, muted, background, headingFont, bodyFont, radius, buttonRadius }.
alter table funnels add column theme jsonb;
alter table websites add column theme jsonb;

-- doc: { v: 1, sections[{ id, style, mobile, rows[{ columns[{ span, elements[] }] }] }], popup? }.
alter table funnel_steps add column kind funnel_step_kind not null default 'custom';
alter table funnel_steps add column doc jsonb;
-- variant: { doc, split (5-95, percent of new visitors who see B), startedAt }.
alter table funnel_steps add column variant jsonb;

-- Website pages live inside websites.definition (pages[].doc), so no column there.

-- Views and conversions per step, per version, per day. Written by the public
-- route (service role); the overview reads them.
create table funnel_step_stats (
  step_id      uuid not null references funnel_steps(id) on delete cascade,
  version      char(1) not null default 'a' check (version in ('a', 'b')),
  day          date not null,
  views        integer not null default 0,
  conversions  integer not null default 0,
  revenue_cents bigint not null default 0,
  primary key (step_id, version, day)
);

create table funnel_orders (
  id           uuid primary key default gen_random_uuid(),
  funnel_id    uuid not null references funnels(id) on delete cascade,
  step_id      uuid not null references funnel_steps(id) on delete cascade,
  contact_id   uuid references contacts(id) on delete set null,
  name         text not null,
  email        text not null,
  -- items: [{ name, priceCents, kind: main | bump | upsell }]; upsells append to the same order.
  items        jsonb not null default '[]'::jsonb,
  total_cents  bigint not null default 0 check (total_cents >= 0),
  stripe_payment_intent text,
  test_mode    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index funnel_orders_funnel_idx on funnel_orders(funnel_id, created_at desc);

-- Row-level security ---------------------------------------------------

alter table funnel_step_stats enable row level security;
alter table funnel_orders enable row level security;

create policy step_stats_read on funnel_step_stats for select
  using (can_access_account((select f.account_id from funnels f join funnel_steps s on s.funnel_id = f.id where s.id = step_id)));

create policy orders_read on funnel_orders for select
  using (can_access_account((select account_id from funnels where id = funnel_id)));
-- Orders are written by the public checkout (service role); no anon write policy here.
