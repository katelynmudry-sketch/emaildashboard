# PRD: Inbox Gamification + Smart Cleanup

**Date:** 2026-05-09  
**Status:** Approved for implementation  
**Author:** Brainstorm session with Katelyn

---

## Goal

Make daily email triage feel rewarding and habit-forming through a points + streak system with a visible growing plant, while also reducing inbox clutter automatically via AI-detected deletable emails and package chain cleanup.

## Audience

Dr. Katelyn Mudry — sole user, personal + clinic Gmail accounts, desktop browser, single device.

## Scope — what we ARE building

- LocalStorage-based stats engine (XP, streaks, daily action counts)
- Growing plant in the page header as a visual progress indicator
- Star action (new Gmail API route + UI)
- Delete action (new Gmail API route + UI)  
- Points awarded on: archive, star, delete, draft reply saved
- Streak tracking: at least one point-earning action per calendar day
- AI `deletable` flag added to categorization output (security logins, OTPs, etc.)
- Package delivery detection → archived shipping chain search → bulk delete prompt

## Scope — what we are NOT building

- Cross-device sync (localStorage only, no database)
- Leaderboards or social features
- Push notifications or reminders
- Undo for delete (Gmail trash is the safety net)
- Automatic deletion (always user-confirmed)

---

## Points System

| Action | Points |
|---|---|
| Archive | 2 |
| Star | 2 |
| Delete | 3 |
| Draft reply saved | 5 |

**Streak:** Increments when at least 1 point-earning action happens on a calendar day. Resets after 2 consecutive missed days. Plant wilts (🥀) on day 1 miss, resets on day 2.

**Plant stages (XP thresholds):**
| Stage | Emoji | XP required |
|---|---|---|
| Seed | 🌱 | 0 |
| Sprout | 🌿 | 25 |
| Potted | 🪴 | 75 |
| Tree | 🌳 | 150 |
| Wilted | 🥀 | — (missed day) |

---

## Architecture

### Phase 1 — Parallel (no shared files)

**Agent A — Stats Engine (`lib/stats.ts`)**  
New file. Exports: `getStats()`, `recordAction(action)`, `getStreak()`, `getPlantStage()`.  
localStorage key: `inbox-ai:stats`.  
Shape:
```ts
interface Stats {
  xp: number
  totalArchived: number
  totalStarred: number
  totalDeleted: number
  totalReplied: number
  lastActionDate: string | null  // ISO date string YYYY-MM-DD
  currentStreak: number
  longestStreak: number
}
```

**Agent B — Star + Delete API Routes**  
- `app/api/gmail/star/route.ts` — POST, adds STARRED label via Gmail API  
- `app/api/gmail/delete/route.ts` — POST, moves to TRASH via Gmail API  
Both follow the same auth pattern as existing routes.

**Agent C — AI Deletable Flag (`lib/claude.ts`, `lib/types.ts`)**  
Add `deletable: boolean` and `deletableReason: string | null` to the categorization output.  
Claude should flag: security login alerts, OTP codes, 2FA notifications, social media notifications, promotional one-time codes — when they are clearly no longer actionable.  
Update `Email` type in `lib/types.ts` to include these fields.

---

### Phase 2 — Parallel (after Phase 1)

**Agent D — Plant Header UI (`components/PlantHeader.tsx`, `components/Dashboard.tsx`)**  
New component rendered in the Dashboard header replacing or alongside the existing header content.  
Shows: plant emoji (stage-based), current XP, streak count ("🔥 5 day streak").  
Reads from `lib/stats.ts`. No writes — display only.

**Agent E — Dashboard Wiring**  
- Add star button to `DetailPanel.tsx` (alongside archive/mark read)  
- Add delete button to `DetailPanel.tsx`  
- Wire star → `/api/gmail/star` → `recordAction("star")`  
- Wire delete → `/api/gmail/delete` → `recordAction("delete")`  
- Wire existing archive → add `recordAction("archive")`  
- Wire existing draft save → add `recordAction("reply")`  
- Show `deletable` badge on `EmailRow.tsx` and in `DetailPanel.tsx` for flagged emails  
- Remove starred/deleted emails from local state after action (same pattern as archive)

**Agent F — Package Chain Cleanup**  
New route: `app/api/ai/package-cleanup/route.ts`  
Flow:
1. During normal categorization, Claude already has all emails — add detection of "package delivered" emails (set `packageDelivered: true`, extract `orderSender: string`)
2. New API route accepts `{ deliveredEmail: Email }`, searches Gmail archives for related emails (by sender domain + shipping keywords in subject)
3. Small Claude call confirms which results are the same order chain
4. Returns list of email IDs safe to delete
5. UI: toast/banner in `Dashboard.tsx` — "📦 Package from Amazon arrived — 3 shipping emails found. Delete chain?" with confirm button

Add `packageDelivered: boolean` and `orderSender: string | null` to `Email` type and categorization prompt.

---

## Data Flow

```
User action (archive/star/delete/reply)
  → Gmail API route
  → Remove from local state (optimistic)
  → recordAction(type) → update localStorage stats
  → PlantHeader re-reads stats → updates display
```

```
loadInbox()
  → categorizeInbox() → emails now include deletable + packageDelivered flags
  → if any packageDelivered: trigger /api/ai/package-cleanup in background
  → surface deletable badge on EmailRow
  → surface package cleanup banner if chain found
```

---

## Error Handling & Edge Cases

- Star/delete API failure: show error toast, do NOT remove from local state, do NOT award points
- Stats localStorage corrupt/missing: default to zero state, don't crash
- Package cleanup: if Gmail search returns no results, silently skip (no banner)
- Package cleanup: user dismisses banner → don't show again for that email ID (track dismissed IDs in localStorage)
- Plant stage: capped at 🌳 — XP keeps accumulating but display doesn't change (no regression)
- Streak miss detection: checked on app load by comparing `lastActionDate` to today

---

## Success Criteria

- Points awarded correctly for each action type
- Streak increments on active days, resets correctly after 2 missed days
- Plant advances through all 4 stages and wilts on missed day
- Star labels emails in Gmail correctly
- Delete moves emails to Gmail trash
- Deletable badge visible on flagged emails
- Package cleanup banner appears after a delivery is detected and dismissed cleanly
- All stats survive page refresh (localStorage persistence confirmed)

---

## Implementation Order

1. Phase 1 agents (A, B, C) in parallel
2. Phase 2 agents (D, F) in parallel after Phase 1
3. Agent E last (touches most existing files, needs routes + stats both ready)
