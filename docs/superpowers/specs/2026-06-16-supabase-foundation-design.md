# Supabase Foundation — Design Spec

**Date:** 2026-06-16  
**Status:** Approved  
**Phase:** 1 of 3 (prerequisite for Notion/Todoist connectors and journal history)

---

## What this builds

Adds Supabase as the persistence layer for the app. Existing users notice nothing — their settings migrate automatically on first load. The Google sign-in flow stays identical.

---

## Architecture

### Auth: NextAuth + Supabase adapter

- Keep NextAuth v5 with the Google provider (no change to sign-in UX)
- Add `@auth/supabase-adapter` so NextAuth stores sessions/accounts in Supabase instead of pure JWTs
- The session JWT still exists (NextAuth default) but account/session rows now also live in Supabase
- This gives each user a stable `user.id` (UUID) that becomes the foreign key for all their data

### Settings: Supabase as source of truth, localStorage as cache

Current: `localStorage` only — settings lost on device switch.  
After: `user_settings` table in Supabase, with localStorage as a fast read cache.

Write path:
```
saveSettings(patch) → write localStorage → POST /api/user/settings (fire-and-forget)
```

Read path (app startup):
```
loadSettings() → return localStorage value if present
               → otherwise fetch GET /api/user/settings → seed localStorage → return
```

Migration (one-time, silent):
```
On first authenticated load after Supabase goes live:
  GET /api/user/settings → 404/empty (no row yet)
  → read localStorage
  → POST /api/user/settings with full localStorage payload
  → Supabase is now source of truth
```

---

## Database schema

### NextAuth standard tables (via adapter)
```sql
users, accounts, sessions, verification_tokens
```
Applied via `@auth/supabase-adapter` migration SQL.

### Custom tables

```sql
create table user_settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  settings    jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);
create unique index on user_settings(user_id);
```

The `settings` column is a JSONB blob matching `InboxSettings` — avoids a column-per-setting migration every time a new setting is added.

---

## New files

| File | Purpose |
|---|---|
| `lib/supabase.ts` | Server-side Supabase client (service role key) |
| `app/api/user/settings/route.ts` | GET (load) + POST (save) settings for authenticated user |

## Modified files

| File | Change |
|---|---|
| `lib/auth.ts` | Add `SupabaseAdapter` |
| `lib/settings-storage.ts` | Add `syncSettingsToServer()` and `hydrateSettingsFromServer()` |
| `.env.example` | Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` |
| `package.json` | Add `@supabase/supabase-js`, `@auth/supabase-adapter` |

---

## What this unblocks

- **Phase 2:** `intention_entries` and `user_categories` tables (proper journal history + cross-device categories)
- **Phase 3:** Notion/Todoist OAuth tokens stored in Supabase `accounts` table — no JWT bloat or cookie hacks

---

## Out of scope for this phase

- Categories server backup (Phase 2)
- Intentions journal history (Phase 2)
- Notion/Todoist connectors (Phase 3)
- Supabase Row Level Security policies (deferred — single-user app for now, service role key bypasses RLS)
