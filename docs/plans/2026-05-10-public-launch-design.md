# PRD: inbox-ai Public Launch (v1)

**Date:** 2026-05-10  
**Status:** Approved — ready for /plan

---

## Goal

Make inbox-ai a working multi-user public app that anyone can sign in to with their Gmail account, set up their own AI persona, and use for free — with the option to bring their own Anthropic API key for unlimited use.

---

## Audience

Two distinct users:
- **Techies** — comfortable pasting an API key, want full control, don't want to pay a subscription
- **Newbies** — just want a beautiful inbox triage tool, will use the free weekly sort, may not know what an API key is

---

## Scope

### What we ARE building (v1)
- Gmail OAuth sign-in for any Google account
- Persona onboarding flow (on first login)
- Free tier: 1 AI sort per week, resets every Monday
- BYOK: user pastes their Anthropic API key to get unlimited sorts
- Owner email bypass: Katelyn's accounts get full clinic context and unlimited sorts always
- Supabase database for user personas, encrypted API keys, usage tracking
- Pre-GitHub security fixes

### What we are NOT building (v2)
- Stripe / paid tiers ($8/$15/month)
- "Learn my persona from sent mail" AI feature
- Personal constitution document upload
- True multi-account Gmail (separate OAuth flows per account)

---

## Core Requirements

### 1. Pre-GitHub security fixes (do first)
- Remove `debug: true` from `lib/auth.ts` (or gate on `NODE_ENV !== "production"`)
- Move hardcoded email addresses out of `lib/types.ts` → `OWNER_EMAIL` / `OWNER_WORK_EMAIL` env vars
- Move `CLINIC_CONTEXT` out of `lib/claude.ts` → loaded from env var or a protected server-side config file (never committed)

### 2. Supabase schema
One table: `user_profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | matches NextAuth session user id |
| `email` | text | Gmail address |
| `persona_name` | text | e.g. "Dr. Katelyn" |
| `persona_role` | text | e.g. "naturopathic doctor" |
| `persona_context` | text | free-form: writing style, sign-off, priorities |
| `persona_preset` | text | preset slug if they skipped, e.g. "professional" |
| `api_key_encrypted` | text | AES-encrypted Anthropic key, null if not set |
| `sort_count_week` | int | resets to 0 every Monday |
| `last_sort_reset` | date | the Monday it was last reset |
| `onboarding_complete` | bool | false until they finish or skip onboarding |
| `created_at` | timestamptz | |

### 3. Persona onboarding (new users only)
Triggered on first login when `onboarding_complete = false`.

**Flow:**
1. Welcome screen — "inbox-ai works best when it knows a bit about you"
2. Choose path:
   - **Tell us about yourself** → form: name, role/job, email writing style, sign-off phrase
   - **Pick a preset and go** → card picker: Professional · Personal · Healthcare · Creative
3. Either path leads to a confirmation screen, then inbox
4. Settings page lets them edit persona or switch preset any time
5. "Coming soon" note on the settings page: "Let AI learn from your sent mail"

### 4. Free tier gating
- Before any AI categorization call, check `sort_count_week` in Supabase
- If count ≥ 1 AND user has no BYOK AND user is not owner email: block with upgrade prompt
  - "You've used your free sort this week. Resets Monday — or add your Anthropic API key for unlimited."
- On successful sort: increment `sort_count_week`, set `last_sort_reset` if it's a new week
- Reset logic: on any sort check, if `last_sort_reset` < the most recent Monday, reset count to 0

### 5. BYOK flow
- Settings page: "Add your Anthropic API key"
- Key is validated (test call) before saving
- Stored AES-256 encrypted in Supabase (encryption key in env var, never in DB)
- When present: Claude client uses user's key instead of owner's key
- User can remove key at any time (reverts to free tier)

### 6. Owner email bypass
- `OWNER_EMAIL` and `OWNER_WORK_EMAIL` env vars
- If signed-in email matches either: skip free tier check, load `CLINIC_CONTEXT` from env, use owner Anthropic key
- All other users get generic Claude client with their persona injected as system prompt

### 7. Dynamic Claude system prompt (all non-owner users)
Replace hardcoded `CLINIC_CONTEXT` with a function that builds the system prompt from the user's persona:

```
You are an AI assistant helping {name} ({role}) triage their email.

## Their email style
{persona_context}

## Sign-off
{sign_off}

## Summary rules
Only generate a summary if the email body is longer than ~150 words or contains a special offer/promotion. Otherwise set summary to null.
```

Presets get a sensible default for each field. User can override.

---

## Success Criteria

- A stranger can sign in with their Gmail, complete onboarding in under 2 minutes, and get their inbox sorted
- The free tier limit correctly blocks a second sort in the same week
- A BYOK user gets unlimited sorts with no friction after key setup
- Katelyn's accounts still get the full clinic context experience unchanged
- No personal data (emails, API keys, Anthropic key) is visible in the GitHub repo

---

## Edge Cases & Failure Modes

| Scenario | Handling |
|----------|----------|
| User adds invalid Anthropic key | Validate with a test call before saving; show error inline |
| User hits free tier mid-sort | Check count before starting, not after |
| Supabase down | Fall back to blocking AI features with a clear error; Gmail browsing still works |
| User deletes their Google account | Supabase row orphaned but harmless; no PII beyond email |
| Owner email env var not set | Log warning, no bypass — safer to fail closed |
| New user skips onboarding entirely | Create a row with `persona_preset = "professional"` and `onboarding_complete = true` |

---

## Implementation Order

1. Pre-GitHub security fixes (debug flag, env vars for emails + clinic context)
2. Supabase schema + client setup
3. Onboarding flow (UI + DB writes)
4. Free tier gating middleware
5. BYOK settings page + encrypted key storage
6. Dynamic system prompt builder
7. Owner email bypass
8. End-to-end test: new user → onboarding → free sort → BYOK → unlimited sort
