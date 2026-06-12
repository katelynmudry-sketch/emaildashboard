# One-Click Unsubscribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Unsubscribe" button to the email action bar that performs a true RFC 8058 one-click unsubscribe (server-side POST to the sender's `List-Unsubscribe` URL) and auto-archives the email on success — shown only for emails that support it.

**Architecture:** Extract `List-Unsubscribe` / `List-Unsubscribe-Post` headers during message parsing in `lib/gmail.ts`, expose `unsubscribeUrl` / `unsubscribeOneClick` on the `Email`/`RawEmail` types, add a new `/api/gmail/unsubscribe` route that performs the POST server-side (same auth pattern as `/api/gmail/archive`), and add a button to `EmailModal.tsx` and `DetailPanel.tsx` action bars that calls it and then archives via the existing `onArchive` handler.

**Tech Stack:** Next.js App Router, TypeScript, NextAuth session, Gmail API (`googleapis`)

No automated test framework exists in this repo (no `*.test.*` files, no test script in `package.json`). All verification below is manual (dev server + real inbox data).

---

### Task 1: Add header parsing for List-Unsubscribe

**Files:**
- Modify: `lib/gmail.ts`

- [ ] **Step 1: Add `parseListUnsubscribe` helper**

Add this new function right after `getHeader` (around line 75, after the closing brace of `getHeader`):

```ts
function parseListUnsubscribe(headers: { name?: string | null; value?: string | null }[]): {
  unsubscribeUrl?: string
  unsubscribeOneClick: boolean
} {
  const raw = getHeader(headers, "list-unsubscribe")
  if (!raw) return { unsubscribeOneClick: false }

  const httpsMatch = raw.match(/<(https:\/\/[^>]+)>/i)
  const unsubscribeUrl = httpsMatch?.[1]
  if (!unsubscribeUrl) return { unsubscribeOneClick: false }

  const post = getHeader(headers, "list-unsubscribe-post")
  const oneClick = /one-click/i.test(post)

  return { unsubscribeUrl, unsubscribeOneClick: oneClick }
}
```

- [ ] **Step 2: Call it from `parseMessage` and include the result in `RawEmail`**

In `parseMessage()` (around line 175-203), add a call to `parseListUnsubscribe` and spread its result into the returned object:

```ts
export function parseMessage(msg: any): RawEmail {
  const headers: { name?: string | null; value?: string | null }[] = msg.payload?.headers ?? []
  const body = extractPlainText(msg.payload).slice(0, 2000)
  const htmlBody = extractHtmlBody(msg.payload)
  const attachments = extractAttachments(msg.payload)
  const fromRaw = getHeader(headers, "from")
  // Extract display name vs email
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/)
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromRaw
  const fromEmail = fromMatch ? fromMatch[2] : fromRaw
  const { unsubscribeUrl, unsubscribeOneClick } = parseListUnsubscribe(headers)

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: fromName,
    fromEmail,
    to: getHeader(headers, "to"),
    subject: getHeader(headers, "subject") || "(no subject)",
    snippet: sanitizeString(msg.snippet ?? ""),
    body,
    htmlBody: htmlBody || undefined,
    date: new Date(parseInt(msg.internalDate)).toISOString(),
    internalDate: parseInt(msg.internalDate),
    inReplyTo: getHeader(headers, "in-reply-to") || undefined,
    messageId: getHeader(headers, "message-id") || undefined,
    labelIds: msg.labelIds ?? [],
    attachments: attachments.length > 0 ? attachments : undefined,
    unsubscribeUrl,
    unsubscribeOneClick,
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

This will fail until Task 2 adds the fields to `RawEmail`. Skip running the build until after Task 2 — just save the file for now.

- [ ] **Step 4: Commit (combined with Task 2)**

No commit yet — continue to Task 2, then commit both together.

---

### Task 2: Add new fields to `RawEmail` and `Email` types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add fields to `RawEmail`**

In the `RawEmail` interface (around line 35-51), add the two new optional fields after `attachments`:

```ts
export interface RawEmail {
  id: string
  threadId: string
  from: string
  fromEmail: string
  to: string
  subject: string
  snippet: string
  body: string          // plain text, truncated to 2000 chars
  htmlBody?: string     // full HTML body for rendering
  date: string          // ISO string
  internalDate: number  // ms timestamp for sorting
  inReplyTo?: string
  messageId?: string    // RFC 2822 Message-ID header
  labelIds: string[]
  attachments?: EmailAttachment[]
  unsubscribeUrl?: string        // https URL from List-Unsubscribe header
  unsubscribeOneClick?: boolean  // true only if List-Unsubscribe-Post: List-Unsubscribe=One-Click is also present
}
```

- [ ] **Step 2: Add the same fields to `Email`**

In the `Email` interface (around line 53-68), add the same two fields after `attachments`:

```ts
export interface Email {
  id: string
  threadId: string
  from: string          // display name only
  fromEmail: string
  to: string
  subject: string
  snippet: string
  body: string
  htmlBody?: string
  date: string
  internalDate: number
  inReplyTo?: string
  messageId?: string
  labelIds: string[]
  attachments?: EmailAttachment[]
  unsubscribeUrl?: string
  unsubscribeOneClick?: boolean
  // ... (rest of existing fields below unchanged)
```

Note: only add the two new lines — do not reorder or remove any existing fields below `attachments` in `Email` (category, priority, summary, AI fields, etc.).

- [ ] **Step 3: Add `UnsubscribeRequest` type**

Near `ArchiveRequest` / `ReadRequest` (around line 136-144), add:

```ts
export interface UnsubscribeRequest {
  unsubscribeUrl: string
  account?: AccountId
}
```

- [ ] **Step 4: Run the TypeScript build to confirm Task 1 + Task 2 compile cleanly**

Run: `npm run build`
Expected: build succeeds (no type errors related to `unsubscribeUrl`/`unsubscribeOneClick`/`UnsubscribeRequest`).

- [ ] **Step 5: Commit**

```bash
git add lib/gmail.ts lib/types.ts
git commit -m "feat: extract List-Unsubscribe headers during message parsing"
```

---

### Task 3: Add `/api/gmail/unsubscribe` API route

**Files:**
- Create: `app/api/gmail/unsubscribe/route.ts`

- [ ] **Step 1: Create the route file**

Mirror `app/api/gmail/archive/route.ts`'s structure exactly:

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { UnsubscribeRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { unsubscribeUrl, account }: UnsubscribeRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const res = await fetch(unsubscribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Sender returned ${res.status}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unsubscribe failed" }, { status: 500 })
  }
}
```

Note: `requireGmailAccess` is called for auth/session validation consistency with other
routes, even though `authz.accessToken` isn't used in the POST itself (the unsubscribe
URL is a public sender endpoint, not a Gmail API call).

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: build succeeds, new route appears in the route list output.

- [ ] **Step 3: Commit**

```bash
git add app/api/gmail/unsubscribe/route.ts
git commit -m "feat: add one-click unsubscribe API route"
```

---

### Task 4: Add Unsubscribe button to `EmailModal.tsx`

**Files:**
- Modify: `components/EmailModal.tsx`

- [ ] **Step 1: Add unsubscribe state**

In the component body, near the other `useState` declarations (around line 59-67), add:

```ts
const [unsubState, setUnsubState] = useState<"idle" | "loading" | "done">("idle")
```

- [ ] **Step 2: Add the `handleUnsubscribe` function**

Add this near `handleDownloadAttachment`/`downloadAllAttachments` (around line 130-144):

```ts
async function handleUnsubscribe() {
  if (!email.unsubscribeUrl) return
  setUnsubState("loading")
  try {
    const res = await fetch("/api/gmail/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribeUrl: email.unsubscribeUrl, account: gmailAccount }),
    })
    if (!res.ok) throw new Error()
    setUnsubState("done")
    onArchive(email)
    onClose()
  } catch {
    setUnsubState("idle")
  }
}
```

- [ ] **Step 3: Add the button to the action bar**

In the action bar (around line 171-191), add the button after the Delete button and
before the TODO toggle:

```tsx
<button onClick={() => { onArchive(email); onClose() }} className={`${btn} text-zinc-900 font-semibold`}>Archive</button>
<button onClick={() => onStar(email)} className={btn}>Star</button>
<button onClick={() => { onDelete(email); onClose() }} className={`${btn} text-rose-600`}>Delete</button>
{email.unsubscribeOneClick && email.unsubscribeUrl && (
  <button
    onClick={handleUnsubscribe}
    disabled={unsubState !== "idle"}
    className={`${btn} disabled:opacity-50`}
  >
    {unsubState === "loading" ? "Unsubscribing…" : unsubState === "done" ? "Unsubscribed ✓" : "Unsubscribe"}
  </button>
)}
{onToggleTodo && (
```

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/EmailModal.tsx
git commit -m "feat: add one-click unsubscribe button to email modal"
```

---

### Task 5: Add Unsubscribe button to `DetailPanel.tsx`

**Files:**
- Modify: `components/DetailPanel.tsx`

- [ ] **Step 1: Add unsubscribe state**

Near the other `useState` declarations (around line 45, alongside `archiving`/`archived`), add:

```ts
const [unsubState, setUnsubState] = useState<"idle" | "loading" | "done">("idle")
```

- [ ] **Step 2: Add the `handleUnsubscribe` function**

Add this near `handleArchive` (around line 123-128):

```ts
async function handleUnsubscribe() {
  if (!email.unsubscribeUrl) return
  setUnsubState("loading")
  try {
    const res = await fetch("/api/gmail/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribeUrl: email.unsubscribeUrl, account: gmailAccount }),
    })
    if (!res.ok) throw new Error()
    setUnsubState("done")
    handleArchive()
  } catch {
    setUnsubState("idle")
  }
}
```

- [ ] **Step 3: Add the button to the action bar**

In the actions block (around line 294-350), add the button after Delete:

```tsx
<button
  onClick={() => {
    onDelete(email)
    setDeleting(false)
  }}
  disabled={deleting}
  className={`${btnBase} text-rose-600 disabled:opacity-50`}
>
  {deleting ? "…" : "Delete"}
</button>
{email.unsubscribeOneClick && email.unsubscribeUrl && (
  <button
    onClick={handleUnsubscribe}
    disabled={unsubState !== "idle"}
    className={`${btnBase} disabled:opacity-50`}
  >
    {unsubState === "loading" ? "Unsubscribing…" : unsubState === "done" ? "Unsubscribed ✓" : "Unsubscribe"}
  </button>
)}
```

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add components/DetailPanel.tsx
git commit -m "feat: add one-click unsubscribe button to detail panel"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Find a qualifying email**

Load the inbox and open a newsletter/marketing email likely to send RFC 8058 headers
(e.g. Substack, Medium, a SaaS product newsletter). Open it in both the modal
(EmailModal) and the side panel (DetailPanel) view.

- [ ] **Step 3: Confirm button visibility rules**

- Confirm the "Unsubscribe" button appears for the qualifying email in both views.
- Open a personal/1:1 email (no `List-Unsubscribe` header) and confirm the button does
  NOT appear there.
- If an email has only a body-scraped unsubscribe link (no header), confirm the
  existing rose banner in EmailModal still appears as before, and the new action-bar
  button does not.

- [ ] **Step 4: Test the happy path**

Click "Unsubscribe" on a qualifying email. Confirm:
- Button shows "Unsubscribing…" then briefly "Unsubscribed ✓".
- The email is archived (modal closes / row disappears from the category list), same
  as clicking "Archive" would do.

- [ ] **Step 5: Test the failure path**

Temporarily edit `handleUnsubscribe` in `EmailModal.tsx` to point at an invalid URL
(e.g. `"https://example.com/this-will-404"`) instead of `email.unsubscribeUrl`, reload,
and click Unsubscribe. Confirm:
- The button returns to "Unsubscribe" (not stuck on "Unsubscribing…").
- The email is NOT archived.

Revert the temporary edit afterward (`git checkout components/EmailModal.tsx` if no
other uncommitted changes are in that file, or manually restore the line).

- [ ] **Step 6: Final check — no leftover debug edits**

Run: `git status`
Expected: clean working tree (all changes already committed in Tasks 1-5, and the
temporary failure-path edit from Step 5 has been reverted).
