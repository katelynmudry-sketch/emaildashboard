# Label Section Unification — Shared Base Component

**Date:** 2026-05-27  
**Status:** Ready to build

---

## Header

**Goal:** Extract a single `LabelSection` component that all email sections (category blocks, Daily Briefing, Delete tile) render through — so one fix (e.g. attachments, hover states, DetailPanel) propagates everywhere automatically.

**Architecture:**  
`LabelSection` owns the full email-section structure: colored header band, count badge, Select All button, bulk action bar, scrollable email list with inline DetailPanel expansion, and an optional `children` slot between the header and email list (used by BriefingSection for a summary paragraph). `CategoryBlock` becomes a thin wrapper that computes its accent color and configures `LabelSection`. `BriefingSection` is a thin wrapper that passes a briefing-specific accent and its summary as `children`. The Delete Candidates section is eliminated — `deletable: true` emails are routed into a synthetic "🗑️ Delete" tile that also uses `LabelSection` via `CategoryBlock`.

**Design Patterns:** Extract Component, Render Slot (`children` prop), Thin Wrapper, Synthetic Data Injection.  
**Tech Stack:** React + TypeScript (Next.js). No test framework — `npx tsc --noEmit` is the gate.  
**Reference:** Current `CategoryBlock.tsx` is the spec for visual structure. Do not deviate from its header band styling, bulk bar, or EmailRow usage patterns.

---

## Audit: Current Gap Analysis

| Section | Shared Base | Select All | Bulk Actions | DetailPanel | onToggleTodo/onSnooze | Location |
|---|---|---|---|---|---|---|
| CategoryBlock (Patient, Clinical…) | ❌ isolated | ✅ | ✅ Mark read / Archive / Delete | ✅ | ❌ MISSING | own file ✅ |
| Daily Briefing | ❌ isolated | ❌ | ❌ | ✅ | ✅ | inlined in Dashboard ❌ |
| Delete Candidates | ❌ isolated | ❌ | ❌ | ❌ | ❌ MISSING | inlined in Dashboard ❌ |

**Root problem:** Three separate rendering paths. A fix to EmailRow props, DetailPanel, or the bulk action bar must be made in three places. `LabelSection` collapses this to one.

---

## Block 1 — Create `LabelSection` Shared Base

**Goal:** One component with the full structure. All other sections will wrap it.

**Success Criteria:**
- [ ] `components/LabelSection.tsx` exists and compiles
- [ ] Renders: header band → (optional children slot) → email list with DetailPanel
- [ ] Select All / Deselect All in header
- [ ] Bulk action bar with configurable actions array (`{ label, handler, danger }`)
- [ ] All EmailRow props passed including `onToggleTodo` and `onSnooze`
- [ ] `bulkActions` handlers receive the currently-selected `Email[]` — callers don't manage selection state

---

### Chunk 1.1 — Create `LabelSection.tsx`

**Files:** Create `components/LabelSection.tsx`

**Step 1 – Write failing shell (TS compile gate):**
```tsx
// components/LabelSection.tsx
"use client"
import type { AccountId, Email, Category, Attachment } from "@/lib/types"

export interface BulkAction {
  label: string
  danger?: boolean
  handler: (selectedEmails: Email[]) => Promise<void>
}

export interface LabelSectionProps {
  // Header appearance
  title: string
  headerBg: string
  headerTextColor: string
  border?: string
  boxShadow?: string

  // Data
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null

  // Between header and email list (e.g. briefing summary)
  children?: React.ReactNode

  // Configurable bulk actions
  bulkActions?: BulkAction[]

  // Email action handlers
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
  emptyText?: string
  className?: string
}

export default function LabelSection(_props: LabelSectionProps) {
  return null
}
```

**Step 2 – Verify shell compiles:**
```
npx tsc --noEmit
```
Expected: zero errors.

**Step 3 – Implement full component:**

Replace the null body with the complete implementation. Structure is extracted verbatim from `CategoryBlock.tsx` — header band, bulk bar, email list, DetailPanel — made generic via props:

```tsx
"use client"

import { useState } from "react"
import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import EmailRow from "./EmailRow"
import DetailPanel from "./DetailPanel"

export interface BulkAction {
  label: string
  danger?: boolean
  handler: (selectedEmails: Email[]) => Promise<void>
}

export interface LabelSectionProps {
  title: string
  headerBg: string
  headerTextColor: string
  border?: string
  boxShadow?: string
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null
  children?: React.ReactNode
  bulkActions?: BulkAction[]
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
  emptyText?: string
  className?: string
}

export default function LabelSection({
  title, headerBg, headerTextColor,
  border = "rgba(26,10,53,0.10)",
  boxShadow = "0 4px 28px rgba(26,10,53,0.05)",
  emails, categories, selectedEmail,
  children,
  bulkActions = [],
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onSnooze, gmailAccount,
  emptyText = "All clear ✓",
  className = "",
}: LabelSectionProps) {
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  const selectionMode = bulkSelected.size > 0
  const allSelected = emails.length > 0 && bulkSelected.size === emails.length

  function toggleSelectAll() {
    setBulkSelected(allSelected ? new Set() : new Set(emails.map(e => e.id)))
  }

  function toggleEmail(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function fireBulkAction(action: BulkAction) {
    const targets = emails.filter(e => bulkSelected.has(e.id))
    setBulkSelected(new Set())
    await action.handler(targets)
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${className}`}
      style={{
        background: "#FFFFFF",
        border: `1px solid ${border}`,
        borderRadius: 16,
        boxShadow,
      }}
    >
      {/* ── Header band ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: headerBg }}
      >
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.92rem",
          letterSpacing: "0.06em",
          color: headerTextColor,
          margin: 0,
        }}>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {emails.length > 0 && (
            <span style={{
              fontSize: "0.7rem", fontWeight: 700,
              background: "rgba(0,0,0,0.22)",
              color: headerTextColor,
              borderRadius: 99, padding: "1px 9px",
            }}>
              {emails.length}
            </span>
          )}
          {emails.length > 0 && (
            <button
              onClick={toggleSelectAll}
              style={{
                fontSize: "0.62rem", color: headerTextColor,
                opacity: 0.72, background: "none", border: "none",
                cursor: "pointer", padding: 0,
              }}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectionMode && bulkActions.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2" style={{
          background: "rgba(26,10,53,0.04)",
          borderBottom: "1px solid rgba(26,10,53,0.07)",
        }}>
          <span style={{ fontSize: "0.68rem", color: "rgba(26,10,53,0.65)", marginRight: 4 }}>
            {bulkSelected.size} selected
          </span>
          {bulkActions.map(action => (
            <button key={action.label} onClick={() => fireBulkAction(action)} style={{
              fontSize: "0.66rem", padding: "2px 8px", borderRadius: 5,
              border: `1px solid ${action.danger ? "rgba(255,31,110,0.35)" : "rgba(26,10,53,0.14)"}`,
              background: action.danger ? "rgba(255,31,110,0.10)" : "rgba(26,10,53,0.05)",
              color: action.danger ? "#FF1F6E" : "rgba(26,10,53,0.72)",
              cursor: "pointer",
            }}>
              {action.label}
            </button>
          ))}
          <button
            onClick={() => setBulkSelected(new Set())}
            style={{
              marginLeft: "auto", fontSize: "0.66rem",
              color: "rgba(26,10,53,0.56)",
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Optional slot (summary paragraph, etc.) ── */}
      {children}

      {/* ── Email list ── */}
      <div className="px-2 py-2 space-y-0.5 min-h-[80px]">
        {emails.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: "rgba(26,10,53,0.72)", textAlign: "center", padding: "16px 0", margin: 0 }}>
            {emptyText}
          </p>
        ) : (
          emails.map(email => (
            <div key={email.id}>
              <EmailRow
                email={email}
                selected={!selectionMode && email.id === selectedEmail?.id}
                isSelected={bulkSelected.has(email.id)}
                selectionMode={selectionMode}
                onClick={selectionMode ? () => toggleEmail(email.id) : () => onSelect(email)}
                onDoubleClick={selectionMode ? undefined : () => onExpand(email)}
                onMarkRead={() => onMarkRead(email)}
                onDelete={() => onDelete(email)}
                onReply={() => onExpand(email, "reply")}
                onForward={() => onExpand(email, "forward")}
                onToggleTodo={() => onToggleTodo(email)}
                onSnooze={() => onSnooze(email)}
              />
              {!selectionMode && email.id === selectedEmail?.id && (
                <div className="mt-1 mb-2">
                  <DetailPanel
                    email={selectedEmail}
                    gmailAccount={gmailAccount}
                    categories={categories}
                    onClose={onClose}
                    onArchive={onArchive}
                    onMarkRead={onMarkRead}
                    onSaveDraft={onSaveDraft}
                    onSend={onSend}
                    onStar={onStar}
                    onDelete={onDelete}
                    onRecategorize={onRecategorize}
                    onMarkReplied={onMarkReplied}
                    onMarkDeletable={onMarkDeletable}
                    onNewCategory={onNewCategory}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

**Step 4 – Verify pass:** `npx tsc --noEmit` — zero errors.

**Step 5 – Commit:**
```
git add components/LabelSection.tsx
git commit -m "feat: add LabelSection shared base component for all email sections"
```

---

## Block 2 — Refactor `CategoryBlock` to Use `LabelSection`

**Goal:** CategoryBlock becomes a thin wrapper. All email list logic, DetailPanel, and bulk bar move to `LabelSection`. CategoryBlock only computes the accent color and configures the bulk actions.

**Success Criteria:**
- [ ] `CategoryBlock.tsx` is significantly shorter — no selection state, no EmailRow rendering, no DetailPanel
- [ ] Visual output is pixel-identical to current CategoryBlock
- [ ] `npx tsc --noEmit` passes

---

### Chunk 2.1 — Rewrite CategoryBlock as a LabelSection wrapper

**Files:** Modify `components/CategoryBlock.tsx`

**Step 1 – Write failing test:**
Import `LabelSection` in CategoryBlock before the implementation exists:
```tsx
import LabelSection from "./LabelSection"
```
Run `npx tsc --noEmit`. If LabelSection props don't align, compile fails — fix before continuing.

**Step 2 – Implement:**

Replace the entire component body. Keep `getCategoryAccent` and the `Props` interface, but strip all state/handler/render logic:

```tsx
"use client"

import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import LabelSection from "./LabelSection"

interface Props {
  category: Category
  categories: Category[]
  emails: Email[]
  selectedEmail: Email | null
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
}

function getCategoryAccent(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const accents = [
    { header: "#FF1F6E", text: "#FFF5E0", border: "rgba(255,31,110,0.30)",  glow: "rgba(255,31,110,0.10)" },
    { header: "#FFD000", text: "#0D0821", border: "rgba(255,208,0,0.30)",   glow: "rgba(255,208,0,0.10)" },
    { header: "#00E5C4", text: "#0D0821", border: "rgba(0,229,196,0.30)",   glow: "rgba(0,229,196,0.10)" },
    { header: "#FF6B1A", text: "#FFF5E0", border: "rgba(255,107,26,0.30)",  glow: "rgba(255,107,26,0.10)" },
    { header: "#C084FC", text: "#0D0821", border: "rgba(192,132,252,0.30)", glow: "rgba(192,132,252,0.10)" },
    { header: "#B8F000", text: "#0D0821", border: "rgba(184,240,0,0.30)",   glow: "rgba(184,240,0,0.10)" },
  ]
  return accents[Math.abs(hash) % accents.length]
}

export default function CategoryBlock({
  category, categories, emails, selectedEmail,
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onSnooze, gmailAccount,
}: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)
  const accent = getCategoryAccent(category.name)

  return (
    <LabelSection
      title={category.name.toUpperCase()}
      headerBg={accent.header}
      headerTextColor={accent.text}
      border={accent.border}
      boxShadow={`0 4px 28px ${accent.glow}`}
      emails={sorted}
      categories={categories}
      selectedEmail={selectedEmail}
      bulkActions={[
        { label: "Mark read", handler: async (targets) => { for (const e of targets) await onMarkRead(e) } },
        { label: "Archive",   handler: async (targets) => { for (const e of targets) await onArchive(e) } },
        { label: "Delete",    handler: async (targets) => { for (const e of targets) await onDelete(e) }, danger: true },
      ]}
      onSelect={onSelect}
      onExpand={onExpand}
      onClose={onClose}
      onMarkRead={onMarkRead}
      onArchive={onArchive}
      onSaveDraft={onSaveDraft}
      onSend={onSend}
      onStar={onStar}
      onDelete={onDelete}
      onRecategorize={onRecategorize}
      onMarkReplied={onMarkReplied}
      onMarkDeletable={onMarkDeletable}
      onNewCategory={onNewCategory}
      onToggleTodo={onToggleTodo}
      onSnooze={onSnooze}
      gmailAccount={gmailAccount}
    />
  )
}
```

**Step 3 – Verify pass:** `npx tsc --noEmit`. Dev server: category grid looks identical, bulk actions still work.

**Step 4 – Commit:**
```
git add components/CategoryBlock.tsx
git commit -m "refactor: CategoryBlock → thin LabelSection wrapper"
```

---

## Block 3 — Create `BriefingSection` Using `LabelSection`

**Goal:** Extract Daily Briefing from Dashboard.tsx into a component that uses `LabelSection` plus a `children` slot for the future summary paragraph.

**Success Criteria:**
- [ ] `components/BriefingSection.tsx` exists
- [ ] Header uses pink (`#FF1F6E`) accent — same visual as current briefing
- [ ] Select All + bulk actions (Mark read, Archive) work
- [ ] `children` slot renders between header and email list (ready for summary paragraph)
- [ ] All EmailRow props including `onToggleTodo` and `onSnooze` correctly wired
- [ ] Dashboard.tsx Daily Briefing inline block removed

---

### Chunk 3.1 — Create `BriefingSection.tsx`

**Files:** Create `components/BriefingSection.tsx`

**Step 1 – Write failing shell:**
```tsx
// components/BriefingSection.tsx — shell
"use client"
import type { AccountId, Email, Category, Attachment } from "@/lib/types"

interface Props {
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null
  summary?: string
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
}

export default function BriefingSection(_props: Props) { return null }
```

**Step 2 – Verify shell compiles:** `npx tsc --noEmit`

**Step 3 – Implement:**

```tsx
"use client"

import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import LabelSection from "./LabelSection"

interface Props {
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null
  /** Optional AI-generated summary paragraph shown between header and email list */
  summary?: string
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
}

export default function BriefingSection({
  emails, categories, selectedEmail, summary, ...handlers
}: Props) {
  return (
    <LabelSection
      title="DAILY BRIEFING"
      headerBg="#FF1F6E"
      headerTextColor="#FFF5E0"
      border="rgba(255,31,110,0.22)"
      boxShadow="0 4px 28px rgba(255,31,110,0.08)"
      emails={emails}
      categories={categories}
      selectedEmail={selectedEmail}
      bulkActions={[
        { label: "Mark read", handler: async (targets) => { for (const e of targets) await handlers.onMarkRead(e) } },
        { label: "Archive",   handler: async (targets) => { for (const e of targets) await handlers.onArchive(e) } },
      ]}
      {...handlers}
    >
      {/* Summary slot — add AI-generated paragraph here when ready */}
      {summary && (
        <div style={{
          padding: "10px 16px 6px",
          fontSize: "0.84rem",
          lineHeight: 1.55,
          color: "rgba(26,10,53,0.68)",
          borderBottom: "1px solid rgba(26,10,53,0.06)",
        }}>
          {summary}
        </div>
      )}
    </LabelSection>
  )
}
```

**Step 4 – Verify pass:** `npx tsc --noEmit` — zero errors.

**Step 5 – Commit:**
```
git add components/BriefingSection.tsx
git commit -m "feat: add BriefingSection wrapping LabelSection with summary slot"
```

---

### Chunk 3.2 — Wire BriefingSection into Dashboard, remove inline block

**Files:** Modify `components/Dashboard.tsx`

**Step 1 – Write failing test:**
Add import: `import BriefingSection from "./BriefingSection"` and use it with a missing required prop — TS will error.

**Step 2 – Implement:**

1. Add imports:
   ```tsx
   import BriefingSection from "./BriefingSection"
   ```
2. **Delete** the entire `{/* ── Daily Briefing ── */}` inline block (lines ~1382–1449)
3. **Replace** with:
   ```tsx
   {/* ── Daily Briefing ── */}
   {appState === "ready" && briefingEmails.length > 0 && (
     <BriefingSection
       emails={briefingEmails}
       categories={categories}
       selectedEmail={selectedEmail}
       onSelect={email => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
       onExpand={(email, composeMode) => { setExpandedEmail(email); setExpandedComposeMode(composeMode ?? null) }}
       onClose={() => setSelectedEmail(null)}
       onMarkRead={handleMarkRead}
       onArchive={handleArchive}
       onSaveDraft={handleSaveDraft}
       onSend={handleSendMessage}
       onStar={handleStar}
       onDelete={handleDelete}
       onRecategorize={handleRecategorize}
       onMarkReplied={handleMarkReplied}
       onMarkDeletable={handleMarkDeletable}
       onNewCategory={handleNewCategory}
       onToggleTodo={handleToggleTodo}
       onSnooze={email => setSnoozeTarget(email)}
       gmailAccount={activeAccount}
     />
   )}
   ```

**Step 3 – Verify pass:** `npx tsc --noEmit`. Dev server: Daily Briefing renders identically, now has Select All + bulk bar.

**Step 4 – Commit:**
```
git add components/Dashboard.tsx
git commit -m "refactor: replace Daily Briefing inline block with BriefingSection"
```

---

## Block 4 — Merge Delete Candidates into Category Grid + Fix Dashboard Props

**Goal:** Remove the separate Delete Candidates section. Route `deletable: true` emails into a synthetic "🗑️ Delete" CategoryBlock in the grid. Also wire missing `onToggleTodo` and `onSnooze` into CategoryBlock calls in Dashboard.

**Success Criteria:**
- [ ] No separate "DELETE CANDIDATES" section visible
- [ ] Deletable emails appear in a "🗑️ Delete" tile in the category grid
- [ ] CategoryBlock receives `onToggleTodo` and `onSnooze` from Dashboard
- [ ] `npx tsc --noEmit` passes

---

### Chunk 4.1 — Synthetic Delete category + remove Delete Candidates block

**Files:** Modify `components/Dashboard.tsx`, `components/CategoryBlock.tsx`

**Step 1 – Write failing test:**
Add `onToggleTodo` and `onSnooze` to CategoryBlock's `Props` interface as required (done in Block 2 already — verify Dashboard now passes them). Run `npx tsc --noEmit` — will error if Dashboard's CategoryBlock JSX is missing them.

**Step 2 – Implement Dashboard.tsx changes:**

**a)** Just below the `deletableEmails` computed line (~line 196), add:
```tsx
const DELETE_CATEGORY: Category = {
  id: "__delete__",
  name: "🗑️ Delete",
  color: "#888888",
  gmailLabelId: "",
}
```

**b)** In the category grid render, change:
```tsx
{categories.map(cat => (
  <CategoryBlock key={cat.id} category={cat} emails={emails.filter(e => e.category === cat.name)} ... />
))}
```
to:
```tsx
{[
  ...categories,
  ...(deletableEmails.length > 0 ? [DELETE_CATEGORY] : []),
].map(cat => (
  <CategoryBlock
    key={cat.id}
    category={cat}
    categories={categories}
    emails={cat.id === "__delete__"
      ? deletableEmails
      : emails.filter(e => e.category === cat.name)}
    selectedEmail={selectedEmail?.category === cat.name || (cat.id === "__delete__" && selectedEmail?.deletable) ? selectedEmail : null}
    onSelect={email => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
    onExpand={(email, composeMode) => { setExpandedEmail(email); setExpandedComposeMode(composeMode ?? null) }}
    onClose={() => setSelectedEmail(null)}
    onMarkRead={handleMarkRead}
    onArchive={handleArchive}
    onSaveDraft={handleSaveDraft}
    onSend={handleSendMessage}
    onStar={handleStar}
    onDelete={handleDelete}
    onRecategorize={handleRecategorize}
    onMarkReplied={handleMarkReplied}
    onMarkDeletable={handleMarkDeletable}
    onNewCategory={handleNewCategory}
    onToggleTodo={handleToggleTodo}
    onSnooze={email => setSnoozeTarget(email)}
    gmailAccount={activeAccount}
  />
))}
```

**c)** **Delete** the entire `{/* ── Delete candidates ── */}` block (lines ~1484–1524).

**Step 3 – Verify pass:** `npx tsc --noEmit`. Dev server:
- "DELETE CANDIDATES" section gone
- "🗑️ Delete" tile appears in category grid when deletable emails exist
- Bulk delete works inside the tile

**Step 4 – Commit:**
```
git add components/Dashboard.tsx
git commit -m "refactor: merge Delete Candidates into category grid as synthetic LabelSection tile"
```

---

## Technical Debt Strategy

| Debt | Severity | File |
|---|---|---|
| `DELETE_CATEGORY.gmailLabelId = ""` — the Delete tile doesn't apply a real Gmail label. Deletable emails keep their existing Gmail label. Future: call `ensure-label` for "Inbox AI/Delete" at categorization time. | Low | Dashboard.tsx |
| `BriefingSection` spreads `...handlers` to `LabelSection` — if handler prop names diverge in the future, the spread could silently pass wrong props. Consider explicit forwarding if the interface grows. | Low | BriefingSection.tsx |
| `getCategoryAccent()` lives inside CategoryBlock. If another wrapper ever needs it, move to `lib/utils.ts`. | Low (pre-existing) | CategoryBlock.tsx |

Add `DELETE_CATEGORY gmailLabelId` to `BUGS.md` after build.

---

## Execution Order

1. **Chunk 1.1** — Create `LabelSection.tsx` (the shared foundation)
2. **Chunk 2.1** — Refactor `CategoryBlock` to wrap `LabelSection`
3. **Chunk 3.1** — Create `BriefingSection.tsx`
4. **Chunk 3.2** — Wire `BriefingSection` into Dashboard, delete inline block
5. **Chunk 4.1** — Synthetic Delete tile + remove Delete Candidates section

> **Why this order?** `LabelSection` must exist before anything can wrap it. `CategoryBlock` must compile before Dashboard can render the grid. Briefing wiring comes last so the whole app compiles at each step.

---

## Future: Briefing Summary Paragraph

The `summary?: string` prop on `BriefingSection` is already wired. When you're ready to add it:
1. In Dashboard.tsx, add a `briefingSummary` state: `const [briefingSummary, setBriefingSummary] = useState<string | undefined>()`
2. After `runCategorization` resolves, fire a Claude call with the briefingEmails context to generate a 1–2 sentence summary
3. Pass it: `<BriefingSection summary={briefingSummary} ...>`
4. The `children` slot in `LabelSection` renders it between the header and email list — no further component changes needed.

---

Ready to build? Use `/build`.
