-- Lotus persistence and accounts.
--
-- The app keeps each agency's data as one JSON document per module
-- (clients, crm, calendars, forms, ...) in lotus.docs, versioned so two
-- people saving at once are merged instead of overwritten. Accounts are
-- relational: users, sessions, agencies, memberships and invites.
--
-- Everything lives in the private "lotus" schema, which the Data API does
-- not expose. The only way in is public.lotus(key, op, args): a security
-- definer function that refuses any call without the server key, whose
-- SHA-256 is stored in lotus.server_keys. The Next.js server holds the key
-- (LOTUS_SERVER_KEY) and does every authorisation check itself, so a
-- browser holding the publishable key can reach nothing.
--
-- The normalised tables in 0001-0018 are the long-term relational design;
-- the app does not read them yet.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists lotus;
revoke all on schema lotus from public;

create table lotus.server_keys (
  hash       text primary key,
  created_at timestamptz not null default now()
);

create table lotus.users (
  id            uuid primary key default gen_random_uuid(),
  email         extensions.citext not null unique,
  name          text not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table lotus.agencies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  settings   jsonb not null default '{}'::jsonb,
  created_by uuid references lotus.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- owner/admin/member are agency staff and see every client. A client login
-- sees only the sub-accounts listed in account_ids.
create table lotus.memberships (
  agency_id   uuid not null references lotus.agencies(id) on delete cascade,
  user_id     uuid not null references lotus.users(id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'member', 'client')),
  account_ids text[] not null default '{}',
  created_at  timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index memberships_user_idx on lotus.memberships(user_id);

create table lotus.sessions (
  token_hash text primary key,
  user_id    uuid not null references lotus.users(id) on delete cascade,
  agency_id  uuid references lotus.agencies(id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on lotus.sessions(user_id);

create table lotus.invites (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  agency_id   uuid not null references lotus.agencies(id) on delete cascade,
  email       extensions.citext not null,
  name        text not null default '',
  role        text not null check (role in ('admin', 'member', 'client')),
  account_ids text[] not null default '{}',
  invited_by  uuid references lotus.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_at timestamptz
);
create index invites_agency_idx on lotus.invites(agency_id);

create table lotus.login_attempts (
  email extensions.citext not null,
  at    timestamptz not null default now()
);
create index login_attempts_idx on lotus.login_attempts(email, at);

create table lotus.docs (
  agency_id  uuid not null references lotus.agencies(id) on delete cascade,
  module     text not null,
  version    integer not null default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (agency_id, module)
);

-- Public addresses (form slugs, booking pages, site hosts, webhook tokens)
-- point at the agency that owns them, so an anonymous request can find its
-- workspace. A key belongs to one agency at a time.
create table lotus.public_keys (
  key       text primary key,
  agency_id uuid not null references lotus.agencies(id) on delete cascade,
  module    text not null
);
create index public_keys_agency_idx on lotus.public_keys(agency_id, module);

create table lotus.files (
  id         text primary key,
  agency_id  uuid not null references lotus.agencies(id) on delete cascade,
  name       text not null,
  type       text not null,
  bytes      bytea not null,
  created_at timestamptz not null default now()
);

alter table lotus.server_keys    enable row level security;
alter table lotus.users          enable row level security;
alter table lotus.agencies       enable row level security;
alter table lotus.memberships    enable row level security;
alter table lotus.sessions       enable row level security;
alter table lotus.invites        enable row level security;
alter table lotus.login_attempts enable row level security;
alter table lotus.docs           enable row level security;
alter table lotus.public_keys    enable row level security;
alter table lotus.files          enable row level security;


-- Workspace documents and public addresses.
create or replace function lotus.ws_op(p_op text, a jsonb)
returns jsonb
language plpgsql
set search_path = lotus, extensions, pg_temp
as $$
declare
  v_agency uuid;
  v_user   uuid;
  v_ver    integer;
  v_out    jsonb;
begin
  case p_op

  when 'ws.versions' then
    select coalesce(jsonb_object_agg(module, version), '{}'::jsonb) into v_out
    from lotus.docs where agency_id = (a->>'agency')::uuid;
    return v_out;

  when 'ws.agencies' then
    -- Agencies that keep a given module, for scheduled jobs that visit each one.
    select coalesce(jsonb_agg(agency_id), '[]'::jsonb) into v_out
    from lotus.docs where module in (select jsonb_array_elements_text(a->'modules'));
    return v_out;

  when 'ws.load' then
    select coalesce(jsonb_agg(jsonb_build_object('module', module, 'version', version, 'data', data)), '[]'::jsonb) into v_out
    from lotus.docs
    where agency_id = (a->>'agency')::uuid
      and module in (select jsonb_array_elements_text(a->'modules'));
    return v_out;

  when 'ws.save' then
    v_agency := (a->>'agency')::uuid;
    v_ver := coalesce((a->>'expected')::integer, 0);
    if v_ver = 0 then
      insert into lotus.docs (agency_id, module, version, data)
      values (v_agency, a->>'module', 1, a->'data')
      on conflict (agency_id, module) do nothing
      returning version into v_ver;
    else
      update lotus.docs set data = a->'data', version = version + 1, updated_at = now()
      where agency_id = v_agency and module = a->>'module' and version = v_ver
      returning version into v_ver;
    end if;
    if v_ver is null then
      select jsonb_build_object('ok', false, 'version', version, 'data', data) into v_out
      from lotus.docs where agency_id = v_agency and module = a->>'module';
      return v_out;
    end if;
    return jsonb_build_object('ok', true, 'version', v_ver);

  when 'keys.taken' then
    select coalesce(jsonb_agg(key), '[]'::jsonb) into v_out
    from lotus.public_keys
    where key in (select jsonb_array_elements_text(a->'keys'))
      and agency_id <> (a->>'agency')::uuid;
    return v_out;

  when 'keys.sync' then
    v_agency := (a->>'agency')::uuid;
    delete from lotus.public_keys
    where agency_id = v_agency and module = a->>'module'
      and key not in (select jsonb_array_elements_text(a->'keys'));
    insert into lotus.public_keys (key, agency_id, module)
    select k, v_agency, a->>'module' from jsonb_array_elements_text(a->'keys') k
    on conflict (key) do nothing;
    return 'true'::jsonb;

  when 'keys.get' then
    select to_jsonb(agency_id) into v_out from lotus.public_keys where key = a->>'key';
    return coalesce(v_out, 'null'::jsonb);

  else
    raise exception 'unknown op %', p_op using errcode = '22023';
  end case;
end;
$$;

-- Users, sign-in throttling and sessions.
create or replace function lotus.auth_op(p_op text, a jsonb)
returns jsonb
language plpgsql
set search_path = lotus, extensions, pg_temp
as $$
declare
  v_agency uuid;
  v_user   uuid;
  v_ver    integer;
  v_out    jsonb;
begin
  case p_op

  when 'user.by_email' then
    select to_jsonb(u) into v_out from lotus.users u where email = (a->>'email')::extensions.citext;
    return coalesce(v_out, 'null'::jsonb);

  when 'user.get' then
    select to_jsonb(u) - 'password_hash' into v_out from lotus.users u where id = (a->>'id')::uuid;
    return coalesce(v_out, 'null'::jsonb);

  when 'user.create' then
    insert into lotus.users (email, name, password_hash)
    values (a->>'email', a->>'name', a->>'password_hash')
    on conflict (email) do nothing
    returning to_jsonb(users) - 'password_hash' into v_out;
    return coalesce(v_out, 'null'::jsonb);

  when 'user.update' then
    update lotus.users set
      name = coalesce(a->>'name', name),
      email = coalesce(a->>'email', email),
      password_hash = coalesce(a->>'password_hash', password_hash),
      last_login_at = case when (a->>'login')::boolean then now() else last_login_at end
    where id = (a->>'id')::uuid
    returning to_jsonb(users) - 'password_hash' into v_out;
    return coalesce(v_out, 'null'::jsonb);

  when 'attempts.count' then
    delete from lotus.login_attempts where at < now() - interval '1 day';
    select to_jsonb(count(*)) into v_out from lotus.login_attempts
    where email = (a->>'email')::extensions.citext and at > now() - make_interval(mins => coalesce((a->>'minutes')::integer, 15));
    return v_out;

  when 'attempts.add' then
    insert into lotus.login_attempts (email) values (a->>'email');
    return 'true'::jsonb;

  when 'attempts.clear' then
    delete from lotus.login_attempts where email = (a->>'email')::extensions.citext;
    return 'true'::jsonb;

  when 'session.create' then
    insert into lotus.sessions (token_hash, user_id, agency_id, expires_at)
    values (a->>'token_hash', (a->>'user_id')::uuid, nullif(a->>'agency_id', '')::uuid, (a->>'expires_at')::timestamptz);
    return 'true'::jsonb;

  when 'session.get' then
    update lotus.sessions set seen_at = now()
    where token_hash = a->>'token_hash' and expires_at > now()
    returning user_id, agency_id into v_user, v_agency;
    if v_user is null then
      return 'null'::jsonb;
    end if;
    select jsonb_build_object(
      'user', (select to_jsonb(u) - 'password_hash' from lotus.users u where u.id = v_user),
      'agency', (select to_jsonb(g) from lotus.agencies g where g.id = v_agency),
      'membership', (select to_jsonb(m) from lotus.memberships m where m.user_id = v_user and m.agency_id = v_agency),
      'agencies', (
        select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'role', m.role) order by g.created_at), '[]'::jsonb)
        from lotus.memberships m join lotus.agencies g on g.id = m.agency_id
        where m.user_id = v_user
      )
    ) into v_out;
    return v_out;

  when 'session.switch' then
    update lotus.sessions s set agency_id = (a->>'agency_id')::uuid
    where s.token_hash = a->>'token_hash'
      and exists (select 1 from lotus.memberships m where m.user_id = s.user_id and m.agency_id = (a->>'agency_id')::uuid);
    return to_jsonb(found);

  when 'session.delete' then
    delete from lotus.sessions where token_hash = a->>'token_hash';
    return 'true'::jsonb;

  when 'session.delete_others' then
    delete from lotus.sessions where user_id = (a->>'user_id')::uuid and token_hash <> coalesce(a->>'keep', '');
    return 'true'::jsonb;

  else
    raise exception 'unknown op %', p_op using errcode = '22023';
  end case;
end;
$$;

-- Agencies, members and invites.
create or replace function lotus.org_op(p_op text, a jsonb)
returns jsonb
language plpgsql
set search_path = lotus, extensions, pg_temp
as $$
declare
  v_agency uuid;
  v_user   uuid;
  v_ver    integer;
  v_out    jsonb;
begin
  case p_op

  when 'agency.create' then
    insert into lotus.agencies (name, settings, created_by)
    values (a->>'name', coalesce(a->'settings', '{}'::jsonb), (a->>'owner_id')::uuid)
    returning id into v_agency;
    insert into lotus.memberships (agency_id, user_id, role) values (v_agency, (a->>'owner_id')::uuid, 'owner');
    select to_jsonb(g) into v_out from lotus.agencies g where g.id = v_agency;
    return v_out;

  when 'agency.update' then
    update lotus.agencies set
      name = coalesce(a->>'name', name),
      settings = case when a ? 'settings' then settings || (a->'settings') else settings end
    where id = (a->>'id')::uuid
    returning to_jsonb(agencies) into v_out;
    return coalesce(v_out, 'null'::jsonb);

  when 'member.list' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', u.id, 'email', u.email, 'name', u.name, 'role', m.role,
      'account_ids', to_jsonb(m.account_ids), 'joined_at', m.created_at, 'last_login_at', u.last_login_at
    ) order by m.created_at), '[]'::jsonb) into v_out
    from lotus.memberships m join lotus.users u on u.id = m.user_id
    where m.agency_id = (a->>'agency')::uuid;
    return v_out;

  when 'member.set' then
    insert into lotus.memberships (agency_id, user_id, role, account_ids)
    values ((a->>'agency')::uuid, (a->>'user_id')::uuid, a->>'role',
            coalesce(array(select jsonb_array_elements_text(a->'account_ids')), '{}'))
    on conflict (agency_id, user_id) do update set role = excluded.role, account_ids = excluded.account_ids;
    return 'true'::jsonb;

  when 'member.remove' then
    delete from lotus.memberships where agency_id = (a->>'agency')::uuid and user_id = (a->>'user_id')::uuid and role <> 'owner';
    delete from lotus.sessions where user_id = (a->>'user_id')::uuid and agency_id = (a->>'agency')::uuid;
    return to_jsonb(found);

  when 'invite.create' then
    insert into lotus.invites (token_hash, agency_id, email, name, role, account_ids, invited_by, expires_at)
    values (a->>'token_hash', (a->>'agency')::uuid, a->>'email', coalesce(a->>'name', ''), a->>'role',
            coalesce(array(select jsonb_array_elements_text(a->'account_ids')), '{}'),
            nullif(a->>'invited_by', '')::uuid, (a->>'expires_at')::timestamptz)
    returning to_jsonb(invites) - 'token_hash' into v_out;
    return v_out;

  when 'invite.list' then
    select coalesce(jsonb_agg(to_jsonb(i) - 'token_hash' order by i.created_at desc), '[]'::jsonb) into v_out
    from lotus.invites i
    where i.agency_id = (a->>'agency')::uuid and i.accepted_at is null and i.expires_at > now();
    return v_out;

  when 'invite.get' then
    select jsonb_build_object('invite', to_jsonb(i) - 'token_hash', 'agency_name', g.name) into v_out
    from lotus.invites i join lotus.agencies g on g.id = i.agency_id
    where i.token_hash = a->>'token_hash' and i.accepted_at is null and i.expires_at > now();
    return coalesce(v_out, 'null'::jsonb);

  when 'invite.revoke' then
    delete from lotus.invites where agency_id = (a->>'agency')::uuid and id = (a->>'id')::uuid;
    return to_jsonb(found);

  when 'invite.accept' then
    update lotus.invites set accepted_at = now()
    where id = (a->>'id')::uuid and accepted_at is null
    returning to_jsonb(invites) - 'token_hash' into v_out;
    if v_out is null then
      return 'null'::jsonb;
    end if;
    insert into lotus.memberships (agency_id, user_id, role, account_ids)
    values ((v_out->>'agency_id')::uuid, (a->>'user_id')::uuid, v_out->>'role',
            coalesce(array(select jsonb_array_elements_text(v_out->'account_ids')), '{}'))
    on conflict (agency_id, user_id) do update set
      role = case when lotus.memberships.role = 'owner' then 'owner' else excluded.role end,
      account_ids = excluded.account_ids;
    return v_out;

  else
    raise exception 'unknown op %', p_op using errcode = '22023';
  end case;
end;
$$;

-- Uploaded files.
create or replace function lotus.file_op(p_op text, a jsonb)
returns jsonb
language plpgsql
set search_path = lotus, extensions, pg_temp
as $$
declare
  v_agency uuid;
  v_user   uuid;
  v_ver    integer;
  v_out    jsonb;
begin
  case p_op

  when 'file.put' then
    insert into lotus.files (id, agency_id, name, type, bytes)
    values (a->>'id', (a->>'agency')::uuid, a->>'name', a->>'type', decode(a->>'base64', 'base64'));
    return 'true'::jsonb;

  when 'file.get' then
    select jsonb_build_object('id', id, 'agency_id', agency_id, 'name', name, 'type', type, 'base64', encode(bytes, 'base64')) into v_out
    from lotus.files where id = a->>'id';
    return coalesce(v_out, 'null'::jsonb);

  when 'file.delete' then
    delete from lotus.files where id = a->>'id' and agency_id = (a->>'agency')::uuid;
    return to_jsonb(found);

  else
    raise exception 'unknown op %', p_op using errcode = '22023';
  end case;
end;
$$;

-- The gate: the only function the Data API can call.
create or replace function public.lotus(p_key text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = lotus, extensions, pg_temp
as $$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
begin
  if p_key is null or not exists (
    select 1 from lotus.server_keys where hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  case split_part(p_op, '.', 1)
    when 'ws', 'keys' then return lotus.ws_op(p_op, a);
    when 'user', 'attempts', 'session' then return lotus.auth_op(p_op, a);
    when 'agency', 'member', 'invite' then return lotus.org_op(p_op, a);
    when 'file' then return lotus.file_op(p_op, a);
    else raise exception 'unknown op %', p_op using errcode = '22023';
  end case;
end;
$$;

revoke all on function lotus.ws_op(text, jsonb), lotus.auth_op(text, jsonb), lotus.org_op(text, jsonb), lotus.file_op(text, jsonb) from public;
revoke all on function public.lotus(text, text, jsonb) from public;
grant execute on function public.lotus(text, text, jsonb) to anon, authenticated, service_role;

-- The server key itself is inserted out of band:
--   insert into lotus.server_keys (hash) values (encode(extensions.digest('<key>', 'sha256'), 'hex'));
