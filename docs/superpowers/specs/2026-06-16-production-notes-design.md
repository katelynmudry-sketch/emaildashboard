# Production Notes Band — Design Spec
**Date:** 2026-06-16  
**Status:** Approved

---

## Overview

A status band inserted between the `<PlantHeader>` header and the mode/settings selector row in `Dashboard.tsx`. It serves two purposes:

1. **Admin broadcast** — Katelyn posts current issues and upcoming work visible to all users.
2. **User feedback** — Any logged-in user can send a comment/bug report directly to Katelyn's Gmail.

---

## UI Layout

The band is a new component: `components/ProductionNotesBand.tsx`.

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Production Notes                                    [✏️ admin]│
│  ─────────────────────────────────────────────────────────────  │
│  ⚠️ Current                      🔭 Coming next                  │
│  <issues text>                  <next text>                      │
│                                                                  │
│  ▼ Leave a note                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Your message…                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│  [Send note]                                                     │
└─────────────────────────────────────────────────────────────────┘
```

- Two columns: **Current issues** (left) and **Coming next** (right)
- Collapsible comment form below, toggled by "Leave a note" disclosure
- Pencil edit icon visible only to the admin (`katelynmudry@gmail.com`)

---

## Data Model

Notes are stored as a single JSON object in **Vercel KV**:

```ts
type ProductionNotes = {
  issues: string   // free text, markdown-lite OK
  next: string     // free text
  updatedAt: string // ISO timestamp
}
```

Default value when KV is empty:
```json
{ "issues": "All good!", "next": "More features coming soon.", "updatedAt": "" }
```

---

## API Routes

### `GET /api/notes`
- Public (any authenticated session).
- Reads `production-notes` key from Vercel KV.
- Returns `ProductionNotes` JSON.

### `POST /api/notes`
- **Admin only** — returns 403 if `session.user.email !== "katelynmudry@gmail.com"`.
- Body: `{ issues: string, next: string }`
- Writes to KV, sets `updatedAt` to `new Date().toISOString()`.
- Returns updated `ProductionNotes`.

### `POST /api/feedback`
- Requires authenticated session (any user).
- Body: `{ message: string }`
- Calls existing `sendEmail()` from `lib/gmail` using the session user's Gmail OAuth token.
- `to`: `katelynmudry@gmail.com`
- `subject`: `[Email Party Feedback] ${message.slice(0, 60)}`
- `body`: message + footer with sender email + timestamp.
- Returns `{ ok: true }` or error.

---

## New Files

| File | Purpose |
|---|---|
| `app/api/notes/route.ts` | GET + POST for KV read/write |
| `app/api/feedback/route.ts` | POST — sends comment via user's Gmail |
| `lib/production-notes.ts` | KV helpers: `getNotes()`, `saveNotes()` |
| `components/ProductionNotesBand.tsx` | Full UI component |

---

## Admin Edit Mode

When `session.user.email === "katelynmudry@gmail.com"`:
- A pencil (✏️) icon appears in the band header.
- Clicking it replaces both text sections with `<textarea>` fields.
- A **Save** button POSTs to `/api/notes` and exits edit mode on success.
- A **Cancel** button discards changes and exits edit mode.
- Optimistic UI: the new text shows immediately, reverts on error.

Non-admin users never see the edit controls.

---

## Comment Form

- A disclosure toggle ("Leave a note ▾") expands a textarea.
- Textarea placeholder is theme-aware (see below).
- **Send note** button calls `POST /api/feedback`.
- On success: textarea clears, shows inline confirmation message for 3 seconds.
- On error: shows inline error message.
- Button is disabled while submitting.
- Empty submissions are blocked client-side.

---

## Theme Support

All 3 modes define their own copy and color. Pattern follows existing Dashboard.tsx conventions.

| Element | Party 🎉 | Zen 🧘 | Basic AF ☕ |
|---|---|---|---|
| Section header | "📋 What's the tea" | "Current notes" | "📋 What's happening" |
| Issues label | "⚠️ Known issues" | "Things to hold lightly" | "⚠️ Current issues" |
| Next label | "🔭 Coming soon!!" | "What's unfolding" | "🔭 What's next" |
| Form placeholder | "Drop your thoughts, bestie 🎉" | "Share what you noticed…" | "Leave a note, literally 💅" |
| Send button | "Send it!!" | "Send" | "Send note ✨" |
| Success message | "Sent!! 🎉" | "Received. Thank you." | "Sent! You're literally the best 💕" |

Band background and border follow existing `pageBg` / `ambientGlow` tokens from Dashboard.tsx.

---

## Slot in Dashboard.tsx

```tsx
// Between PlantHeader and the mode selector row
<PlantHeader ... />
<ProductionNotesBand mode={mode} />
{/* mode selector / settings row */}
```

The band fetches its own data (notes from `/api/notes`) on mount — no new props needed beyond `mode`.

---

## Dependencies

- `@vercel/kv` — Vercel KV client (add to package.json). Requires `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars set in Vercel dashboard and `.env.local`.
- No other new dependencies.

---

## Out of Scope

- Rich text / markdown rendering for notes (plain text only for now).
- Email notifications when Katelyn replies to feedback.
- Per-user feedback history or threading.
