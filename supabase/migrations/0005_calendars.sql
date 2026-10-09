-- Calendars and booking: calendars per client, the appointment types a lead
-- can book, weekly hours and days off, and the appointments themselves.
-- Leads book from a public page without signing in, so anonymous access
-- goes only through two security-definer functions: one returns busy
-- times (no names), the other validates a slot and books it.

create type meeting_location as enum ('phone', 'video', 'in_person');
create type appointment_status as enum ('booked', 'confirmed', 'showed', 'no_show', 'cancelled');
create type appointment_source as enum ('booking_page', 'manual', 'ads');

create table calendars (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts(id) on delete cascade,
  name              text not null,
  slug              text not null unique,
  description       text,
  owner_name        text not null,
  owner_id          uuid references auth.users(id) on delete set null,
  timezone          text not null default 'America/New_York',
  buffer_minutes    integer not null default 15 check (buffer_minutes between 0 and 240),
  min_notice_hours  integer not null default 4 check (min_notice_hours between 0 and 336),
  max_days_ahead    integer not null default 30 check (max_days_ahead between 1 and 365),
  slot_step_minutes integer not null default 30 check (slot_step_minutes in (15, 20, 30, 45, 60)),
  booking_enabled   boolean not null default true,
  created_at        timestamptz not null default now()
);
create index calendars_account_idx on calendars(account_id);

create table appointment_types (
  id               uuid primary key default gen_random_uuid(),
  calendar_id      uuid not null references calendars(id) on delete cascade,
  name             text not null,
  duration_minutes integer not null check (duration_minutes between 10 and 480),
  description      text,
  location         meeting_location not null default 'in_person',
  location_detail  text,
  active           boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now()
);
create index appointment_types_calendar_idx on appointment_types(calendar_id, position);

-- Weekly hours, in minutes from midnight in the calendar's time zone.
-- Several rows per weekday allow split shifts.
create table availability_rules (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references calendars(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute   integer not null check (end_minute between 1 and 1440),
  check (end_minute > start_minute)
);
create index availability_rules_calendar_idx on availability_rules(calendar_id, weekday);

create table calendar_days_off (
  calendar_id uuid not null references calendars(id) on delete cascade,
  day         date not null,
  primary key (calendar_id, day)
);

create table appointments (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  calendar_id uuid not null references calendars(id) on delete cascade,
  type_id     uuid not null references appointment_types(id),
  contact_id  uuid not null references contacts(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      appointment_status not null default 'booked',
  source      appointment_source not null default 'booking_page',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_account_idx on appointments(account_id, starts_at);
create index appointments_calendar_idx on appointments(calendar_id, starts_at);
create index appointments_contact_idx on appointments(contact_id);

-- Row-level security ---------------------------------------------------

alter table calendars          enable row level security;
alter table appointment_types  enable row level security;
alter table availability_rules enable row level security;
alter table calendar_days_off  enable row level security;
alter table appointments       enable row level security;

create policy "calendars: account access"
  on calendars for all using (can_access_account(account_id));
create policy "appointment types: account access"
  on appointment_types for all using (can_access_account((select account_id from calendars where id = calendar_id)));
create policy "availability: account access"
  on availability_rules for all using (can_access_account((select account_id from calendars where id = calendar_id)));
create policy "days off: account access"
  on calendar_days_off for all using (can_access_account((select account_id from calendars where id = calendar_id)));
create policy "appointments: account access"
  on appointments for all using (can_access_account(account_id));

-- The public booking page may read a calendar that is taking bookings and
-- its active types and hours. Nothing about appointments is exposed here.
create policy "calendars: public booking page"
  on calendars for select to anon using (booking_enabled);
create policy "appointment types: public booking page"
  on appointment_types for select to anon
  using (active and exists (select 1 from calendars c where c.id = calendar_id and c.booking_enabled));
create policy "availability: public booking page"
  on availability_rules for select to anon
  using (exists (select 1 from calendars c where c.id = calendar_id and c.booking_enabled));
create policy "days off: public booking page"
  on calendar_days_off for select to anon
  using (exists (select 1 from calendars c where c.id = calendar_id and c.booking_enabled));

-- Public functions -----------------------------------------------------

-- Busy intervals for the booking page: start and end only, never who.
create or replace function calendar_busy_times(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at
  from appointments a
  join calendars c on c.id = a.calendar_id
  where c.slug = p_slug
    and c.booking_enabled
    and a.status <> 'cancelled'
    and a.ends_at > p_from
    and a.starts_at < p_to;
$$;

-- Books a slot. Checks the type is active, the start falls inside the
-- weekly hours on a day that is not off, respects notice, horizon and
-- buffer, and does not overlap another booking; then matches the contact
-- by email within the client or creates one. Locks the calendar row so two
-- leads cannot take the same time.
create or replace function book_appointment(
  p_slug text,
  p_type_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_email text,
  p_phone text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cal        calendars%rowtype;
  t          appointment_types%rowtype;
  local_ts   timestamp;
  local_min  integer;
  v_end      timestamptz;
  v_contact  uuid;
  v_id       uuid;
  v_first    text;
  v_last     text;
begin
  select * into cal from calendars where slug = p_slug and booking_enabled for update;
  if not found then raise exception 'calendar_not_found'; end if;

  select * into t from appointment_types where id = p_type_id and calendar_id = cal.id and active;
  if not found then raise exception 'type_not_found'; end if;

  if coalesce(trim(p_name), '') = '' or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_contact';
  end if;

  v_end := p_starts_at + make_interval(mins => t.duration_minutes);
  local_ts := p_starts_at at time zone cal.timezone;
  local_min := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;

  if p_starts_at < now() + make_interval(hours => cal.min_notice_hours)
     or local_ts::date > (now() at time zone cal.timezone)::date + cal.max_days_ahead
     or exists (select 1 from calendar_days_off d where d.calendar_id = cal.id and d.day = local_ts::date)
     or not exists (
       select 1 from availability_rules r
       where r.calendar_id = cal.id
         and r.weekday = extract(dow from local_ts)
         and local_min >= r.start_minute
         and local_min + t.duration_minutes <= r.end_minute
         and (local_min - r.start_minute) % cal.slot_step_minutes = 0
     )
     or exists (
       select 1 from appointments a
       where a.calendar_id = cal.id and a.status <> 'cancelled'
         and a.starts_at < v_end + make_interval(mins => cal.buffer_minutes)
         and a.ends_at + make_interval(mins => cal.buffer_minutes) > p_starts_at
     )
  then
    raise exception 'slot_unavailable';
  end if;

  select id into v_contact from contacts
  where account_id = cal.account_id and lower(email) = lower(trim(p_email))
  order by created_at limit 1;

  if v_contact is null then
    v_first := split_part(trim(p_name), ' ', 1);
    v_last := nullif(trim(substr(trim(p_name), length(v_first) + 1)), '');
    insert into contacts (account_id, first_name, last_name, email, phone, source)
    values (cal.account_id, v_first, v_last, lower(trim(p_email)), nullif(trim(p_phone), ''), 'booking_page')
    returning id into v_contact;
  elsif nullif(trim(p_phone), '') is not null then
    update contacts set phone = coalesce(phone, trim(p_phone)) where id = v_contact;
  end if;

  insert into appointments (account_id, calendar_id, type_id, contact_id, starts_at, ends_at, status, source, notes)
  values (cal.account_id, cal.id, t.id, v_contact, p_starts_at, v_end, 'booked', 'booking_page', nullif(trim(p_notes), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function calendar_busy_times(text, timestamptz, timestamptz) from public;
revoke all on function book_appointment(text, uuid, timestamptz, text, text, text, text) from public;
grant execute on function calendar_busy_times(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function book_appointment(text, uuid, timestamptz, text, text, text, text) to anon, authenticated;
