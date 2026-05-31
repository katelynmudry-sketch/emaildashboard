# PRD: Header Hierarchy Redesign + Sent Drawer + Activity Log Drawer

**Date:** 2026-05-31
**Status:** Approved for planning
**Branch:** ui-redesign

---

## Goal

Three connected changes:
1. **Rethink header hierarchy** — the current header has too many elements at the same visual weight (mode selector, settings, sign out, stats, actions all compete). Restructure into clear tiers.
2. **Sent folder** — read-only drawer showing Gmail's Sent label, triggered from a header icon.
3. **Activity log** — slide-out drawer that records every triage action this session, with per-action undo for reversible operations.

---

## Audience

Katelyn — sole user, desktop browser.

---

## Scope — what we ARE building

| # | Feature |
|---|---------|
| 1 | Header restructured into 2 visual rows with clear tier logic |
| 2 | PlantHeader given a real rendered home (currently imported but never used) |
| 3 | Zen sunrise + Basic AF PSL cup SVG variants for PlantHeader |
| 4 | Sent icon button in header utility strip → right drawer |
| 5 | Sent drawer — read-only Gmail Sent list, expandable body |
| 6 | Log icon button in header utility strip → right drawer |
| 7 | Activity log drawer — records archive/delete/snooze/label/move actions |
| 8 | Per-action Undo in log (calls reverse Gmail API, marks undone) |

## Scope — what we are NOT building

- Send undo / delayed send (requires queuing outbound mail — v2 separate PRD)
- Persistent activity log across sessions (localStorage or DB — v2)
- Sent folder actions (reply, forward, resend — v2)
- Party mode PlantHeader SVG redesign (design TBD — current plant stays for now)

---

## Header Hierarchy Design

### Current problems (from code audit + screenshot)

| Problem | Impact |
|---|---|
| Mode selector, settings, sign out all same visual weight in top row | Hard to scan, no clear system-vs-workspace divide |
| `PlantHeader` imported but never rendered | Dead component — inbox triage progress invisible |
| KarmaPill AND PlantHeader both show karma — redundant | Noisy; two sources of truth |
| Compose button buried far right at icon level | Primary action hidden |
| Account badge (katelynmudry · @kmudry) floats in stats row | Identity info has no clear home |
| Batch picker inline with action buttons | Clutters the controls row |
| Roast button same weight as Refresh | Secondary action competing with primary |

### Proposed 2-row structure

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ROW A — App identity + workspace controls (always visible)                          │
│                                                                                     │
│  [✉️ EMAIL PARTY]  [subtitle]          [🎉 Party | ☕ Basic AF | 🧘 Zen]            │
│                                        [📤 Sent]  [📋 Log]  [⚙️]  [Sign out]       │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ROW B — Session stats + primary actions (only when appState === "ready")            │
│                                                                                     │
│  [PlantHeader]  [TallyTicket]  [urgent | today | fyi]  [AccountToggle]              │
│                                                         [KarmaPill]  [Compose]  [Refresh]  │
│                                                         [TODO widget — sticky]      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**When NOT ready (idle/loading/error):** Row B collapses to just the Load Inbox / status button, right-aligned.

### Row A element tiers

**Left cluster — identity (lowest interaction frequency):**
- Logo icon + "EMAIL PARTY" h1 + subtitle (read-only)

**Center cluster — workspace mode (session-level choice):**
- 3-way mode selector pills: 🎉 Party | ☕ Basic AF | 🧘 Zen

**Right cluster — system utilities (lowest priority, icon-only where possible):**
- 📤 Sent (icon button)
- 📋 Log (icon button)
- ⚙️ Settings (icon button, already exists)
- Sign out (text, muted — lowest priority, rightmost)

### Row B element tiers

**Left — session progress (visual, at-a-glance):**
- PlantHeader SVG (inbox clearing progress — stages 0–5)
- TallyTicket (N / total loaded)
- MiniStats: urgent | today | fyi
- AccountToggle

**Right — primary actions:**
- KarmaPill (karma level + progress bar)
- **Compose** (primary CTA — most prominent button)
- Refresh (secondary CTA)
- Roast/Read/Tea button (tertiary — smaller, low visual weight)

**Sticky right — TODO widget** (when todos exist, floats below action cluster)

### Batch size picker

Move out of the main controls row. Options:
- Small dropdown/select next to Refresh (less visible, less clutter)
- Collapse into a Settings sub-option (most out of the way)
- Recommendation: small inline selector directly attached to Refresh button as `[30 | 50 | 100] [Refresh]` — keeps them contextually linked without cluttering Row B

---

## PlantHeader — Per-Theme SVG Redesigns

PlantHeader tracks `getStage(remaining, total)` → stages 0–5 based on % of emails cleared this session. It currently renders in all 3 modes using different colors but the same plant shape.

### Zen mode — Sunrise

Stages = time of day as the sun rises:

| Stage | Visual | Label |
|-------|--------|-------|
| 0 | Dark horizon, no sun | Resting |
| 1 | Faint glow at horizon, pre-dawn | Awakening |
| 2 | Sun cresting horizon, warm arc | Unfolding |
| 3 | Sun halfway up, soft rays | Flourishing |
| 4 | Sun high, golden rays spreading | In bloom |
| 5 | Full sun, lotus petals radiating from sun | 🪷 Lotus |

Colors: warm amber/gold palette (`#C8960C`, `#E8C04A`, `#FFF8E0` sky). SVG is a simple landscape: flat horizon line, circle arc rising, ray lines appearing.

### Basic AF mode — PSL Cup Cross-Section

Stages = pumpkin spice latte filling up in a cup cross-section:

| Stage | Visual | Label |
|-------|--------|-------|
| 0 | Empty cup outline | Dormant |
| 1 | Small puddle at bottom (espresso) | Emerging |
| 2 | 40% filled, milk steaming | Growing |
| 3 | 60% filled, swirl visible | Present |
| 4 | 80% filled, whipped cream starting | Complete |
| 5 | Full cup, whipped cream + caramel drizzle | Done. |

Colors: warm latte tones (`#D4824A` espresso, `#F5DEB3` milk, `#6B3A2A` dark roast). Cup outline is a simple trapezoid cross-section with a rounded bottom.

### Party mode — Plant (current, defer redesign)

Keep existing magenta/pink plant SVG for now. Design TBD per TODO.

---

## Sent Drawer

### Entry point
📤 icon button in Row A right cluster. Same style as ⚙️ settings button (34×34px, rounded-9, mode-aware border/bg/color).

### Drawer behavior
- Slides in from right, 480px wide, full viewport height
- Backdrop: semi-transparent overlay (click outside to close)
- X close button top-right
- Does NOT push content — overlays on top (same pattern as future log drawer)

### Data
- Fetches `/api/gmail/threads?label=SENT&account=${activeAccount}` (reuse existing threads endpoint or add label param)
- Shows 30 most recent sent emails, sorted newest first
- Loaded on open (not pre-fetched)

### UI
```
┌────────────────────────────────────────┐
│ 📤 Sent          [personal ▾]    [✕]  │
│────────────────────────────────────────│
│ [To: Dr. Smith]  Subject line    May 31│
│ Snippet of sent email body...          │
│────────────────────────────────────────│
│ [To: Kimberly]   Re: Appointment May 30│
│ Snippet...                             │
│                           [expand ▾]  │
│  Full email body renders here when     │
│  expanded. No compose. Read only.      │
└────────────────────────────────────────┘
```

- Each row: To address, subject, date, snippet
- Click row → expands inline to show full body (same collapse/expand pattern as `EmailRow`)
- Mode-aware chrome (same bg/border tokens as `LabelSection` cards)
- No actions — read only

---

## Activity Log Drawer

### Entry point
📋 icon button in Row A right cluster.

### Data model

```typescript
type ActionType = "archive" | "delete" | "snooze" | "label" | "move" | "todo-add" | "todo-remove"

interface LogEntry {
  id: string           // nanoid
  type: ActionType
  emailId: string
  emailSubject: string
  detail?: string      // e.g. label name, snooze date, destination category
  timestamp: number    // Date.now()
  undone: boolean
  undoFn?: () => Promise<void>  // only set if reversible
}
```

State lives in `Dashboard.tsx` as `const [actionLog, setActionLog] = useState<LogEntry[]>([])`.

### What gets logged + undo availability

| Action | Logged | Undo? | Undo operation |
|--------|--------|-------|----------------|
| Archive | ✅ | ✅ 10 min | `POST /api/gmail/modify` — restore to INBOX |
| Delete (trash) | ✅ | ✅ 10 min | `POST /api/gmail/modify` — restore from TRASH |
| Snooze | ✅ | ✅ 10 min | Remove snoozed label, restore to inbox |
| Add label/tag | ✅ | ✅ 10 min | Remove label via Gmail API |
| Move (category reassign) | ✅ | ✅ 10 min | Re-apply previous label |
| Toggle TODO flag | ✅ | ✅ 10 min | Toggle back |
| Compose send | ✅ | ❌ (v2) | Delayed send not built yet |

Undo window: 10 minutes from action timestamp. After 10 min, the Undo button disappears but the log entry remains.

### Drawer UI

```
┌────────────────────────────────────────┐
│ 📋 Activity                       [✕] │
│────────────────────────────────────────│
│ 2:34 PM  Archived                      │
│ "Re: Appointment Friday"          Undo │
│────────────────────────────────────────│
│ 2:31 PM  Deleted                       │
│ "Shipment notification"           Undo │
│────────────────────────────────────────│
│ 2:28 PM  Snoozed to Jun 3              │
│ "Invoice due"                     Undo │
│────────────────────────────────────────│
│ 2:15 PM  Sent                          │
│ "Re: Patient consult"                  │
│────────────────────────────────────────│
│            (empty state)               │
│   No actions yet this session.         │
└────────────────────────────────────────┘
```

- Newest action at top
- Each row: timestamp | action type | email subject | Undo button (if available)
- On Undo click: calls `undoFn()`, marks `undone: true`, replaces Undo button with ✓ Undone
- Mode-aware copy for action types:
  - Party: "Archived 🎉", "Deleted 💥"
  - Zen: "Released", "Let go"
  - Basic AF: "Archived bestie", "Deleted lol"
- Empty state: mode-aware message

### Integration points

Every existing action handler in `Dashboard.tsx` (`handleArchive`, `handleDelete`, `handleSnooze`, `handleToggleTodo`, etc.) appends a `LogEntry` to `actionLog` before or after the API call, with an `undoFn` closure capturing the state needed to reverse it.

---

## Data Flow

```
User clicks action (archive, delete, etc.)
  → existing API call fires
  → appendLog({ type, emailId, emailSubject, undoFn: async () => { reverse API call } })
  → email removed from UI (existing behavior)

User opens Log drawer
  → renders actionLog array, newest first
  → checks timestamp: if > 10min, no undo button shown

User clicks Undo
  → undoFn() fires (reverse API call)
  → entry.undone = true
  → email restored to emails[] state (via setEmails or re-fetch)
  → Log drawer shows ✓ Undone

User opens Sent drawer
  → fetch('/api/gmail/threads?label=SENT&account=...')
  → renders list, expandable rows
```

---

## Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| Undo API call fails | Show inline error on log entry: "Couldn't undo — check Gmail" |
| Email permanently deleted (not trash) | No undo fn attached — log entry shows action only |
| Sent drawer fetch fails | Show error state in drawer with retry button |
| Sent drawer empty | "Nothing sent yet this session." (only shows current account) |
| Log drawer opened on fresh load | "No actions yet this session." empty state |
| Undo called after 10 min window | Button already hidden — no race condition possible |
| Account switched mid-session | Log entries persist but are labeled with account; undo only works for matching account |

---

## Success Criteria

- [ ] Header Row A always visible with mode selector + 4 utility buttons (Sent, Log, ⚙️, Sign out)
- [ ] Header Row B only appears when `appState === "ready"`
- [ ] PlantHeader rendered and visible in Row B for all 3 modes
- [ ] Zen sunrise SVG renders with 6 distinct stages
- [ ] Basic AF PSL cup SVG renders with 6 distinct stages
- [ ] 📤 Sent button opens drawer with Gmail Sent label emails
- [ ] Sent rows expand inline to show body
- [ ] 📋 Log button opens drawer showing session actions
- [ ] Archive/delete/snooze/label/move actions all appear in log within 1s
- [ ] Undo button reverses action via Gmail API and shows ✓ Undone
- [ ] Undo button disappears after 10 minutes
- [ ] All drawer chrome is mode-aware (3 themes)
- [ ] Compose is the most visually prominent action button in Row B

---

## Implementation Order

**Block 1 — Header restructure (no new features, just reorganize)**
- Rearrange `Dashboard.tsx` header JSX into Row A / Row B structure
- Move PlantHeader into Row B, pass `remaining`/`total`/`mode` props
- Move utility buttons (Settings, Sign out) into Row A right cluster
- Stub Sent + Log icon buttons (no-op onClick for now)

**Block 2 — PlantHeader SVG variants**
- Add Zen sunrise SVG to `PlantHeader.tsx`
- Add Basic AF PSL cup SVG to `PlantHeader.tsx`
- Remove redundant karma text from PlantHeader bottom (KarmaPill handles that)

**Block 3 — Log drawer**
- `components/LogDrawer.tsx` — drawer shell (slide-in, backdrop, close)
- `LogEntry` type + `actionLog` state in `Dashboard.tsx`
- `appendLog()` helper, wire into all action handlers
- Log drawer list UI with Undo buttons + 10-min expiry
- Mode-aware copy

**Block 4 — Sent drawer**
- Add `label` query param support to existing Gmail threads API route (or new `/api/gmail/sent`)
- `components/SentDrawer.tsx` — drawer shell + fetch + list UI
- Expandable row body (reuse EmailRow expand pattern)
