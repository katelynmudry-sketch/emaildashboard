# Plan: Shared ComposeArea + File Attachments
**Date:** 2026-05-27  
**Prototype:** `public/prototype_compose_area.html`

---

## Goal
Extract all compose/reply UI into one shared `ComposeArea` component, then add a file attachment button that works consistently across every surface.

## Architecture

There are currently **3 compose surfaces** with **2 separate implementations**. This plan consolidates them:

```
ComposeModal   ──┐
DraftEditor    ──┼──▶  ComposeArea  ──▶  /api/gmail/send (multipart MIME)
EmailModal     ──┘                  └──▶  /api/gmail/draft (multipart MIME)
```

- `ComposeArea` is a pure UI component: textarea, attach strip, file chips, action buttons.
- Callers pass `mode`, `initialBody`, optional `forwardTo` field, and callbacks (`onSend`, `onSaveDraft`, `onCancel`).
- `ComposeModal` is the only surface that additionally needs To/Subject fields — those remain in the modal wrapper, not in `ComposeArea`.
- Attachment MIME encoding lives in `lib/gmail.ts` — UI never touches base64.

## Design Patterns
- **Component Extraction** — pull shared UI out of 3 places into 1
- **Prop delegation** — callers own state they care about; `ComposeArea` owns attachment state internally
- **Boundary at the API** — multipart MIME is built in `lib/gmail.ts`, not in components

## Tech Stack
- Next.js 16, React 19, TypeScript, Tailwind 4
- `googleapis` for Gmail send/draft (already installed)
- Native `File` / `FileReader` API for base64 encoding — no new dependencies

---

## Architecture Explainer (for understanding the app)

### The "Consistency Problem" this plan solves

Before this plan, changes to the compose UX required edits in **3 files**:

| Surface | File | Has own compose code? |
|---|---|---|
| New message | `ComposeModal.tsx` | ✅ Yes — full implementation |
| Inline reply/forward | `DraftEditor.tsx` | ✅ Yes — full implementation |
| Full email view | `EmailModal.tsx` | ✅ Yes — **duplicate** of DraftEditor |

`EmailModal` re-implemented everything DraftEditor does. That's how the forward bug from earlier happened — it was fixed in DraftEditor but the EmailModal path was a separate code path.

### The fix: one source of truth

After this plan, there's one `ComposeArea` component. All three surfaces become thin wrappers around it:
- `DraftEditor` → renders `ComposeArea` with `mode="reply"` or `mode="forward"`
- `EmailModal` → renders `ComposeArea` (replaces its own inline compose code)  
- `ComposeModal` → renders its To/Subject fields, then `ComposeArea` below them

### How to keep things consistent going forward

**The rule:** any UI that appears in a compose/reply/forward box lives in `ComposeArea`. Full stop.

When you want to add something (e.g., a formatting toolbar, a CC field, a "schedule send" option), you add it to `ComposeArea` once and all three surfaces get it automatically.

**Prompt language for AI sessions:**
> "Add X to the ComposeArea component. It should appear in compose, reply, and forward modes."  
> "This change goes in `components/ComposeArea.tsx`, not in individual surface files."

---

## Block 1 — Gmail MIME Layer (backend)
**What:** Update `lib/gmail.ts` to support `multipart/mixed` MIME for attachments.  
**Why first:** UI can't be wired up until the API can receive files.

### Success Criteria
- [ ] `sendEmail` accepts `attachments?: Attachment[]` and builds valid multipart MIME
- [ ] `createDraft` does the same
- [ ] Plain text sends (no attachments) are byte-for-byte identical to current behaviour
- [ ] TypeScript compiles clean

### Chunk 1.1 — Add `Attachment` type
**Files:** Modify `lib/types.ts`

Add to `lib/types.ts`:
```ts
export interface Attachment {
  filename: string
  mimeType: string
  data: string      // base64-encoded file content
  size: number      // bytes
}

// Update DraftRequest to include attachments
export interface DraftRequest {
  to: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
  messageId?: string
  account?: string
  attachments?: Attachment[]   // ← add this
}
```

### Chunk 1.2 — Multipart MIME builder in `lib/gmail.ts`
**Files:** Modify `lib/gmail.ts`

Add a helper `buildMimeMessage` that handles both plain text and multipart/mixed:

```ts
function buildMimeMessage(opts: {
  from?: string
  to: string
  subject: string
  body: string
  inReplyTo?: string
  referencesHeader?: string
  attachments?: Attachment[]
}): string {
  if (!opts.attachments?.length) {
    // existing plain-text path — no change
    return [
      opts.from ? `From: ${opts.from}` : null,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `MIME-Version: 1.0`,
      opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
      opts.referencesHeader ? `References: ${opts.referencesHeader}` : null,
      "",
      opts.body,
    ].filter(Boolean).join("\r\n")
  }

  const boundary = `inbox_ai_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const parts: string[] = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    "",
    opts.body,
  ]
  for (const att of opts.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      att.data,  // already base64
    )
  }
  parts.push(`--${boundary}--`)

  return [
    opts.from ? `From: ${opts.from}` : null,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.referencesHeader ? `References: ${opts.referencesHeader}` : null,
    "",
    ...parts,
  ].filter(Boolean).join("\r\n")
}
```

Then update `sendEmail` and `createDraft` to use `buildMimeMessage` and accept `attachments?:`.

---

## Block 2 — `ComposeArea` Component
**What:** Create `components/ComposeArea.tsx` — the single shared compose UI.

### Success Criteria
- [ ] Renders textarea, attach strip, file chips, action buttons
- [ ] File picker opens on "Attach file" click
- [ ] Chips show filename, size, remove button
- [ ] Warns visually at >10 MB total, errors at >25 MB
- [ ] Disabled state prevents send when >25 MB
- [ ] `mode="forward"` shows a To field; `mode="reply"` and `mode="compose"` don't
- [ ] Matches the prototype at `public/prototype_compose_area.html`

### Chunk 2.1 — Create `components/ComposeArea.tsx`

**Props interface:**
```ts
interface ComposeAreaProps {
  mode: "reply" | "forward" | "compose"
  initialBody?: string
  // For forward mode
  initialForwardTo?: string
  // Callbacks
  onSend: (body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSaveDraft: (body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onCancel: () => void
  // Optional AI draft (reply only)
  onAiDraft?: () => Promise<string>
  // Controlled state for AI drafting loading
  aiDraftLoading?: boolean
  // Labels
  sendLabel?: string    // default "Send"
  cancelLabel?: string  // default "Cancel"
}
```

**Internal state:**
- `body: string` — initialized from `initialBody`
- `forwardTo: string` — initialized from `initialForwardTo ?? ""`
- `attachments: AttachmentLocal[]` — `{ file: File, base64: string, id: string }`
- `encoding: boolean` — true while FileReader is running
- `sending / saving: boolean`
- `error: string | null`

**Key behaviors:**
- File input is a hidden `<input type="file" multiple>` triggered by the attach button
- `FileReader.readAsDataURL` → strip the `data:...;base64,` prefix → store raw base64
- Total size = sum of all `file.size` → disable send if > 25 MB
- `onSend` receives `(body, attachments, forwardTo?)` — parent calls the API

### Chunk 2.2 — Visual design (matching prototype)

Attach strip layout (between textarea and action buttons):
```
┌─────────────────────────────────────────────────────────────┐
│ 📎 Attach file  │  [chip: invoice.pdf 124KB ×]  [chip ×]   │
└─────────────────────────────────────────────────────────────┘
```
- Strip has `border: 1px dashed` when empty, `border: 1px solid` when chips present
- Chips: `bg-violet-50 border-violet-200 rounded-full` with paperclip emoji prefix
- Size warning chip: amber border/bg
- Size error chip: rose border/bg (+ send disabled)

---

## Block 3 — Wire `DraftEditor` → `ComposeArea`
**What:** Replace `DraftEditor`'s textarea + buttons with `<ComposeArea>`.  
**Impact:** `DetailPanel` and `CategoryBlock` (which use `DraftEditor`) get attachments for free.

### Success Criteria
- [ ] `DraftEditor` renders `ComposeArea` and forwards callbacks
- [ ] Attachment data flows to `onSaveDraft` and `onSend` callbacks
- [ ] `Dashboard.handleSaveDraft` and `handleSendMessage` accept `attachments?`
- [ ] `/api/gmail/send` and `/api/gmail/draft` pass attachments to `lib/gmail.ts`

### Chunk 3.1 — Update `DraftEditor` to use `ComposeArea`
`DraftEditor` becomes a thin wrapper that maps its existing props to `ComposeArea` props:
- `mode="reply"` → `ComposeArea mode="reply"` (no forwardTo field)
- `mode="forward"` → `ComposeArea mode="forward"` (shows forwardTo field)
- `onAiDraft` wired up for reply mode
- All callbacks updated to receive `attachments`

### Chunk 3.2 — Update `Dashboard.handleSaveDraft` + `handleSendMessage`
Add `attachments?: Attachment[]` parameter to both functions and pass through to API.

### Chunk 3.3 — Update `/api/gmail/send` and `/api/gmail/draft` routes
Both routes already destructure the request body. Add `attachments` to the destructure and pass to `lib/gmail.ts`.

---

## Block 4 — Wire `EmailModal` → `ComposeArea`
**What:** Replace `EmailModal`'s own inline compose code with `<ComposeArea>`.

### Success Criteria
- [ ] `EmailModal` no longer has `draftBody`, `forwardTo`, `composeMode`, `sending`, `savingDraft` state (moved into `ComposeArea`)
- [ ] Forward and reply modes both work
- [ ] Attachments work in EmailModal

### Chunk 4.1 — Replace EmailModal inline compose
`EmailModal` keeps its own state for which mode is open (`composeMode: "reply" | "forward" | null`), but delegates the actual compose UI to `ComposeArea`. Remove ~80 lines of duplicate state/handlers.

---

## Block 5 — Wire `ComposeModal` → `ComposeArea`
**What:** `ComposeModal` keeps its To/Subject fields, replaces its textarea + buttons with `ComposeArea`.

### Success Criteria
- [ ] ComposeModal renders To + Subject above `ComposeArea`
- [ ] Attachments work for new messages

### Chunk 5.1 — Update `ComposeModal`
`ComposeArea` receives `mode="compose"` (no forwardTo field shown). `ComposeModal` owns `to` and `subject` state, passes them to the API call. On `onSend`, calls `/api/gmail/send` with `{ to, subject, body, attachments }`.

---

## Technical Debt

| Item | Risk | File | Notes |
|---|---|---|---|
| `email.body` is truncated to 2000 chars in `lib/gmail.ts:76` | Medium | `lib/gmail.ts` | Forwarded messages could be cut off. Tracked separately. |
| No attachment size check server-side | Low | `/api/gmail/send` | Current client check (25 MB) is sufficient; Gmail itself will reject oversized requests anyway. |
| `FileReader` is synchronous per file; large attachments may stall UI briefly | Low | `ComposeArea` | Can be improved with `Promise.all` if needed. |

---

## File Change Summary

| File | Change |
|---|---|
| `lib/types.ts` | Add `Attachment` type; update `DraftRequest` |
| `lib/gmail.ts` | Add `buildMimeMessage`; update `sendEmail`, `createDraft` |
| `app/api/gmail/send/route.ts` | Accept `attachments` in body |
| `app/api/gmail/draft/route.ts` | Accept `attachments` in body |
| `components/ComposeArea.tsx` | **New** — shared compose UI |
| `components/DraftEditor.tsx` | Replace internals with `<ComposeArea>` |
| `components/EmailModal.tsx` | Replace inline compose with `<ComposeArea>` |
| `components/ComposeModal.tsx` | Replace textarea+buttons with `<ComposeArea>` |
| `components/Dashboard.tsx` | Update `handleSaveDraft`, `handleSendMessage` signatures |
| `components/CategoryBlock.tsx` | Update `onSaveDraft` prop type |
| `components/DetailPanel.tsx` | Update `onSaveDraft` prop type |

---

Ready to build? Use `/build`.
