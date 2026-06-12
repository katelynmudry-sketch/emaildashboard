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
- [x] Dynamic system prompt builder — default prompt is now generic; each user writes/uploads their own via Settings -> AI System Prompt (no more shared `CLINIC_CONTEXT` env var)
- [ ] Owner email bypass — free tier / BYOK still TBD (no longer tied to system prompt)

### Launch
- [ ] End-to-end test: new user → onboarding → free sort → BYOK → unlimited sort
- [ ] Push to GitHub (public repo)

## Theme system — in progress

### Karma flower (PlantHeader) — rebuild SVG per theme
- [ ] Party mode — design TBD (currently magenta/pink plant)
- [ ] Zen mode — sunrise illustration (replacing current amber plant)
- [ ] Basic AF mode — cross-section of a PSL cup filling up as karma increases

### Preset intentions
- [ ] Quick-pick preset options in the Intentions widget (clickable chips, not just text fields)
- [ ] "Generate from theme" button — Claude generates an intention based on the active mode vibe
- [ ] Intentions display inline with the theme (serious and kind in every mode)

### Header layout
- [ ] Tighten dead space in header area — stats row feels sparse at mid widths

### Mobile (future — bigger lift)
- [ ] Responsive mobile layout pass

---

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

---

## ✨ Dashboard Widget Ideas
> Brainstormed 2026-05-27. The core dashboard (Calendar, Dharma, Manifestation, Breathwork, Insight charts) is planned in `docs/plans/2026-05-27-morning-dashboard.md`. These are the next-tier additions.

### Spiritual / Ritual
- [ ] **🔮 Astrological daily snapshot** — Today's moon sign, major transits, retrograde alerts. Pull from AstroCal (you already have this data!). Would make the dashboard feel uniquely yours.
- [ ] **🃏 Tarot card of the day** — Draw one card from a local JSON deck (78 cards + meanings). Show card name, one-line meaning, and a reflection prompt. No API needed.
- [ ] **🌿 Moon gardening / herbal almanac** — "What's energetically active today" based on moon sign (Taurus = grounding herbs, Gemini = communication, etc.). Ties into the Apothecary world + AstroCal moon data.
- [ ] **🌙 Live moon phase** — Replace the hardcoded moonPhase string in `dashboard-content.json` with a live lunar phase from farmsense.net or astronomyapi.com (both free).

### Productivity / Focus
- [ ] **✅ Top 3 MITs (Most Important Things)** — Editable list of today's 3 focus intentions. Distinct from manifestation (big-picture) — this is *today's action*. Resets at midnight, saves to localStorage.
- [ ] **⚡ Weekly focus theme** — One word/phrase for the whole week ("Depth", "Rest", "Launch"). Set Monday, visible all week. Popular in personal OS dashboards.
- [ ] **🏗️ Project status pulse** — Color-coded status dots for active projects (Inbox AI, AstroCal, Apothecary): Active / Paused / Shipping. Quick "what world am I in today" glance.
- [ ] **⏰ Countdown widget** — Days until a meaningful event, deadline, or launch. User sets name + date. Multiple countdowns. Stored in localStorage.

### Wellness / Reflection
- [ ] **🌤️ Weather + sunrise/sunset** — Current conditions + sunset time for golden hour walk planning. Open-Meteo API (no key needed), sunrise-sunset.org.
- [ ] **🌿 Habit ring** — Daily checkbox ring: Meditate ✓, Journal ✓, Move ✓, Water ✓. Streak counter. Fully customizable habit list. Resets daily, streak in localStorage.
- [ ] **🙏 Gratitude field** — A text box: "Today I'm grateful for…" Auto-saves as you type. Shows yesterday's as a morning reminder. Rolling 30-day log in localStorage.
- [ ] **💓 Energy level check-in** — 1–5 slider on arrival ("how am I today?"). Logs over time so you can spot patterns. Could feed a mini weekly chart.

### Learning
- [ ] **📚 Reading / learning tracker** — Current book title + page progress. Or "what dharma text am I studying this month?" Pairs with the teacher selector.

### Bigger Integrations
- [ ] **AstroCal integration** — Pull today's transits + moon phase directly from AstroCal. Both apps feel like one ecosystem.
- [ ] **Notion sync** — Push email TODOs to a Notion database. The Notion MCP is already connected.
- [ ] **Spotify morning playlist** — "Start my morning" button triggers a playlist via Spotify API, or shows what's currently playing.

### Inbox AI Improvements (non-dashboard)
- [ ] **Smart snooze suggestions** — Claude suggests a specific snooze date based on email content ("This expires Jun 8 — snooze until Jun 7?").
- [ ] **Email → Calendar event** — Detect emails with meeting details, offer one-click "Add to Google Calendar".
- [ ] **Recurring sender rules UI** — Visual editor for `data/categorization-rules.json` instead of editing the file directly.
- [ ] **Weekly inbox report** — "This week in your inbox" summary: emails triaged, busiest categories, reply rate, time saved. Claude-generated from stats.
- [ ] **Dark mode** — Deep ink backgrounds with fiesta accents glowing.
- [ ] **Multi-account combined stats** — Personal + work inbox stats in one unified header.
