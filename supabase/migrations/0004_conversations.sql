-- Inbox: one conversation per contact per client, holding every message
-- with that contact across SMS, email, WhatsApp and Facebook, plus internal
-- notes the agency leaves on the thread. Provider ids (Twilio SID, Resend
-- id, Meta message id) are kept on the message so webhooks can update
-- delivery status.

create type conversation_channel as enum ('sms', 'email', 'whatsapp', 'facebook');
create type conversation_status as enum ('open', 'closed');
create type message_direction as enum ('inbound', 'outbound');
create type message_kind as enum ('message', 'note');
create type message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');

alter table contacts
  add column if not exists facebook_id text;

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  assignee_id     uuid references auth.users(id) on delete set null,
  status          conversation_status not null default 'open',
  unread_count    integer not null default 0,
  last_message_at timestamptz,
  last_channel    conversation_channel,
  last_preview    text,
  created_at      timestamptz not null default now(),
  unique (account_id, contact_id)
);
create index conversations_inbox_idx on conversations(account_id, status, last_message_at desc);
create index conversations_assignee_idx on conversations(assignee_id, status, last_message_at desc);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  -- Denormalised from the conversation so row-level security is one lookup.
  account_id      uuid not null references accounts(id) on delete cascade,
  channel         conversation_channel not null,
  direction       message_direction not null,
  kind            message_kind not null default 'message',
  subject         text,
  body            text not null,
  author_id       uuid references auth.users(id),
  status          message_status,
  provider_id     text,
  error           text,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  -- Notes are internal and outbound-only by definition.
  check (kind = 'message' or direction = 'outbound')
);
create index messages_conversation_idx on messages(conversation_id, sent_at);
create unique index messages_provider_idx on messages(channel, provider_id) where provider_id is not null;

-- Keep the conversation row current so the inbox list is one query.
create or replace function touch_conversation()
returns trigger language plpgsql as $$
begin
  if new.kind = 'note' then
    return new;
  end if;
  update conversations set
    last_message_at = greatest(coalesce(last_message_at, new.sent_at), new.sent_at),
    last_channel    = new.channel,
    last_preview    = left(coalesce(new.subject || ': ', '') || new.body, 160),
    unread_count    = case when new.direction = 'inbound' then unread_count + 1 else unread_count end,
    -- A new inbound message reopens a closed conversation.
    status          = case when new.direction = 'inbound' then 'open' else status end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on messages
  for each row execute function touch_conversation();

-- Row-level security ---------------------------------------------------

alter table conversations enable row level security;
alter table messages enable row level security;

create policy conversations_access on conversations for all
  using (can_access_account(account_id))
  with check (can_access_account(account_id));

-- Internal notes are hidden from client-role members.
create policy messages_read on messages for select using (
  can_access_account(account_id)
  and (kind = 'message' or is_agency_member((select agency_id from accounts where id = account_id)))
);
create policy messages_write on messages for insert with check (
  can_access_account(account_id)
  and (kind = 'message' or is_agency_member((select agency_id from accounts where id = account_id)))
);
create policy messages_update on messages for update
  using (is_agency_member((select agency_id from accounts where id = account_id)));
