# Inbox AI — Todo

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
