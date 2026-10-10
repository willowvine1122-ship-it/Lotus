-- Forms: Typeform-style forms per client (questions, jumps, closing screens
-- and theme kept as one jsonb definition, versioned by updated_at), the
-- responses, the visits that show drop-off, and uploaded files (stored in a
-- private Supabase Storage bucket; form_files keeps the path).

create type form_status as enum ('draft', 'live', 'closed');

-- definition: { welcome, questions[], endings[], hiddenFields[], theme, scoring, tags[] }.
create table forms (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  status      form_status not null default 'draft',
  definition  jsonb not null,
  notify      text,
  template    text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index forms_account_idx on forms(account_id, status);

-- answers: { questionId: string | string[] }; hidden: { utm_source: … }.
create table form_responses (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references forms(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  answers       jsonb not null,
  hidden        jsonb not null default '{}'::jsonb,
  score         int,
  ending_id     text,
  started_at    timestamptz not null,
  submitted_at  timestamptz not null default now()
);
create index form_responses_form_idx on form_responses(form_id, submitted_at desc);
create index form_responses_contact_idx on form_responses(contact_id);

create table form_visits (
  id                uuid primary key default gen_random_uuid(),
  form_id           uuid not null references forms(id) on delete cascade,
  at                timestamptz not null default now(),
  last_question_id  text,
  completed         boolean not null default false
);
create index form_visits_form_idx on form_visits(form_id, at desc);

create table form_files (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references forms(id) on delete cascade,
  response_id   uuid references form_responses(id) on delete cascade,
  question_id   text not null,
  name          text not null,
  content_type  text not null,
  size_bytes    int not null check (size_bytes between 1 and 10485760),
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

alter table forms enable row level security;
alter table form_responses enable row level security;
alter table form_visits enable row level security;
alter table form_files enable row level security;

create policy forms_rw on forms for all using (can_access_account(account_id));
-- Responses, visits and files are written by the public form route (service role); people read and delete them.
create policy form_responses_read on form_responses for select using (can_access_account(account_id));
create policy form_responses_delete on form_responses for delete using (can_access_account(account_id));
create policy form_visits_read on form_visits for select
  using (can_access_account((select account_id from forms where id = form_id)));
create policy form_files_read on form_files for select
  using (can_access_account((select account_id from forms where id = form_id)));
