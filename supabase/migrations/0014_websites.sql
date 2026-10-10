-- Websites: multi-page sites per client. The header, footer, SEO and pages
-- (each page's blocks are the funnel blocks plus an embedded Lotus form) are
-- one jsonb definition, versioned by updated_at. Custom domains get their own
-- table so the host lookup on every public request is one indexed read.
-- Traffic is counted per page per day by the public route (service role).

create type website_status as enum ('draft', 'live');
create type domain_status as enum ('pending', 'connected', 'failed');

-- definition: { brandColor, logoText, header{}, footer{}, seo{}, analytics{}, pages[{ id, title, path, inNav, seo{}, blocks[] }] }.
create table websites (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  status      website_status not null default 'draft',
  template    text,
  definition  jsonb not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index websites_account_idx on websites(account_id, status);

create table website_domains (
  website_id  uuid primary key references websites(id) on delete cascade,
  host        text not null unique check (host ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  status      domain_status not null default 'pending',
  found       text,
  checked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table website_traffic (
  website_id  uuid not null references websites(id) on delete cascade,
  page_id     text not null,
  day         date not null,
  views       int not null default 0,
  leads       int not null default 0,
  primary key (website_id, page_id, day)
);

alter table websites enable row level security;
alter table website_domains enable row level security;
alter table website_traffic enable row level security;

create policy websites_rw on websites for all using (can_access_account(account_id));
create policy website_domains_rw on website_domains for all
  using (can_access_account((select account_id from websites where id = website_id)));
-- Traffic is written by the public route (service role); people read it.
create policy website_traffic_read on website_traffic for select
  using (can_access_account((select account_id from websites where id = website_id)));
