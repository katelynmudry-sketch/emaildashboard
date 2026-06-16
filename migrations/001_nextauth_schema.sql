-- Paste this entire file into the Supabase SQL editor and run it.
-- Required for NextAuth @auth/supabase-adapter + inbox-ai user settings.

-- ── NextAuth required tables ──────────────────────────────────────────────────

create table if not exists users (
  id            uuid not null default gen_random_uuid(),
  name          text,
  email         text,
  "emailVerified" timestamptz,
  image         text,
  primary key (id)
);

create table if not exists accounts (
  id                   uuid not null default gen_random_uuid(),
  "userId"             uuid not null references users(id) on delete cascade,
  type                 text not null,
  provider             text not null,
  "providerAccountId"  text not null,
  refresh_token        text,
  access_token         text,
  expires_at           int8,
  token_type           text,
  scope                text,
  id_token             text,
  session_state        text,
  primary key (id),
  unique (provider, "providerAccountId")
);

create table if not exists sessions (
  id             uuid not null default gen_random_uuid(),
  "sessionToken" text not null,
  "userId"       uuid not null references users(id) on delete cascade,
  expires        timestamptz not null,
  primary key (id),
  unique ("sessionToken")
);

create table if not exists verification_tokens (
  identifier text not null,
  expires    timestamptz not null,
  token      text not null,
  primary key (identifier, token)
);

-- ── inbox-ai custom tables ────────────────────────────────────────────────────

create table if not exists user_settings (
  id          uuid primary key default gen_random_uuid(),
  "userId"    uuid not null references users(id) on delete cascade,
  settings    jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

create unique index if not exists user_settings_user_id_idx on user_settings("userId");
