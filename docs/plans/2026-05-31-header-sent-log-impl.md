# Implementation Plan: Header Hierarchy + Sent Drawer + Activity Log

**Date:** 2026-05-31
**PRD:** `docs/plans/2026-05-31-header-sent-log-design.md`
**Mockup:** `public/prototype_header_sent_log.html`
**Branch:** `ui-redesign`

---

## Architecture

Two new components (`LogDrawer`, `SentDrawer`), one new API route (`/api/gmail/sent`), one new lib file (`lib/action-log.ts`), and a full restructure of the `<header>` block in `Dashboard.tsx`. Blocks 1–2 can build in parallel after Block 1's stub state is merged. Blocks 3–4 depend on Block 1's stub state (`logDrawerOpen`, `sentDrawerOpen`).

**Build order:**
- Block 1 first (header restructure + stub state)
- Blocks 2, 3, 4 in parallel after Block 1 merges

---

## Block 1: Header Restructure

**Goal:** Reorganize `Dashboard.tsx` header into Row A (always visible: logo / mode pills / util buttons) and Row B (ready-only: PlantHeader + stats + actions).

**Files modified:** `components/Dashboard.tsx`

---

### Chunk 1.1 — Add stub state for Sent/Log drawers

- **Modify:** `components/Dashboard.tsx` — after line 236 (after `instructionsOpen` state)
- **What:** Add:
  ```tsx
  const [sentDrawerOpen, setSentDrawerOpen] = useState(false)
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  ```
- **Test:** `npx tsc --noEmit` passes
- **Commit:** `refactor: add stub state for Sent and Log drawer buttons`

---

### Chunk 1.2 — Replace header opening + Row A

- **Modify:** `components/Dashboard.tsx:L1089–1214` — replace entire `<header>` open tag through end of the mode/settings/signout cluster
- **What:** New Row A structure — single flex row, three clusters:

  **Left:** logo icon (52px, mode-aware gradient) + `EMAIL PARTY` h1 + subtitle
  - Subtitle copy: `zen` → `"Your Mindful Inbox"` / `wabi-sabi` → `"ur inbox bestie"` / `party` → `"Your AI-Powered Inbox"`

  **Center:** 3-way mode pills — text only, no emojis
  ```tsx
  { id: "party",     label: "Party"   }
  { id: "wabi-sabi", label: "Basic AF" }
  { id: "zen",       label: "Zen"     }
  ```
  Same active/inactive styles as current pills, emoji stripped.

  **Right:** utility buttons — all `fontSize: "0.70rem", fontWeight: 500, opacity: 0.55, background: "none", border: "none"`
  ```tsx
  <button onClick={() => setSentDrawerOpen(true)}>Sent</button>
  <button onClick={() => setLogDrawerOpen(true)}>Log</button>
  <div style={{ width:1, height:16, background:"rgba(26,10,53,0.14)", margin:"0 2px" }} />
  <button onClick={() => setInstructionsOpen(true)}>Settings</button>
  <button onClick={() => signOut({ redirectTo: "/" })}>Sign out</button>
  ```

- **Test:** Browser shows Row A: logo left, three text pills center, four quiet text utility links right. No emojis in any button label.
- **Commit:** `refactor: header Row A — logo, mode pills, util buttons`

---

### Chunk 1.3 — Row B left cluster

- **Modify:** `components/Dashboard.tsx:L1217–1236` — replace existing stats block with Row B wrapper + left cluster
- **What:**
  ```tsx
  {appState === "ready" && (
    <div className="flex items-center justify-between gap-4 flex-wrap mt-5">

      {/* Left cluster */}
      <div className="flex items-center gap-4 flex-wrap">
        <PlantHeader
          remaining={emails.filter(e => !e.read).length}
          total={totalUnreadInbox}
          mode={mode}
        />
        <TallyTicket loaded={emails.length} total={totalUnreadInbox} mode={mode} />
        <div className="flex items-stretch gap-1">
          <MiniStat value={urgentCount} label="urgent" color={mode === "party" ? "#FF1F6E" : themeAccent} mode={mode} />
          <MiniStat value={todayCount}  label="today"  color={mode === "party" ? "#FFD000" : themeAccent} mode={mode} />
          <MiniStat value={fyiCount}    label="fyi"    color={mode === "party" ? "#00E5C4" : themeAccent} mode={mode} />
        </div>
        <AccountToggle active={activeAccount} onChange={handleAccountSwitch} loading={isLoading} />
      </div>
  ```
  Block left open for right cluster in Chunk 1.4.

- **Test:** When ready, Row B left shows PlantHeader SVG + TallyTicket + 3 MiniStats + AccountToggle in one row.
- **Commit:** `refactor: header Row B left — PlantHeader, TallyTicket, MiniStats, AccountToggle`

---

### Chunk 1.4 — Row B right cluster + not-ready state

- **Modify:** `components/Dashboard.tsx:L1238–1446` — replace Controls row + roast IIFE + roast text + right-side KarmaPill/Compose/Load Inbox cluster
- **What:** Right cluster (closes Row B):
  ```tsx
      {/* Right cluster */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Batch picker + Refresh */}
        {!workNeedsLink && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize:"0.70rem", fontWeight:700, textTransform:"uppercase",
                             letterSpacing:"0.12em", color:"rgba(26,10,53,0.56)" }}>
                per refresh
              </span>
              <div className="flex rounded-full p-0.5"
                   style={{ border:"1px solid rgba(26,10,53,0.10)", background:"rgba(26,10,53,0.03)" }}>
                {IMPORT_BATCH_OPTIONS.map(n => (
                  <button key={n} ... onClick={() => updateImportBatchSize(n)}>{n}</button>
                ))}
              </div>
            </div>
            <button onClick={loadInbox} disabled={isLoading || workNeedsLink} style={...}>
              {appState === "fetching" ? "Fetching"
                : appState === "proposing" ? "Analyzing"
                : appState === "categorizing" ? "Sorting"
                : "Refresh"}
            </button>
          </div>
        )}

        {/* Compose */}
        <button onClick={() => setComposeOpen(true)} disabled={workNeedsLink}>Compose</button>

        {/* Roast — words only, no emojis */}
        {!workNeedsLink && <button onClick={handleRoast} disabled={roasting || emails.length === 0}>
          { mode==="zen" ? (roasting ? "Reading" : "Read my inbox")
          : mode==="wabi-sabi" ? (roasting ? "Spilling" : "Spill the tea")
          : (roasting ? "Roasting" : "Roast my inbox") }
        </button>}

      </div>
    </div>
  )}
  {/* end Row B — ready state */}

  {/* Roast text — full width, below both rows */}
  {roast && appState === "ready" && (
    <div style={{ maxWidth:500, marginTop:10 }}>
      <span>&ldquo;{roast}&rdquo;</span>
      <button onClick={() => setRoast(null)}>×</button>
    </div>
  )}

  {/* Row B — not-ready state: Load Inbox only */}
  {appState !== "ready" && (
    <div className="flex items-center justify-end gap-3 mt-5">
      {workNeedsLink && <button onClick={() => signIn(...)}>Connect work Gmail</button>}
      <button onClick={loadInbox} disabled={isLoading || workNeedsLink}>
        {appState === "fetching" ? "Fetching"
          : appState === "proposing" ? "Analyzing"
          : appState === "categorizing" ? "Sorting"
          : "Load Inbox"}
      </button>
    </div>
  )}
  ```
  All button styles carry over from current code unchanged — only structure + copy changes.

- **Test:** (a) Before load: only Load Inbox button visible right-aligned. (b) After load: batch picker + Refresh + Compose + Roast visible. (c) No emojis anywhere.
- **Commit:** `refactor: header Row B right — batch picker, Refresh, Compose, Roast, Load Inbox`

---

### Chunk 1.5 — Remove KarmaPill render + relocate TODO widget

- **Modify:** `components/Dashboard.tsx:L1362–1502`
- **What:**
  - Delete the `{/* Right: Karma + Mode Toggle + Action buttons + TODO widget */}` div entirely (KarmaPill render, old Compose, old Load Inbox — all superseded by Row B right cluster)
  - Move the TODO widget JSX (`appState === "ready" && todoEmails.length > 0 && (...)`) out of the header, place it as a sticky element immediately after `</header>` before `<DashboardPanel>`
  - Add comment above KarmaPill component definition (L126): `{/* KarmaPill — preserved but not rendered in new header */}`
  - Close `</header>` tag
- **Test:** No KarmaPill in header. No duplicate Compose/Load Inbox. TODO widget still sticky and functional. `tsc --noEmit` clean.
- **Commit:** `refactor: remove KarmaPill render, relocate TODO widget outside header`

---

### Block 1 success criteria

- [ ] Row A always visible in all 3 modes
- [ ] Mode pills: text only — "Party", "Basic AF", "Zen" — no emojis
- [ ] Util buttons: Sent / Log / Settings / Sign out — `0.70rem`, `opacity: 0.55`, no border, no background
- [ ] Row B only shows when `appState === "ready"`
- [ ] `<PlantHeader>` renders in Row B (was previously imported but never rendered)
- [ ] Batch picker sits directly left of Refresh with "per refresh" label above
- [ ] No emojis in any button label anywhere in the header
- [ ] KarmaPill component definition intact but not rendered
- [ ] TODO widget renders outside `<header>`, still sticky
- [ ] `npx tsc --noEmit` clean

---

## Block 2: PlantHeader SVG Variants

**Goal:** Add `ZenSVG` (sunrise, 6 stages) and `BasicAFSVG` (PSL cup, 6 stages) render paths to `PlantSVG`, so all 3 modes show a distinct illustration that advances with inbox progress.

**Files modified:** `components/PlantHeader.tsx`

---

### Chunk 2.1 — ZenSVG sunrise (6 stages)

- **Modify:** `components/PlantHeader.tsx` — add `ZenSVG` inner function above `PlantSVG`; add early return inside `PlantSVG`: `if (mode === "zen") return <ZenSVG stage={stage} wilted={wilted} />`
- **What:** 100×140 viewBox SVG with:
  - Sky gradient rect `y=0 h=110`, gradient interpolates dark→light by stage:
    - 0: `#1A1040→#2D1B6E` | 1: `#2D1B6E→#6B3FA0` | 2: `#4A2882→#E8956A` | 3: `#7B5EA7→#FFB347` | 4: `#FFB347→#FFD700` | 5: `#FFF8E0→#FFE566`
  - Ground strip: `<rect x=0 y=110 w=100 h=30 fill="#4A7C59" />`
  - Stars (stage 0 only): 5 circles at fixed coords, r=1, fill=`#FFF`, opacity=0.8
  - Sun circle rising by stage: 0=none, 1=cy:115 r:10, 2=cy:106 r:14, 3=cy:88 r:18, 4=cy:68 r:20, 5=cy:50 r:22. Fill `#FFD700`, clipped to sky rect
  - Rays (stages 2–5): 8 `<line>` at 45° intervals, inner=r+4, outer=r+10/+13/+16/+20 per stage. stroke=`#FFD700`, strokeWidth=1.5, clipped to sky
  - Stage 5 only: `<text x=50 y=70 textAnchor="middle" fontSize=18>🪷</text>`
  - Wilted → render stage 0 (dark sky, no sun)
- **Test:** `tsc --noEmit` clean. In Zen mode, cycle stages via props — sky lightens, sun rises, rays grow, lotus appears at stage 5.
- **Commit:** `feat: add ZenSVG sunrise (6-stage) to PlantHeader`

---

### Chunk 2.2 — BasicAFSVG PSL cup (6 stages)

- **Modify:** `components/PlantHeader.tsx` — add `BasicAFSVG` above `PlantSVG`; add early return: `if (mode === "wabi-sabi") return <BasicAFSVG stage={stage} wilted={wilted} />`
- **What:** 100×140 viewBox SVG with:
  - Cup outline: `<path d="M22 30 L78 30 L70 125 L30 125 Z" fill="#F5DEB3" stroke="#8B6914" strokeWidth="2.5" />`
  - Cup rim: `<rect x=18 y=24 w=64 h=10 rx=5 fill="#D4A853" stroke="#8B6914" strokeWidth="1.5" />`
  - Handle: `<path d="M70 55 Q88 55 88 72 Q88 89 70 89" stroke="#8B6914" strokeWidth="2.5" fill="none" />`
  - Liquid fill via clipPath on cup shape. Fill top Y by stage: 0=none, 1=y:111 `#6B3A2A`, 2=y:88 `#8B5E3C`, 3=y:72 `#B07040`, 4=y:51 `#CC8B52`, 5=y:30 `#E8956A`
  - Steam wisps (stages 2–5): 3 wavy `<path>` curves above rim, x=32/50/68, cubic bezier from y=22 to y=5, stroke=`rgba(200,150,80,0.5)`
  - Swirl (stages 3–5): `<path d="M38 95 Q50 88 62 95 Q50 102 38 95 Z" fill="rgba(107,58,42,0.35)" />`
  - Whipped cream (stages 4–5): ellipse + 3 bump circles above liquid surface
  - Caramel drizzle (stage 5 only): 2 curved `<path>` strokes over whip, stroke=`#C8860C`
  - Wilted → empty cup + small drooping path
- **Test:** `tsc --noEmit` clean. In Basic AF mode, cycle stages — cup fills progressively, steam appears stage 2+, whip stage 4+, drizzle stage 5 only.
- **Commit:** `feat: add BasicAFSVG PSL cup (6-stage) to PlantHeader`

---

### Chunk 2.3 — Warm latte accent colors for wabi-sabi mode

- **Modify:** `components/PlantHeader.tsx:L192–197` — `accentColor` and `barColor` for `wabi-sabi`
- **What:** Change from near-black (`#111111`) placeholder to warm latte palette:
  ```ts
  accentColor = mode === "wabi-sabi" ? "#8B6914" : ...
  barColor    = mode === "wabi-sabi" ? "linear-gradient(90deg,#C8860C,#E8956A)" : ...
  ```
- **Test:** In Basic AF mode, progress bar and label text are warm amber/brown, not black.
- **Commit:** `fix: wabi-sabi PlantHeader accent colors — warm latte palette`

---

### Block 2 success criteria

- [ ] `tsc --noEmit` clean
- [ ] Zen stage 0: dark sky, stars, no sun
- [ ] Zen stages 1–4: sun rises, sky lightens, rays grow
- [ ] Zen stage 5: full sun + lotus emoji
- [ ] Basic AF stage 0: empty cup outline
- [ ] Basic AF stages 1–4: liquid fills with correct colors
- [ ] Basic AF stage 2+: steam wisps
- [ ] Basic AF stage 4–5: whipped cream
- [ ] Basic AF stage 5: caramel drizzle
- [ ] Party mode SVG unchanged (no regression)
- [ ] Basic AF progress bar is warm amber, not black

---

## Block 3: Activity Log Drawer

**Goal:** Session-scoped action log with per-action undo (10-minute window) in a slide-out drawer.

**Files created:** `lib/action-log.ts`, `components/LogDrawer.tsx`
**Files modified:** `components/Dashboard.tsx`

---

### Chunk 3.0 — Add unarchiveMessage + /api/gmail/unarchive route

- **Modify:** `lib/gmail.ts` — add after `archiveMessage` (~L399):
  ```ts
  export async function unarchiveMessage(accessToken: string, messageId: string): Promise<void> {
    const gmail = getGmailService(accessToken)
    await gmail.users.messages.modify({
      userId: "me", id: messageId,
      requestBody: { addLabelIds: ["INBOX"] },
    })
  }
  ```
- **Create:** `app/api/gmail/unarchive/route.ts` — exact mirror of `app/api/gmail/archive/route.ts`, calling `unarchiveMessage` instead:
  ```ts
  import { NextResponse } from "next/server"
  import { auth } from "@/lib/auth"
  import { unarchiveMessage } from "@/lib/gmail"
  import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
  import type { ArchiveRequest } from "@/lib/types"

  export async function POST(request: Request) {
    const session = await auth()
    const { messageId, account }: ArchiveRequest = await request.json()
    const accountId = parseAccountId(account)
    const authz = requireGmailAccess(session, accountId)
    if (!authz.success) return authz.response

    try {
      await unarchiveMessage(authz.accessToken, messageId)
      return NextResponse.json({ ok: true })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Unarchive failed" }, { status: 500 })
    }
  }
  ```
- **Test:** `curl -X POST http://localhost:3000/api/gmail/unarchive -d '{"messageId":"...","account":"personal"}'` → 200 `{ ok: true }`. Email reappears in Gmail inbox.
- **Commit:** `feat: add unarchiveMessage and /api/gmail/unarchive route`

---

### Chunk 3.1 — Data model (`lib/action-log.ts`)

- **Create:** `lib/action-log.ts`
- **What:**
  ```ts
  export type ActionType =
    "archive" | "delete" | "snooze" | "label" | "move" | "todo-add" | "todo-remove"

  export interface LogEntry {
    id: string
    type: ActionType
    emailId: string
    emailSubject: string
    detail?: string
    timestamp: number
    undone: boolean
    undoFn?: () => Promise<void>
  }

  export function createEntry(
    fields: Omit<LogEntry, "id" | "undone">
  ): LogEntry {
    return { ...fields, id: crypto.randomUUID(), undone: false }
  }
  ```
- **Test:** `tsc --noEmit` clean
- **Commit:** `feat: add action-log types and createEntry factory`

---

### Chunk 3.2 — State + helpers in Dashboard.tsx

- **Modify:** `components/Dashboard.tsx` — after `instructionsOpen` state (~L236)
- **What:**
  ```ts
  import type { LogEntry } from "@/lib/action-log"
  import { createEntry } from "@/lib/action-log"

  const [actionLog, setActionLog] = useState<LogEntry[]>([])

  const appendLog = useCallback((fields: Omit<LogEntry, "id" | "undone">) => {
    setActionLog(prev => [createEntry(fields), ...prev])
  }, [])

  const handleUndo = useCallback(async (id: string) => {
    const entry = actionLog.find(e => e.id === id)
    if (!entry || entry.undone || !entry.undoFn) return
    await entry.undoFn()
    setActionLog(prev => prev.map(e => e.id === id ? { ...e, undone: true } : e))
  }, [actionLog])
  ```
- **Test:** `tsc --noEmit` clean. No runtime change yet.
- **Commit:** `feat: add actionLog state, appendLog, handleUndo to Dashboard`

---

### Chunk 3.3 — Wire appendLog into action handlers

- **Modify:** `components/Dashboard.tsx` — add `appendLog(...)` call after each handler's API fetch

  **handleArchive** (after fetch, ~L778):
  ```ts
  appendLog({
    type: "archive", emailId: email.id, emailSubject: email.subject,
    timestamp: Date.now(),
    undoFn: async () => {
      await fetch("/api/gmail/unarchive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: email.id, account: activeAccount }),
      })
      setEmails(prev => [...prev, email])
    },
  })
  ```
  Note: `/api/gmail/unarchive` doesn't exist yet — undo button will show but 404 on click. Known v1 limitation, document in BUGS.md.

  **handleDelete** (~L884): `appendLog({ type:"delete", emailId, emailSubject, timestamp })` — no `undoFn`

  **handleSnooze** (~L914): `appendLog({ type:"snooze", emailId, emailSubject, detail: until, timestamp })` — no `undoFn`

  **handleToggleTodo** (~L901):
  ```ts
  appendLog({
    type: next ? "todo-add" : "todo-remove", emailId, emailSubject, timestamp: Date.now(),
    undoFn: async () => {
      await fetch("/api/gmail/todo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: email.id, value: !next, account: activeAccount }),
      })
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, todo: !next } : e))
    },
  })
  ```

  **handleRecategorize** (~L956):
  ```ts
  appendLog({
    type: "move", emailId, emailSubject, detail: newCategory, timestamp: Date.now(),
    undoFn: async () => {
      const oldCat = categories.find(c => c.name === email.category)
      if (oldCat?.gmailLabelId) {
        await fetch("/api/gmail/label", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: email.id, gmailLabelId: oldCat.gmailLabelId, account: activeAccount }),
        })
      }
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, category: email.category } : e))
    },
  })
  ```

- **Test:** Archive an email in browser, open Log drawer (after 3.5) — entry appears with correct subject.
- **Commit:** `feat: wire appendLog into archive, delete, snooze, todo, recategorize`

---

### Chunk 3.4 — LogDrawer component

- **Create:** `components/LogDrawer.tsx`
- **Props:** `{ open: boolean; onClose: () => void; entries: LogEntry[]; onUndo: (id: string) => void; mode: PartyMode }`
- **What:** `if (!open) return null`. Drawer chrome copied from `InstructionsPanel.tsx`:
  - Backdrop: `position:fixed, inset:0, zIndex:200, background:rgba(26,10,53,0.35), backdropFilter:blur(4px)`
  - Panel: `position:fixed, top:0, right:0, bottom:0, width:min(480px,96vw), zIndex:201`
  - `@keyframes slideInRight { from { transform:translateX(100%) } to { transform:translateX(0) } }`

  Mode-aware header gradient:
  - `party`: `linear-gradient(135deg,#8B3FD8,#FF1F6E)` title "ACTION LOG"
  - `zen`: `linear-gradient(135deg,#C8960C,#8B6914)` title "SESSION LOG"
  - `wabi-sabi`: `linear-gradient(135deg,#D4A96A,#C17D3C)` title "WHAT YOU DID"

  Per entry: timestamp + mode-aware action label + subject (truncated) + detail + Undo button or ✓ Undone badge.

  Undo button visible when: `entry.undoFn && !entry.undone && Date.now() - entry.timestamp < 10 * 60 * 1000`

  Mode-aware action labels:
  ```ts
  const ACTION_LABELS = {
    party:     { archive:"Archived", delete:"Deleted", snooze:"Snoozed", label:"Labeled", move:"Moved", "todo-add":"Added to todo", "todo-remove":"Removed from todo" },
    zen:       { archive:"Released", delete:"Let go",  snooze:"Rested until", label:"Placed gently", move:"Moved", "todo-add":"Noted", "todo-remove":"Released" },
    "wabi-sabi":{ archive:"Archived bestie", delete:"Deleted lol", snooze:"Snoozed ok", label:"Labeled serving", move:"Moved", "todo-add":"Noted", "todo-remove":"Done" },
  }
  ```

  Empty state copy: `party`→"Nothing yet. Start triaging!" / `zen`→"No actions this session." / `wabi-sabi`→"you haven't done anything yet bestie"

- **Test:** `tsc --noEmit` clean
- **Commit:** `feat: LogDrawer component — mode-aware entry cards, undo UI`

---

### Chunk 3.5 — Wire LogDrawer into Dashboard

- **Modify:** `components/Dashboard.tsx`
- **What:**
  1. `import LogDrawer from "./LogDrawer"`
  2. The "Log" button from Chunk 1.2 already sets `logDrawerOpen` — no new button needed
  3. Add dot badge to Log button when `actionLog.length > 0` (8px circle, absolute top-right of button, mode-aware color)
  4. Render after `<InstructionsPanel ...>`:
     ```tsx
     <LogDrawer
       open={logDrawerOpen}
       onClose={() => setLogDrawerOpen(false)}
       entries={actionLog}
       onUndo={handleUndo}
       mode={mode}
     />
     ```
- **Test:** Archive email → Log button shows dot badge. Open drawer → entry with Undo visible. Click Undo → shows ✓ Undone, email restored. Wait 10 min or mock timestamp → Undo button gone.
- **Commit:** `feat: wire LogDrawer into Dashboard — badge + render`

---

### Block 3 success criteria

- [ ] `lib/action-log.ts` exports types + factory, `tsc --noEmit` clean
- [ ] `appendLog` / `handleUndo` in Dashboard
- [ ] All 5 handlers (archive, delete, snooze, todo, recategorize) call `appendLog`
- [ ] LogDrawer renders with slide-in animation and mode-aware header
- [ ] Action labels correct in all 3 modes
- [ ] Undo button: visible only when `undoFn` + within 10 min + not already undone
- [ ] Undo fires reverse API + shows ✓ Undone
- [ ] Delete/snooze entries show no Undo button
- [ ] Log button shows dot badge when entries exist
- [ ] No z-index conflict with InstructionsPanel / EmailModal / SnoozeModal

---

## Block 4: Sent Drawer + API Route

**Goal:** Read-only sent-email drawer fetching Gmail's Sent label, triggered from the "Sent" header button.

**Files created:** `app/api/gmail/sent/route.ts`, `components/SentDrawer.tsx`
**Files modified:** `components/Dashboard.tsx`

---

### Chunk 4.1 — GET /api/gmail/sent

- **Create:** `app/api/gmail/sent/route.ts`
- **What:** Mirrors `app/api/gmail/messages/route.ts` exactly for auth pattern:
  ```ts
  export async function GET(request: Request) {
    const session = await auth()
    const url = new URL(request.url)
    const accountId = parseAccountId(url.searchParams.get("account"))
    const authz = requireGmailAccess(session, accountId)
    if (!authz.success) return authz.response

    try {
      const gmail = getGmailService(authz.accessToken)
      const list = await gmail.users.messages.list({
        userId: "me", labelIds: ["SENT"], maxResults: 30,
      })
      const messages = await Promise.all(
        (list.data.messages ?? []).map(m =>
          gmail.users.messages.get({
            userId: "me", id: m.id!,
            format: "metadata",
            metadataHeaders: ["To", "Subject", "Date"],
          })
        )
      )
      const emails: SentEmail[] = messages.map(msg => ({
        id: msg.data.id!,
        to: msg.data.payload?.headers?.find(h => h.name === "To")?.value ?? "",
        subject: msg.data.payload?.headers?.find(h => h.name === "Subject")?.value ?? "(no subject)",
        date: new Date(Number(msg.data.internalDate)).toISOString(),
        snippet: (msg.data.snippet ?? "").slice(0, 120),
      }))
      return NextResponse.json({ emails })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to fetch sent" },
        { status: 500 }
      )
    }
  }
  ```
  `SentEmail` interface defined inline in the route file.

- **Test:** `curl "http://localhost:3000/api/gmail/sent?account=personal"` (with session) → 200 `{ emails: [...] }`
- **Commit:** `feat: GET /api/gmail/sent — 30 most-recent sent emails`

---

### Chunk 4.2 — SentDrawer component

- **Create:** `components/SentDrawer.tsx`
- **Props:** `{ open: boolean; onClose: () => void; account: AccountId; mode: PartyMode }`
- **What:**
  - `if (!open) return null`
  - Fetch on `open` transition via `useEffect` + `AbortController`
  - Local state: `loading`, `emails: SentEmail[]`, `error`
  - `expandedId: string | null` — click row to expand full snippet inline
  - Drawer chrome: same as LogDrawer (slideInRight, 480px, backdrop)
  - Mode-aware header: `party`→purple/pink gradient + "Sent" / `zen`→gold gradient + "Sent" / `wabi-sabi`→pumpkin gradient + "Sent (omg)"
  - Loading: 6 skeleton rows (grey rounded bars, pulse animation via inline `@keyframes`)
  - Row layout: Subject (medium weight) | Date (right, small) / To (small, muted) / Snippet (1-line truncated, or full when expanded)
  - Date format: `new Date(email.date).toLocaleDateString("en-US", { month:"short", day:"numeric" })`
  - Empty state: `party`→"Nothing sent yet." / `zen`→"Nothing sent." / `wabi-sabi`→"no sent emails bestie"
  - No action buttons — read only

- **Test:** `tsc --noEmit` clean
- **Commit:** `feat: SentDrawer component — read-only slide-in sent email list`

---

### Chunk 4.3 — Wire SentDrawer into Dashboard

- **Modify:** `components/Dashboard.tsx`
- **What:**
  1. `import SentDrawer from "./SentDrawer"`
  2. The "Sent" button from Chunk 1.2 already sets `sentDrawerOpen` — no new button needed
  3. Render after `<LogDrawer ...>`:
     ```tsx
     <SentDrawer
       open={sentDrawerOpen}
       onClose={() => setSentDrawerOpen(false)}
       account={activeAccount}
       mode={mode}
     />
     ```
- **Test:** Click "Sent" in header → drawer slides in, loading skeleton appears, then sent emails list. Click row → snippet expands. Click backdrop or × → closes.
- **Commit:** `feat: wire SentDrawer into Dashboard`

---

### Block 4 success criteria

- [ ] `GET /api/gmail/sent?account=personal` → 200 `{ emails: SentEmail[] }`
- [ ] Unauthenticated → 401
- [ ] SentDrawer: 480px, slideInRight, backdrop, mode-aware header gradient
- [ ] Loading skeleton during fetch
- [ ] Each row: subject, To, date, snippet
- [ ] Click row → expands full snippet inline
- [ ] Empty state correct per mode
- [ ] "Sent (omg)" title in wabi-sabi mode
- [ ] No fetch fires when drawer is closed
- [ ] `tsc --noEmit` clean

---

## Technical Debt

| Item | Location | Notes |
|------|----------|-------|
| `/api/gmail/unarchive` | Fixed in Chunk 3.0 — no longer technical debt. |
| Sent drawer shows snippet only, not full body | `SentDrawer.tsx` | Full body fetch on expand is v2 |
| Send undo (delayed send) | `LogDrawer` | Send entries logged but no undoFn — v2 |
| `SentEmail` type duplicated in route + component | `app/api/gmail/sent/route.ts` + `SentDrawer.tsx` | Move to `lib/types.ts` when the type stabilizes |

---

## Build Order

```
Block 1 (header restructure) — build first, merge
    ↓
Block 2 (PlantHeader SVGs)  ┐
Block 3 (Log drawer)        ├─ all three in parallel after Block 1
Block 4 (Sent drawer)       ┘
```
