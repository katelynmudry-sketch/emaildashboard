# Inbox AI — Todo

## Public launch (v1) — multi-user + BYOK
> Full design: `docs/plans/2026-05-10-public-launch-design.md`

### Pre-GitHub security fixes (do first)
- [x] Remove `debug: true` from `lib/auth.ts`
- [x] Move hardcoded emails in `lib/types.ts` → `OWNER_EMAIL` / `OWNER_WORK_EMAIL` env vars
- [x] Move `CLINIC_CONTEXT` out of `lib/claude.ts` → env var or protected server config

### Database
- [ ] Set up Supabase `user_profiles` table (see PRD for schema)
- [ ] Add Supabase client to project

### Onboarding
- [ ] New user onboarding flow — "tell us about you" form or preset picker
- [ ] Settings page — edit persona, add/remove BYOK key

### Free tier + BYOK
- [ ] Weekly sort counter — check before AI call, increment after, reset Mondays
- [ ] BYOK settings page — validate key with test call, store AES-encrypted
- [ ] Free tier block UI — "resets Monday, or add your Anthropic key"

### AI
- [ ] Dynamic system prompt builder — builds from user persona instead of hardcoded clinic context
- [ ] Owner email bypass — Katelyn's accounts skip free tier + load clinic context from env

### Launch
- [ ] End-to-end test: new user → onboarding → free sort → BYOK → unlimited sort
- [ ] Push to GitHub (public repo)

## Morning briefing script (Morning email/)
- [x] Fix N+1 API calls — use metadata-first, only full fetch for patient/ce_savings
- [x] Raise unread cap from 50 → 500 with pagination
- [x] Add SQLite local storage (emails.db) — skip re-fetching on second run

## Cowork artifact (Claude\Artifacts\inbox-ai\index.html)
- [ ] Fix email body rendering — fetch full HTML via get_thread on expand, render in sandboxed iframe
- [ ] Clickable links (especially unsubscribe) in email body
- [ ] Store fetched thread HTML per email so it doesn't re-fetch on re-open

## Full local app (inbox-ai/ — Next.js)
- [ ] Build inbox view UI reading from SQLite
- [ ] Email read + AI reply panel (reuse draft_patient_reply logic from Python script)
- [ ] Local full-text search over stored emails (SQLite FTS5)
- [ ] Background Gmail sync — poll every few minutes, keep DB current
