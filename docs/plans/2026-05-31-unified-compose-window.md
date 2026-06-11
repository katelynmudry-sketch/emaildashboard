# Plan: Unified Compose Window

**Date**: 2026-05-31  
**Status**: Complete ✓

---

## Header

**Goal**: Replace four separate compose surfaces (`ComposeModal`, inline compose in `EmailModal`, `DraftEditor` in `DetailPanel`, and the compose-in-`DetailPanel`) with a single `ComposeWindow` component.

**Architecture**: Extract a standalone `ComposeWindow` that wraps the existing `ComposeArea` with mode-aware chrome. It supports two presentations (`modal` and `inline`) and three modes (`new`, `reply`, `forward`). AI draft logic, currently duplicated in `EmailModal` and `DetailPanel`, moves into a shared `useAiDraft` hook. After the refactor, `DraftEditor` is deleted entirely.

**Design Patterns**: Adapter pattern — `ComposeWindow` adapts `ComposeArea` to all call sites without changing `ComposeArea` itself.

**Tech Stack**: React, TypeScript, Next.js App Router. No new dependencies.

---

## Current State (the problem)

| Surface | File | Chrome | AI draft logic |
|---|---|---|---|
| New message modal | `ComposeModal.tsx` | Modal + To + Subject | None — new message only |
| Reply/forward in email modal | `EmailModal.tsx` (L363–382) | Inline inside full-screen modal | Duplicated fetch to `/api/ai/draft` |
| Reply/forward in detail panel | `DetailPanel.tsx` (L244–260) | Inline inside card | Duplicated fetch to `/api/ai/draft` |
| `DraftEditor.tsx` | Thin wrapper around `ComposeArea` | Adds a `sent` state | Passed through as a prop |

`ComposeArea.tsx` is the lowest-level body/buttons layer and stays unchanged throughout.

---

## Block 1 — Shared AI Draft Hook

**Goal**: Extract the duplicated AI draft fetch into one place.

**Success Criteria**:
- [ ] `lib/hooks/useAiDraft.ts` exists and exports `useAiDraft`
- [ ] `EmailModal` and `DetailPanel` no longer contain inline `/api/ai/draft` fetch calls
- [ ] Behavior is identical to before

### Chunk 1.1 — Create `useAiDraft` hook

**Files**: Create `lib/hooks/useAiDraft.ts`

The hook encapsulates the two patterns that exist in the codebase:
- "Generate from scratch" — called when opening AI draft mode
- "Regenerate with partial body" — called from inside `ComposeArea` via `onAiDraft`

```ts
// lib/hooks/useAiDraft.ts
"use client"

import { useState } from "react"
import type { AccountId } from "@/lib/types"
import { loadSettings } from "@/lib/settings-storage"
import { recordAction } from "@/lib/stats"

interface EmailContext {
  id: string
  from: string
  fromEmail: string
  subject: string
  body: string
}

export function useAiDraft(emailCtx: EmailContext | null, gmailAccount: AccountId) {
  const [loading, setLoading] = useState(false)

  async function fetchDraft(partialBody?: string): Promise<string> {
    if (!emailCtx) return ""
    const settings = loadSettings()
    const isWork = gmailAccount === "work"
    const customContext = isWork ? settings.workRules : settings.personalRules
    const res = await fetch("/api/ai/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: { from: emailCtx.from, fromEmail: emailCtx.fromEmail, subject: emailCtx.subject, body: emailCtx.body },
        partialDraft: partialBody,
        systemContext: settings.systemContext || undefined,
        customContext: customContext || undefined,
      }),
    })
    const data = await res.json()
    return data.draft ?? ""
  }

  async function generateDraft(onDone: (draft: string) => void) {
    if (!emailCtx) return
    recordAction("aiDraft", { emailId: emailCtx.id, subject: emailCtx.subject, mode: "reply" })
    setLoading(true)
    try {
      const draft = await fetchDraft()
      onDone(draft)
    } finally {
      setLoading(false)
    }
  }

  return { loading, generateDraft, fetchDraft }
}
```

---

## Block 2 — Build `ComposeWindow`

**Goal**: One component that renders the correct chrome for every compose context.

**Success Criteria**:
- [ ] `ComposeWindow` renders correctly in `presentation="modal"` (centered overlay with To + Subject for mode `new`)
- [ ] `ComposeWindow` renders correctly in `presentation="inline"` (no overlay, fits inside a card for mode `reply`/`forward`)
- [ ] AI Draft button works and pre-fills the body in all modes that have an email context
- [ ] Forward mode auto-fills the forwarded message body
- [ ] Esc closes when `presentation="modal"`

### Chunk 2.1 — Create `ComposeWindow`

**Files**: Create `components/ComposeWindow.tsx`

```tsx
// components/ComposeWindow.tsx
"use client"

import { useState, useEffect } from "react"
import type { AccountId, Email, Attachment } from "@/lib/types"
import { useAiDraft } from "@/lib/hooks/useAiDraft"
import ComposeArea from "./ComposeArea"

export type ComposeMode = "new" | "reply" | "forward"
export type ComposePresentation = "modal" | "inline"

interface Props {
  mode: ComposeMode
  presentation: ComposePresentation
  gmailAccount: AccountId
  email?: Email                  // required for reply/forward, undefined for new
  initialBody?: string           // optional pre-fill (used for forward boilerplate)
  onSend: (body: string, attachments: Attachment[], to?: string, subject?: string) => void
  onSaveDraft: (body: string, attachments: Attachment[], to?: string, subject?: string) => Promise<void>
  onClose: () => void
  showUploadButton?: boolean
}

function forwardBody(email: Email): string {
  const subject = email.subject.toLowerCase().startsWith("fwd:")
    ? email.subject
    : `Fwd: ${email.subject}`
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\nSubject: ${subject}\n\n${email.body}`
}

const inputCls =
  "w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"

export default function ComposeWindow({
  mode, presentation, gmailAccount, email, initialBody,
  onSend, onSaveDraft, onClose, showUploadButton,
}: Props) {
  // "new" mode fields
  const [to, setTo]           = useState("")
  const [subject, setSubject] = useState("")

  // body seed for ComposeArea (forward boilerplate or AI draft)
  const [bodyKey, setBodyKey]       = useState(0)   // remount ComposeArea to reset body
  const [seededBody, setSeededBody] = useState<string | undefined>(
    mode === "forward" && email ? forwardBody(email) : initialBody
  )

  const [done, setDone] = useState<"sent" | "draft" | null>(null)

  const emailCtx = email
    ? { id: email.id, from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body }
    : null

  const { loading: aiLoading, generateDraft, fetchDraft } = useAiDraft(emailCtx, gmailAccount)

  // Esc closes modal presentation
  useEffect(() => {
    if (presentation !== "modal") return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [presentation, onClose])

  function handleSend(body: string, attachments: Attachment[]) {
    onSend(body, attachments, to.trim() || undefined, subject.trim() || undefined)
    setDone("sent")
  }

  async function handleSaveDraft(body: string, attachments: Attachment[]) {
    await onSaveDraft(body, attachments, to.trim() || undefined, subject.trim() || undefined)
    setDone("draft")
  }

  function handleAiDraft() {
    generateDraft(draft => {
      setSeededBody(draft)
      setBodyKey(k => k + 1)
    })
  }

  const inner = (
    <div className={presentation === "modal"
      ? "w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      : "border-t border-zinc-100 px-5 py-4"
    }>
      {/* Modal header */}
      {presentation === "modal" && (
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            {mode === "new" ? "New message" : mode === "reply" ? "Reply" : "Forward"}
          </h2>
          <button type="button" onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-lg leading-none" aria-label="Close">
            ✕
          </button>
        </div>
      )}

      <div className={presentation === "modal" ? "p-5 space-y-3" : "space-y-3"}>
        {/* Success banners */}
        {done === "sent" && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            Message sent.
          </p>
        )}
        {done === "draft" && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            Draft saved in Gmail.
          </p>
        )}

        {done === null && (
          <>
            {/* New-message-only fields */}
            {mode === "new" && (
              <>
                <input type="email" value={to} onChange={e => setTo(e.target.value)}
                  placeholder="To" className={inputCls} autoComplete="email" />
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Subject" className={inputCls} />
              </>
            )}

            {/* Reply/forward: AI Draft button above compose area */}
            {mode !== "new" && (
              <div className="flex items-center gap-2 pb-1">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleAiDraft}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75 disabled:opacity-50"
                >
                  {aiLoading ? "Drafting…" : "AI Draft"}
                </button>
              </div>
            )}

            <ComposeArea
              key={bodyKey}
              mode={mode === "new" ? "compose" : mode}
              initialBody={seededBody}
              onAiDraft={mode !== "new" ? fetchDraft : undefined}
              showUploadButton={showUploadButton ?? gmailAccount === "work"}
              onSend={handleSend}
              onSaveDraft={handleSaveDraft}
              onCancel={onClose}
              sendLabel="Send"
              cancelLabel={presentation === "modal" ? "Cancel" : "Discard"}
            />
          </>
        )}

        {done !== null && presentation === "modal" && (
          <button type="button" onClick={onClose}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75">
            Close
          </button>
        )}
      </div>
    </div>
  )

  if (presentation === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        onClick={onClose} role="presentation">
        <div onClick={e => e.stopPropagation()} role="dialog">
          {inner}
        </div>
      </div>
    )
  }

  return inner
}
```

---

## Block 3 — Migrate each call site

**Goal**: Replace all old compose surfaces with `ComposeWindow`. Delete `DraftEditor`.

**Success Criteria**:
- [ ] `ComposeModal` delegates entirely to `ComposeWindow`
- [ ] `EmailModal` compose section replaced with `ComposeWindow presentation="inline"`
- [ ] `DetailPanel` compose section replaced with `ComposeWindow presentation="inline"`
- [ ] `DraftEditor.tsx` deleted
- [ ] No remaining imports of `DraftEditor` anywhere

### Chunk 3.1 — Rewrite `ComposeModal`

**File**: Modify `components/ComposeModal.tsx` (full rewrite — shrinks from 177 → ~35 lines)

```tsx
"use client"

import type { AccountId, Attachment } from "@/lib/types"
import { recordAction } from "@/lib/stats"
import ComposeWindow from "./ComposeWindow"

interface Props {
  open: boolean
  onClose: () => void
  gmailAccount: AccountId
}

export default function ComposeModal({ open, onClose, gmailAccount }: Props) {
  if (!open) return null

  async function handleSend(body: string, attachments: Attachment[], to?: string, subject?: string) {
    if (!to) throw new Error("Recipient email address is required")
    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to, subject: subject || "(no subject)", body, account: gmailAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.error === "string" ? data.error : `Send failed: ${res.status}`)
    }
    recordAction("composeSent", { subject: subject || "(no subject)", details: "new message" })
  }

  async function handleSaveDraft(body: string, attachments: Attachment[], to?: string, subject?: string) {
    if (!to) throw new Error("Recipient email address is required")
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to, subject: subject || "(no subject)", body, account: gmailAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.error === "string" ? data.error : `Draft save failed: ${res.status}`)
    }
    recordAction("saveDraft", { subject: subject || "(no subject)" })
  }

  return (
    <ComposeWindow
      mode="new"
      presentation="modal"
      gmailAccount={gmailAccount}
      onSend={(body, attachments, to, subject) => { void handleSend(body, attachments, to, subject) }}
      onSaveDraft={handleSaveDraft}
      onClose={onClose}
    />
  )
}
```

### Chunk 3.2 — Update `EmailModal` compose section

**File**: Modify `components/EmailModal.tsx`

Replace the `DraftEditor` import with `ComposeWindow` import. Replace the compose section (L363–382) with:

```tsx
{composeMode && (
  <ComposeWindow
    mode={composeMode}
    presentation="inline"
    gmailAccount={gmailAccount}
    email={email}
    onSend={(body, attachments) => {
      onSend(email, composeMode, body, attachments)
      closeCompose()
      onClose()
    }}
    onSaveDraft={async (body, attachments) => {
      await onSaveDraft(email, body, attachments)
      closeCompose()
    }}
    onClose={closeCompose}
  />
)}
```

Also remove: `handleAiDraftInCompose` function (L154–170), `openCompose` AI-draft logic (L126–147), and the `ComposeArea` import. Add `ComposeWindow` import.

The `openCompose` function simplifies — no more AI draft pre-fetch needed since `ComposeWindow` handles it internally:

```tsx
function openCompose(mode: "reply" | "forward") {
  setComposeMode(mode)
}
```

The AI Draft button in the action bar stays, but calls `openCompose("reply")` and lets `ComposeWindow` manage the AI draft button itself. Remove the `aiDraftLoading` state.

### Chunk 3.3 — Update `DetailPanel` compose section

**File**: Modify `components/DetailPanel.tsx`

Remove: `DraftEditor` import, `draftMode` state, `aiDraftBody` state, `aiDraftLoading` state, the inline `/api/ai/draft` fetch block (L278–302).

Replace the `DraftEditor` render (L244–260) with:

```tsx
{draftMode && (
  <ComposeWindow
    mode={draftMode === "forward" ? "forward" : "reply"}
    presentation="inline"
    gmailAccount={gmailAccount}
    email={email}
    onSend={(body, attachments) => {
      onSend(email, draftMode === "forward" ? "forward" : "reply", body, attachments)
      setDraftMode(null)
    }}
    onSaveDraft={async (body, attachments) => {
      await onSaveDraft(email, body, attachments)
      setDraftMode(null)
    }}
    onClose={() => setDraftMode(null)}
  />
)}
```

Simplify the AI Draft button (L278–302) to just:
```tsx
<button onClick={() => setDraftMode("ai")} ...>AI Draft</button>
```
where `draftMode` type becomes `"ai" | "manual" | "forward" | null` → `"reply" | "forward" | null`, and `"ai"` maps to `"reply"` with the AI draft triggered inside `ComposeWindow`.

### Chunk 3.4 — Delete `DraftEditor`

**Files**: 
- Delete `components/DraftEditor.tsx`
- Verify: `grep -r "DraftEditor" components/` returns no results

---

## Block 4 — Smoke-test across all surfaces

**Success Criteria**:
- [ ] Compose new message → modal opens, To + Subject fields visible, send works
- [ ] Reply from EmailModal → inline compose appears, sends and closes modal
- [ ] Forward from EmailModal → inline compose pre-filled with forwarded body
- [ ] AI Draft from EmailModal → clicking "AI Draft" in action bar opens compose pre-filled
- [ ] Reply from DetailPanel → inline compose appears, sends, DraftEditor section disappears
- [ ] AI Draft from DetailPanel → clicking "AI Draft" opens compose, AI Draft button inside ComposeWindow fetches draft

---

## Technical Debt

- `ComposeModal.handleSend` / `handleSaveDraft` still directly hit the Gmail API (unlike reply/forward which go through Dashboard). This is intentional — new messages don't have an email context to route through. Not changing this now.
- `ComposeWindow.onSend` signature adds `to?` and `subject?` params that reply/forward callers always ignore. Minor awkwardness. Could be split into two prop signatures with a discriminated union in a future pass.

---

## Files Changed Summary

| Action | File |
|---|---|
| Create | `lib/hooks/useAiDraft.ts` |
| Create | `components/ComposeWindow.tsx` |
| Rewrite | `components/ComposeModal.tsx` |
| Modify | `components/EmailModal.tsx` |
| Modify | `components/DetailPanel.tsx` |
| Delete | `components/DraftEditor.tsx` |

---

Ready to build? Use `/build`.
