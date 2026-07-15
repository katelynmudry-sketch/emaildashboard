@AGENTS.md

# Email Party — Project Intelligence

## What this app is
AI-powered Gmail triage dashboard. Fetches inbox, has Claude categorize emails by priority + category, presents them in a visual sorting interface. Features: bulk-cleanup suite (themed purges + Deep Clean sweep), morning dashboard with widgets, Daily Briefing, category blocks, compose/reply, snooze, todo flags.

Note: the karma/XP/plant-growth gamification system was removed (2026-07-14) — `lib/stats.ts` still tracks action history/streaks for internal use, but there's no XP display, karma pill, or inbox-zero confetti/lotus-bloom celebration in the UI. `components/PlantHeader.tsx` is unused dead code kept on disk in case gamification is revisited later.

Stack: Next.js (App Router) · TypeScript · Tailwind (utilities only) · NextAuth · Claude API

---

## 3-Theme System

The app has three modes: `PartyMode = "zen" | "party" | "wabi-sabi"`. Mode state lives in `Dashboard.tsx` and flows as a prop through the whole tree. **Every UI element must work correctly in all 3 modes.**

### Vibes

**🎉 Party** — Loud, celebratory, gamified. Lavender bg, everything filled with color. Copy is hype and fun. The inbox is a game you're winning.

**🧘 Zen** — Wise + poetic, like a calm teacher. Warm cream bg, golden accents. Copy is gentle, contemplative, no pressure. Inspired by Vipassana/Buddhist teachers.

**☕ Basic AF** — A 20-year-old PSL girl who grew up watching The Simple Life and is OBSESSED with protein and skincare. Warm latte/oat milk palette (creamy beige, pumpkin spice orange). Copy is enthusiastic but completely generic — motivational quotes, "literally," "bestie," "serving." Not deadpan — EXCITED, just about nothing specific.

### Where the visual tokens live
Full color values, border styles, shadow values, and per-state copy examples are in **`lib/party-mode.ts`** (type) and documented inline at the top of **`components/Dashboard.tsx`** (pageBg, ambientGlow, button styles). Category-level accent tokens are in **`components/CategoryBlock.tsx`** (`getCategoryAccent`). Dashboard widget themes are in **`components/dashboard/theme-config.ts`**.

### The rule when changing any UI element
Always define all 3 variants:
```tsx
const label = mode === "zen"
  ? "Ready when you are."
  : mode === "wabi-sabi"
    ? "Inbox empty."
    : "Ready to sort?"
```

---

## Key files

| File | Owns |
|---|---|
| `components/Dashboard.tsx` | Mode state, header, stats, all copy strings, category grid sorting, priority pin |
| `components/CategoryBlock.tsx` | Per-category accent colors (mode-aware), priority pin toggle, collapse |
| `components/LabelSection.tsx` | Card chrome (bg/border/shadow as props), email list, bulk actions |
| `components/dashboard/DashboardPanel.tsx` | Morning dashboard, maps `mode → DashboardTheme` |
| `components/dashboard/theme-config.ts` | Full token objects for 3 dashboard themes |
| `lib/party-mode.ts` | `PartyMode` type, localStorage persistence |

---

## Category grid rules
- 3-col max (`lg:grid-cols-3`), `align-items: start` (blocks size to content)
- Empty categories sort to bottom; non-empty float to top
- One category can be pinned as "priority" (📌 in header) — always sits at grid index 1 (top-center). Stored in `localStorage: inbox-ai:priority-category`

## Morning dashboard grid rules
- Top row (`.db-grid-top`): 3 cols, `align-items: start`
- Bottom row (`.db-grid-bottom`): `1fr 2fr`, `align-items: start`
- Cards shrink to content — no forced min-height

## Things still to wire up
- Roast API (`/api/ai/roast`) should receive `mode` in the payload so Claude can adjust tone per theme
- Loading/error copy strings in `Dashboard.tsx` could be made fully theme-aware (currently partial)
