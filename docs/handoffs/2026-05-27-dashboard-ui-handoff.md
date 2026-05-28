# Handoff: Morning Dashboard UI — continue from here

**Date**: 2026-05-27  
**Branch**: `ui-redesign`  
**Last commit**: `ec6ae22` — "feat(dashboard): add full morning dashboard — Calendar, Dharma, Manifestation, Breathwork, Insights"  
**App**: Next.js 16 (App Router), TypeScript strict, Tailwind + inline styles, NextAuth v5 Google OAuth

---

## What was just built (fully committed, build passes)

A collapsible **Morning Dashboard** panel appears above the email inbox on every page load, open by default. It has 5 widgets arranged in two rows:

**Top row (3 equal columns):**
- **CalendarWidget** — Google Calendar today's events, live-fetched + 15-min localStorage cache
- **DharmaWidget** — Daily Buddhist quote (deterministic rotation) + Claude Haiku reflection question (cached by date). Dropdown to switch between 4 teachers.
- **ManifestationWidget** — Personal intentions; "📷 upload" sends a journal photo to Claude Vision for extraction; "✏️ edit" for manual entry

**Bottom row (fixed 220px + fill):**
- **BreathworkWidget** — 4-7-8 animated SVG ring + Web Audio API chimes (528Hz/396Hz). 4 rounds, phase state machine.
- **InsightWidget** — Two stacked bar charts: email breakdown by category % + calendar day split by event type (computed client-side, no API)

**3 switchable themes** via emoji buttons in the toggle bar (persisted to localStorage):
- 🕯️ Morning Altar — Cormorant Garamond serif, gold `#C8960C`
- 🎪 Festival Stage — Bebas Neue, bold border + drop shadow, rose `#FF1F6E`
- 🎴 Wabi-Sabi — Syne, editorial minimal, purple `#8B3FD8`

---

## File map — everything dashboard-related

```
lib/
  types.ts              ← DashboardTheme, DharmaTeacher, ManifestationContent, CalendarEvent, DashboardPrefs
  dashboard-data.ts     ← Server-side: read/write dharma-teachers.json + dashboard-content.json
  dashboard-prefs.ts    ← Client-side localStorage: theme, teacher, dharma cache (date-keyed), 15-min calendar cache
  auth.ts               ← calendar.readonly scope added (requires re-auth)

data/
  dharma-teachers.json  ← 4 teachers × 25 quotes: thich-nhat-hanh, pema-chodron, jack-kornfield, tara-brach
  dashboard-content.json ← Manifestation content store (single-user JSON file)

app/api/
  calendar/today/route.ts                   ← GET: today's events from Google Calendar API
  dashboard/dharma/route.ts                 ← GET ?teacher=<id>: quote + Claude Haiku reflection
  dashboard/dharma/teachers/route.ts        ← GET: teacher metadata list
  dashboard/manifestation/route.ts          ← GET/PUT: load/save manifestation content
  dashboard/manifestation/extract/route.ts  ← POST: Claude Vision extracts journal photo → ManifestationContent

components/
  Dashboard.tsx                   ← Main app; <DashboardPanel emails={emails} /> inserted after <header>
  dashboard/
    DashboardPanel.tsx            ← Wrapper: loads prefs, injects Google Font, collapsible, wires all widgets
    CalendarWidget.tsx
    DharmaWidget.tsx
    ManifestationWidget.tsx
    BreathworkWidget.tsx
    InsightWidget.tsx
    ThemeSelector.tsx
    theme-config.ts               ← THEMES record: panelBg, cardBg, cardBorder, cardRadius, cardShadow, titleFont, accentColor, labelStyle, fontImport

docs/plans/2026-05-27-morning-dashboard.md  ← Full implementation plan (already executed)
```

---

## Design system

The app uses a **light lavender fiesta** aesthetic. Core CSS variables (in `app/globals.css`):

```css
--bg: #EEE4FF        /* page background */
--card: #FFFFFF      /* card background */
--ink: #1A0A35       /* primary text, near-black purple */
--rose: #FF1F6E      /* hot pink — urgent/primary CTA */
--gold: #FFD000      /* yellow — today/secondary */
--orange: #FF6B1A    /* orange accent */
--teal: #00C4A7      /* teal/green accent */
--lime: #8FC900      /* lime green */
--purple: #8B3FD8    /* deep purple */

--font-display: Abril Fatface  /* headings, stat numbers */
--font-body: DM Sans           /* body copy */
```

Dashboard cards override the font per-theme (Cormorant/Bebas/Syne) injected as Google Fonts `<link>` by `DashboardPanel.tsx`.

---

## What needs work — known issues to tackle next

### 1. 🐛 Calendar widget requires re-auth
**Problem**: The `calendar.readonly` OAuth scope was just added. Existing sessions don't have it — Calendar widget will return empty (`{ events: [] }` graceful fallback), not error, but no real data.  
**Fix needed**: None in code. Katelyn needs to sign out + sign back in once. Then it will work.  
**If you want to make this smoother**: Add a "reconnect" nudge in `CalendarWidget.tsx` when the array is empty and the user has been signed in > 1 day.

### 2. 🎨 Theme polish pass
The 3 themes work but they share the same layout/spacing. Each should feel more distinctly different:
- **Morning Altar**: Cards should feel more spa-like — more generous padding, soft dividers instead of hard borders, the quote in a larger italic font, gold candle emoji dividers
- **Festival Stage**: Cards should feel like ticket stubs — dotted tear-line at bottom, Bebas Neue ALL-CAPS labels, bold category numbers in the insight chart
- **Wabi-Sabi**: Even more whitespace, hairline borders, monospace numerics in the breathwork timer, the chart bars as thin lines rather than filled blocks

### 3. 📐 Responsive layout
The dashboard grid is `gridTemplateColumns: "1fr 1fr 1fr"` and `"220px 1fr"` — hardcoded, breaks below ~900px.
- Need a breakpoint: at < 900px → single column stack
- `BreathworkWidget` + `InsightWidget` should stack vertically on mobile
- Consider: on mobile, default `dashboardOpen: false` to not bury the inbox

### 4. 🌙 Live moon phase
`data/dashboard-content.json` has a `moonPhase` field but it's always `""`. The `ManifestationWidget` doesn't render it yet.  
**Plan**: Hit `https://api.farmsense.net/v1/moonphases/?d=<unix_timestamp>` (free, no key) from `/api/dashboard/manifestation/route.ts` GET handler, append current phase name to the response. Render moon emoji + phase name in `ManifestationWidget` view mode.

### 5. ✨ Manifestation widget empty state
When `yearIntention` and all `callingIn` items are blank, the widget shows "Upload a journal photo or type your intentions to get started" with a ✨ emoji. This is fine but the empty state could be more beautiful — could show a subtle mandala SVG or moon circle as a placeholder visual.

### 6. 🔔 Dharma widget teacher change re-fetches
When you switch teachers, the widget blanks out and re-fetches from the API (which calls Claude). This is correct for cache misses, but it also invalidates the current day's cached reflection even if the teacher was already fetched today (different teacher key). Minor UX: could show the previous teacher's content while loading.

### 7. 📊 InsightWidget calendar parsing
`parseTimeToMin()` in `InsightWidget.tsx` parses `"9:00 AM"` format. The Calendar API returns times in this format via `toLocaleTimeString("en-CA")` — verify this works for your timezone. Edge case: all-day events (no time) are excluded from the booked-time calculation, which is correct.

---

## What NOT to touch

- `components/Dashboard.tsx` — it's large (~1600 lines). Only safe insertion point was after `</header>` which is done. Don't refactor it without reading the whole file first.
- `lib/auth.ts` — fragile dual-account auth (personal + work Gmail). The new `calendar.readonly` scope is already in. Don't change the callback structure.
- `data/dashboard-content.json` — single-user store. Fine for personal use, would need Supabase migration for multi-user (that's a later TODO).

---

## How to run

```bash
cd "C:\Users\Katelyn\Documents\AI projects\inbox-ai"
npm run dev
```

Open `http://localhost:3000`. The dashboard appears above the inbox immediately. Sign out + sign back in once to get Calendar data.

**Build check**: `npm run build` — must pass zero TypeScript errors before committing.

---

## Next things from TODO.md to consider

From `TODO.md` (the features brainstorm section):
- 🌙 **Live moon phase** — easiest win, farmsense API, no key needed
- ✅ **Top 3 MITs widget** — simple localStorage list, resets midnight
- 🌤️ **Weather + sunrise/sunset** — Open-Meteo API (no key), good complement to calendar
- 🔮 **Astrological daily snapshot** — AstroCal data already exists at `c:\Users\Katelyn\Desktop\AstroCal\data\sources`
- 🃏 **Tarot card of the day** — local JSON deck, zero API cost

Full list: `docs/plans/2026-05-27-morning-dashboard.md` has the architecture; `TODO.md` section `✨ Dashboard Widget Ideas` has all the brainstormed extras.

---

## Context on Katelyn

Personal app, currently single-user (her Gmail). The "owner email bypass" for public launch (skip free tier, load clinic context) is a future TODO. For now all dashboard features work without any restrictions.

Theme preference: she likes all 3 themes, especially Morning Altar and Festival Stage. The themes should feel distinctly like different *moods*, not just color swaps.
