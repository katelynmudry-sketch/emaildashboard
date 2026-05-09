# Inbox AI — Handoff Doc
_Last updated: 2026-05-09_

## What this project is
Dr. Katelyn Mudry (naturopathic doctor, Solarium Herbs & Astrology) has two things:
1. **Morning briefing Python script** — runs at 7am via Google Cloud Run, scans Gmail, categorizes emails, drafts AI patient replies, sends a summary email
2. **Cowork artifact** (`inbox-ai`) — a claude.ai Cowork artifact that is the beginning of a real email app UI

The goal is to evolve these into a full local email app she actually uses day-to-day.

---

## Key file locations

| What | Where |
|------|-------|
| Morning briefing script | `C:\Users\Katelyn\Documents\AI projects\Morning email\morning_briefing.py` |
| Clinic context (AI voice) | `C:\Users\Katelyn\Documents\AI projects\Morning email\clinic_context.md` |
| Cowork artifact (the UI) | `C:\Users\Katelyn\Documents\Claude\Artifacts\inbox-ai\index.html` |
| SQLite email DB | `C:\Users\Katelyn\Documents\AI projects\Morning email\emails.db` (created on first run) |
| Next.js app scaffold | `C:\Users\Katelyn\Documents\AI projects\inbox-ai\` (barely started, just scaffolding) |
| This file | `C:\Users\Katelyn\Documents\AI projects\inbox-ai\HANDOFF.md` |
| Todo list | `C:\Users\Katelyn\Documents\AI projects\inbox-ai\TODO.md` |

---

## What was done this session

### Morning briefing script — DONE ✅
1. **Fixed N+1 API calls** — was making one HTTP request per email (50 emails = 50 round trips, ~15s). Now uses `get_email_metadata()` (metadata-only, fast) for all emails, only fetches full body for `patient` and `ce_savings` categories.
2. **Raised email cap** — was silently capping at 50 unread. Now paginated up to 500.
3. **Added SQLite storage** — `emails.db` in the Morning email folder. Emails are stored on first fetch; second run loads from DB instead of hitting Gmail again. Schema: `id, thread_id, sender, subject, date, message_id, body, snippet, is_starred, internal_date, category, processed_at`.

### Cowork artifact — IN PROGRESS 🔄
The artifact is a claude.ai Cowork HTML artifact. It uses `window.cowork.callMcpTool` and `window.cowork.askClaude` — it only runs inside claude.ai, not standalone.

**What works:**
- Fetches unread inbox, triages emails into urgent/today/fyi using Claude
- Category chips, stats bar, draft generation, push to Gmail drafts
- MCP tools: `search_threads`, `create_draft`, `get_thread` (all via UUID `fc06f8cf-d051-4ba9-bcef-90b8757223ca`)

**What's broken / in progress:**
- **Email body rendering** — when you expand an email, it should show the full formatted HTML email in an iframe. Currently showing plain text with raw URLs instead of clickable formatted links.

---

## The email body rendering problem (unresolved)

### What should happen
When user clicks to expand an email card → `fetchThread(id)` calls `get_thread` MCP tool → `extractBody()` parses the response → HTML written to iframe via `doc.write()` (not srcdoc attribute) → email renders with formatting, images, clickable links.

### What's actually happening
Still showing plain text with full raw URLs as link text. No HTML formatting.

### What's been tried
- Original: `srcdoc="..."` attribute — broke because any `"` in email HTML corrupts the attribute
- Fixed: switched to programmatic `doc.open()/write()/close()` via `populateEmailFrames()` — avoids encoding issues
- `extractBody()` tries multiple field name formats in order:
  1. Simplified MCP fields: `htmlBody`, `html_body`, `bodyHtml`, `body_html`
  2. `body` field if it looks like HTML (contains `<tag>`)
  3. Raw Gmail API: `payload.parts` with base64 decoding
  4. Plain text: `body`, `textBody`, `snippet`

### What we still don't know
**The actual field names the Cowork Gmail MCP `get_thread` tool returns.** The artifact now has `console.log` statements:
```javascript
console.log('[inbox-ai] get_thread response keys:', thread && Object.keys(thread));
console.log('[inbox-ai] last message keys:', lastMsg && Object.keys(lastMsg));
```

**Next step:** Open the artifact in claude.ai → F12 DevTools → Console tab → expand an email → read the two log lines. They'll show the actual field names (e.g. `['id', 'body', 'htmlBody', 'snippet', ...]`). Once we know the real field names, fix `extractBody()` to use them.

---

## Todo list (full roadmap)

### Morning briefing script
- [x] Fix N+1 API calls
- [x] Raise cap to 500 with pagination
- [x] SQLite local storage

### Cowork artifact
- [ ] **Fix email body rendering** ← current blocker (see above)
- [ ] Clickable formatted links (comes free once HTML renders)
- [ ] Cache fetched thread HTML so re-opening doesn't re-fetch

### Full local app (future)
- [ ] Inbox UI reading from SQLite (Next.js or FastAPI + HTML)
- [ ] Email read + AI reply panel
- [ ] Local full-text search (SQLite FTS5)
- [ ] Background Gmail sync every few minutes

---

## Architecture notes

### Morning briefing categorization logic
Categories: `labs`, `patient`, `interac`, `insurance`, `receipt`, `payment`, `astrology`, `outsmart` (patient portal uploads), `ce_abstract`, `ce_savings`, `ce_skip`, `admin`, `other`, `skip`

Patient emails: AI-summarized with Haiku, reply draft created in Gmail, refill requests forwarded to desk (`drkmudry.desk@gmail.com`)

### Cowork artifact tool names
The Gmail MCP in Cowork uses UUID-prefixed tool names:
- `mcp__fc06f8cf-d051-4ba9-bcef-90b8757223ca__search_threads`
- `mcp__fc06f8cf-d051-4ba9-bcef-90b8757223ca__create_draft`
- `mcp__fc06f8cf-d051-4ba9-bcef-90b8757223ca__get_thread`

### GCP deployment (morning briefing)
- Project: `morning-email-492118`
- Cloud Run job: `morning-briefing` (us-central1)
- Scheduler: 7am America/Edmonton, Mon–Fri
- Secrets: `GOOGLE_TOKEN_JSON`, `ANTHROPIC_API_KEY`
- Deploy: edit locally → upload to Cloud Shell → `bash fix.sh`
- Run manually: `gcloud run jobs execute morning-briefing --region us-central1`

---

## How to resume

1. Read this file
2. Read `TODO.md` for the task list
3. Read `C:\Users\Katelyn\Documents\Claude\Artifacts\inbox-ai\index.html` for the current artifact code
4. Read `C:\Users\Katelyn\Documents\AI projects\Morning email\CLAUDE.md` for full morning briefing context
5. First task: get the console.log output from the artifact to find out what `get_thread` actually returns, then fix `extractBody()`
