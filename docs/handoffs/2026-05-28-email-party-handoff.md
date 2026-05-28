# Handoff: Email Party — Zen/Party Dual-Mode Inbox

**Date**: 2026-05-28  
**Branch**: `ui-redesign`  
**Last commits**:
- `1218a0f` — fix: sanitize lone Unicode surrogates (Claude API 400 bug)
- `5a60e9c` — feat: Email Party — Zen/Party dual-mode inbox experience
- `d93d4c7` — feat: morning dashboard, compose attachments, settings panel, label unification  

**App**: Next.js 16 (App Router), TypeScript strict, Tailwind + inline styles, NextAuth v5 Google OAuth  
**PRD**: `docs/plans/2026-05-28-email-party-design.md`  
**Decisions log**: `.agent/decisions.log`

---

## What was just built (fully committed, build passes)

### The concept
The inbox now has two modes Katelyn picks at the start of each session:
- **🧘 Zen** — calm, focused, full inbox visible, newsletters collapsed by default, muted palette, no confetti
- **🎉 Party** — current festival vibe amplified, karma toasts, category evolution animations, lotus bloom at inbox zero

---

## File map — everything Email Party

```
lib/
  party-mode.ts         ← NEW: get/set PartyMode ("zen"|"party") in localStorage;
                            hasSeenGate()/markGateSeen() for sessionStorage gate flag;
                            dispatches "inbox-mode-changed" CustomEvent on change
  stats.ts              ← MODIFIED: added getKarmaLevel() (replaces getPlantStage() display-side);
                            added KARMA_THRESHOLDS const with 5 levels including 🪷 Lotus at 300 XP;
                            added KarmaLevel interface

app/globals.css         ← MODIFIED: added .mode-zen CSS overrides (muted palette vars, kill animations);
                            added .karma-toast-anim, .lotus-bloom-anim, @keyframes boulder-rock,
                            @keyframes lotus-bloom

components/
  QuoteGate.tsx         ← NEW: full-screen dharma quote overlay shown once per session (sessionStorage);
                            fetches /api/dashboard/dharma; shows 🧘 Zen | 🎉 Party buttons;
                            Party pick fires ConfettiBlast, Zen pick fades out; calls onEnter(mode)
  Dashboard.tsx         ← MODIFIED: see breakdown below
  CategoryBlock.tsx     ← MODIFIED: added mode prop, collapse state, evolution tracking
  LabelSection.tsx      ← MODIFIED: added headerOverlay and collapsed props

docs/plans/
  2026-05-28-email-party-design.md  ← Full PRD with all decisions

public/
  prototype_email_party.html        ← Static mockup (can open in browser to see the concept)
```

---

## Dashboard.tsx changes (this file is ~1800 lines — read carefully before editing)

**New imports added at top:**
```ts
import { getPartyMode, setPartyMode, hasSeenGate, type PartyMode } from "@/lib/party-mode"
import { getKarmaLevel } from "@/lib/stats"
import QuoteGate from "./QuoteGate"
```

**New state variables (added after `prevEmailCount` ref):**
```ts
const [mode, setMode] = useState<PartyMode>("party")
const [showGate, setShowGate] = useState(false)
const [karmaEmoji, setKarmaEmoji] = useState("🌱")
const [karmaLabel, setKarmaLabel] = useState("Seed")
const [karmaXp, setKarmaXp] = useState(0)
const [karmaNextThreshold, setKarmaNextThreshold] = useState(25)
const [karmaToast, setKarmaToast] = useState<string | null>(null)
const [mindfulPurge, setMindfulPurge] = useState<Email[]>([])
const [purgeShattered, setPurgeShattered] = useState(false)
const [purgeDismissed, setPurgeDismissed] = useState(false)
const [lotusQuote, setLotusQuote] = useState<string | null>(null)
const [showLotusBloom, setShowLotusBloom] = useState(false)
```

**New effects added:**
1. Init effect: reads `getPartyMode()`, sets `showGate` if gate not yet seen, syncs karma state, listens to `inbox-stats-updated` + `inbox-mode-changed` events
2. Inbox-zero effect: replaces old confetti-only effect — now also sets `showLotusBloom` + picks a random `lotusQuote`

**New code in `runCategorization`** (after `setAppState("ready")`):
Mindful Purge detection — finds emails where `actionFlag === "read"` AND older than 7 days AND not todo/snoozed. If 5+, sets `mindfulPurge` state.

**New handlers:**
- `handleToggleMode()` — toggles zen↔party, calls `setPartyMode()`
- `handleMindfulPurge()` — batch deletes all `mindfulPurge` emails via `/api/gmail/delete`, awards karma

**New sub-component `KarmaPill`** (defined above `Dashboard` function):
Displays lotus emoji, karma count, level label, progress bar, and karma toast. Also contains the mode toggle button. In zen mode it's subtle; in party mode it glows gold.

**Render changes:**
- Root div now has `className={`relative min-h-screen mode-${mode}`}` — applies CSS mode overrides
- `showGate` check renders `<QuoteGate>` before anything else (including category proposal)
- `<KarmaPill>` rendered in header right-side, before action buttons
- Lotus Bloom inbox-zero replaces old ¡INBOX ZERO! section — shows `🪷` + dharma quote
- Mindful Purge boulder banner added above category grid
- `<CategoryBlock>` now receives `mode={mode}` prop

---

## CategoryBlock.tsx changes

- New `mode: PartyMode` prop (required)
- Collapse state: starts `collapsed = true` for categories matching `/newsletter|subscri|promo|deals|marketing|digest|update|notif/i` when `mode === "zen"`
- Chevron button (▼) in top-right of each block, rotates when collapsed
- Evolution tracking: `initialCount` ref captures email count on mount; `evolutionPct` and `isFullyCleared` computed from current emails vs initial
- Evolution progress bar (3px, bottom of card) appears in Party mode when `evolutionPct > 0`
- Fully cleared category: teal gradient header overlay, lotus bloom badge, `+2 karma` bonus (via `recordAction("archive")`)
- Passes `headerOverlay` and `collapsed` down to `LabelSection`

---

## LabelSection.tsx changes

Two new optional props:
- `headerOverlay?: string` — CSS background value overlaid on top of `headerBg` (used for evolution glow effect). Rendered as absolute-positioned div inside the header band.
- `collapsed?: boolean` — wraps the bulk action bar + email list in a `max-height` transition div (`0` when collapsed, `2000px` when expanded)

---

## Karma / XP system

**Internal name**: still `xp` in `lib/stats.ts` (don't rename — would break localStorage keys)  
**Display name**: "Karma" everywhere in UI

**5 levels** (added Lotus vs the previous 4):
| Level | Emoji | XP Required |
|-------|-------|-------------|
| Seed | 🌱 | 0 |
| Sprout | 🌿 | 25 |
| Potted | 🪴 | 75 |
| Tree | 🌳 | 150 |
| Lotus | 🪷 | 300 |
| Wilted | 🥀 | (missed day) |

`getKarmaLevel()` returns `{ emoji, stage, label, xp, nextThreshold }`.  
`getPlantStage()` still exists and delegates to `getKarmaLevel()` — `PlantHeader` still works.

---

## Bug fix: lone Unicode surrogates (commit `1218a0f`)

**Problem**: Some emails (broken mail clients, SMS-to-email) contain lone Unicode surrogates in their content. Gmail API passes these through. When serialized to JSON for Claude's API, the result is technically invalid JSON → 400 error.

**Fix location**: `lib/gmail.ts`

```ts
function sanitizeString(s: string): string {
  // Valid surrogate pairs (length 2) are kept; lone surrogates replaced with U+FFFD
  return s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (match) =>
    match.length === 2 ? match : "")
}
```

Applied to:
- `decodeBase64()` return value (catches body + HTML content)
- `getHeader()` return value (catches subject, from, to)
- `msg.snippet` in `parseMessage()` (direct from Gmail API JSON)

**Do not remove or move this** — without it, any inbox containing a broken-encoding email will crash the categorize/propose calls.

---

## Known issues / what needs work next

### 1. 🎨 Zen mode palette needs visual QA
The `.mode-zen` CSS overrides in `globals.css` remap the CSS variables to muted versions. This works for all components that use `var(--magenta)` etc. However, components using **hardcoded hex values** (many inline styles in `Dashboard.tsx`, `BriefingSection.tsx`, `EmailRow.tsx`) will NOT respond to the zen palette. A full zen-mode pass should identify all hardcoded colors and replace with CSS vars.

### 2. ⚡ Zen mode kills ALL animations
`.mode-zen * { animation-duration: 0s !important }` is a blunt instrument. Some transitions (modal open/close, DetailPanel expand) feel jarring with zero animation. Should be refined to: allow `transition` but kill `animation keyframes` only. Candidate fix:
```css
.mode-zen * { animation: none !important; }  /* only kills @keyframes */
/* leave transition alone */
```

### 3. 🌊 Quote Gate blocks inbox load
Currently the gate is shown synchronously — the inbox can't be loaded while the gate is showing. This is intentional (it's a "session intention" moment), but means if you hard-refresh mid-session you see the gate again. Consider: gate re-shows only if `sessionStorage` key is missing AND last gate was > 4 hours ago (use a timestamp instead of a boolean flag).

### 4. 📊 Category evolution resets on refresh
`initialCount` is a `useRef` initialized at mount time. If the user refreshes after archiving some emails, the evolution % resets to 0% (correct behavior — the ref reinitializes). This is intentional for now, but could be improved by persisting the initial count to `sessionStorage` keyed by category name.

### 5. 🪨 Mindful Purge shows all `actionFlag === "read"` emails
The heuristic catches newsletters/promos well in practice, but is imprecise — any FYI email older than 7 days qualifies. A future improvement: narrow to `actionFlag === "read" AND deletable === true AND category matches newsletter/promo pattern`. Or add a "Review" expand mode (like the package cleanup banner) before one-tap deleting.

### 6. 🧘 Zen mode + DashboardPanel
The `DashboardPanel` (Morning Dashboard) is not yet zen-mode aware. In Zen mode, the dashboard panel could:
- Default to collapsed (it's calming to come straight to the inbox)
- Show only the DharmaWidget (hide the party-energy InsightWidget charts)
This is a nice-to-have — the current behavior (theme-based, not mode-based) still works fine.

### 7. 🪷 PlantHeader still shows "XP"
`components/PlantHeader.tsx` line 187 still says `{xp} XP`. Should be `{xp} Karma`. It's a 1-line fix but low priority since the new `KarmaPill` is more prominent.

---

## Design system (unchanged from previous handoff)

```css
--bg: #EEE4FF        /* page background */
--card: #FFFFFF
--ink: #1A0A35       /* near-black purple */
--magenta: #FF1F6E   /* hot pink — urgent/CTA */
--gold: #FFD000      /* yellow — karma/today */
--orange: #FF6B1A    /* orange accent */
--teal: #00C4A7      /* teal — success/inbox zero */
--lime: #8FC900
--purple: #8B3FD8

--font-display: Abril Fatface
--font-body: DM Sans
```

**Zen mode overrides** (`.mode-zen` in `globals.css`): remaps the above vars to desaturated/muted versions.

---

## What is NOT in scope (deferred to v2)

From `docs/plans/2026-05-28-email-party-design.md`:
- **Zen Summary card** (Challenge / Ask / Vibe) inside email modal — requires new Claude call per email
- **Ego Filter / Zen Lens** — tone rephraser for toxic emails
- **Intent reply buttons** (🙏 Say No / ✨ Accept / ⏳ Request Space)
- **Neon Disco + Monastery** as additional party modes
- **Semantic search / "The Oracle"** — ask your inbox questions in natural language

---

## How to run

```bash
cd "C:\Users\Katelyn\Documents\AI projects\inbox-ai"
npm run dev
```

Open `http://localhost:3000`. You'll hit the **Quote Gate** on first load of each browser session. Pick Zen or Party — the choice persists until you clear `localStorage`. The mode toggle pill is always visible in the header to switch mid-session.

**Build check**: `npm run build` — must pass zero TypeScript errors before committing.

---

## Context on Katelyn

Solo user, personal + clinic Gmail. The dual-mode design came from this insight from the brainstorm: *"Some days I want calm and focused, other days I want inbox-zero party energy."* The mode is a **session intention**, not a permanent preference — hence the gate + toggle pattern.

She uses the app on desktop (Chrome). The design is not mobile-optimized — don't break desktop while fixing mobile.
