# PRD: Email Party — Dual-Mode Inbox Experience

**Date:** 2026-05-28
**Status:** Approved for implementation
**Prototype:** `public/prototype_email_party.html`

---

## Goal

Transform the inbox into a dual-mode experience: **Zen** (calm, focused, full inbox with noise collapsible) and **Party** (festival energy, gamified, inbox-zero drive). The mode is chosen at the Quote Gate before the inbox loads and can be toggled mid-session.

## Audience

Dr. Katelyn Mudry — sole user, desktop browser. The mode reflects her daily intention, not a permanent preference.

---

## Scope — what we ARE building

| # | Feature | Mode |
|---|---------|------|
| 1 | **Quote Gate** | Both — mode picker lives here |
| 2 | **Mode Toggle** | Both — persistent header pill, switchable mid-session |
| 3 | **Zen visual mode** | Zen — muted palette, softer contrast, reduced motion |
| 4 | **Party visual mode** | Party — current festival vibe amplified |
| 5 | **Karma Display pill** | Both — replaces XP label; subtle in Zen, prominent in Party |
| 6 | **Category collapse** | Zen — categories collapsible, newsletters/promos collapsed by default |
| 7 | **Category visual evolution** | Party — board progresses stormy → sun → lotus as emails cleared |
| 8 | **Lotus Bloom Inbox Zero** | Party — replaces current ¡INBOX ZERO! with lotus animation + micro-quote |
| 9 | **Mindful Purge Boulder** | Both — weekly batch banner for old promos/newsletters (7+ days) |

## Scope — what we are NOT building

- Zen Summary / Challenge-Ask-Vibe card (requires new Claude API call per email — v2)
- Ego Filter / Zen Lens tone rephraser (v2)
- Intent-based reply buttons 🙏 / ✨ / ⏳ (v2)
- Neon Disco / Monastery as additional modes (v2 — simplify to 2 modes first)
- Semantic search / "The Oracle" (v2)

---

## Core Requirements

### 1. Mode state
- Stored in `localStorage` under `inbox-ai:party-mode` — values: `"zen"` | `"party"`
- Default: `"party"` (existing vibe preserved on first load)
- Accessible app-wide via a React context (`ModeContext`) or prop-drilling from `Dashboard.tsx`

### 2. Quote Gate
- Full-screen overlay before inbox is visible (wraps the `<AuthGuard>` flow, not the inbox load)
- Shows: dharma quote + teacher name + reflection question (same data as existing `DharmaWidget`)
- Shows: two mode buttons — **🧘 Zen** and **🎉 Party** — user taps one to enter
- Shatters with a brief confetti burst (reuse `ConfettiBlast` pattern, Party mode) or a soft fade (Zen mode)
- Shown once per browser session (sessionStorage flag `inbox-ai:gate-seen`)
- Skip button for power users who want to bypass

### 3. Mode Toggle
- Small pill in the Dashboard header, always visible
- Shows current mode icon + label: `🧘 Zen` or `🎉 Party`
- Click switches mode immediately; persists to localStorage
- In Zen mode: subtle styling (muted purple border)
- In Party mode: festival styling (magenta glow)

### 4. Zen visual mode
- CSS class `mode-zen` on `<body>` or root div
- Palette overrides: reduce saturation on accents, softer backgrounds, lighter borders
- Animations: `prefers-reduced-motion`-style — disable confetti, disable stardust, keep only subtle fade-ins
- Category blocks: collapsible (chevron toggle per block); newsletter/subscription categories collapsed by default
- No confetti on archive actions (silence = peace)

### 5. Party visual mode
- CSS class `mode-party` on root — current styles are the baseline
- Karma pill prominent (large, gold glow)
- Archive/delete actions trigger a brief sparkle animation on the email row
- Category blocks show evolution progress bar
- Confetti still fires on inbox zero

### 6. Karma Display
- Rename "XP" → "Karma" everywhere in UI (not in `lib/stats.ts` — keep internal variable names)
- Pill shows: lotus emoji based on stage, karma number, thin progress bar to next level
- Stages: 🌱 Seed (0) → 🌿 Sprout (25) → 🪴 Potted (75) → 🌳 Tree (150) → 🪷 Lotus (300)
  - Add Lotus stage to existing 4-stage system
- Toast on earn: `+2 Karma` floats up from the pill (Party mode only; silent in Zen)

### 7. Category visual evolution (Party mode only)
- Each `CategoryBlock` tracks what % of its emails were cleared this session
- Visual state tied to `cleared / total` ratio:
  - 0%: default (white card, colored header)
  - 1–49%: subtle warm glow on header
  - 50–99%: sun gradient on header, progress bar visible
  - 100%: lotus bloom state — teal gradient, lotus emoji, "Clear" badge
- Progress stored in component state (session only, not persisted)
- Clearing 100% of a category in Party mode triggers +10 Karma bonus

### 8. Lotus Bloom Inbox Zero (Party mode)
- When `visibleEmails` hits zero (same trigger as existing confetti):
  - Keep confetti blast
  - Show a lotus bloom animation in center of content area (CSS keyframe)
  - Replace "¡INBOX ZERO!" text with a randomly selected short dharma quote
  - Reuse dharma data from existing `lib/dashboard-data.ts`
- Zen mode inbox zero: soft fade to a lotus with the quote only (no confetti)

### 9. Mindful Purge Boulder
- Runs after `loadInbox()` completes (same timing as package-cleanup banner)
- Logic: find emails where `actionFlag === "read"` AND `internalDate < (now - 7 days)` AND not `todo`
- If count ≥ 5: show boulder banner above the category grid
- Banner shows: boulder emoji, count, oldest date range, "Shatter It" button
- On confirm: batch-delete via existing `/api/gmail/delete` (one call per email, Promise.all)
- On success: +2 Karma per email deleted, confetti (Party) or silent (Zen)
- Dismissable (localStorage flag per session)
- Reuses the existing package-cleanup banner UI pattern

---

## Data Flow

```
App load
  → Check sessionStorage gate-seen flag
  → If not seen: show Quote Gate with mode picker
  → User picks Zen or Party → save to localStorage → dismiss gate
  → Inbox loads normally
  → After categorization: check for Mindful Purge candidates
  → Mode context flows down to Dashboard → all children

User action (archive/delete)
  → existing Gmail API call
  → recordAction() → updates karma
  → Party mode: sparkle animation + karma toast
  → Zen mode: silent, no animation
  → CategoryBlock clears counter → visual evolution update
```

---

## Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| Gate seen flag missing (private browsing) | Show gate every time — acceptable behavior |
| Mode localStorage missing | Default to `"party"` |
| Mindful Purge batch delete partial failure | Continue deleting others; show count of what succeeded |
| 0 emails to purge | Don't show boulder banner |
| Category fully cleared but user adds more via refresh | Reset evolution to match new email count |

---

## Success Criteria

- [ ] Quote Gate appears on first page load of a session, not on refresh
- [ ] Mode choice on gate persists to localStorage correctly
- [ ] Header toggle switches mode instantly (no reload)
- [ ] Zen mode visually distinct — noticeably calmer palette and no confetti
- [ ] Party mode baseline unchanged from current experience
- [ ] Karma pill shows correct stage and progress bar
- [ ] Category evolution visible in Party mode as emails cleared
- [ ] Mindful Purge boulder appears when 5+ promo emails are 7+ days old
- [ ] Lotus Bloom fires at inbox zero in both modes (confetti in Party, fade in Zen)

---

## Implementation Order

**Block 1 — Mode foundation** (no UI yet, just the wiring)
- `lib/party-mode.ts` — get/set mode, localStorage key
- `ModeContext` in `app/layout.tsx` or `components/Dashboard.tsx`

**Block 2 — Quote Gate + Toggle** (parallel after Block 1)
- `components/QuoteGate.tsx` — full-screen gate with mode picker
- Mode Toggle pill in `components/Dashboard.tsx` header

**Block 3 — Visual modes** (after Block 2)
- CSS classes `mode-zen` / `mode-party` on root
- Zen palette overrides in `globals.css`
- Category collapse in `components/CategoryBlock.tsx`

**Block 4 — Karma + Evolution** (parallel after Block 3)
- Karma pill in header (rename XP → Karma in UI)
- Category visual evolution in `CategoryBlock.tsx`
- Lotus Bloom Inbox Zero enhancement

**Block 5 — Mindful Purge** (after Block 4)
- Mindful Purge banner in `Dashboard.tsx` (reuse package-cleanup pattern)
