# One-Click Unsubscribe Button — Design

## Context

The app already has a lightweight "unsubscribe" feature: `EmailModal.tsx` scrapes the
HTML/plain-text body for a link containing "unsubscribe" and shows a dismissible rose
banner with that link. This works, but it's a guess-based regex over rendered content,
and it requires the user to leave the app, land on the sender's unsubscribe page, and
often click through another confirmation.

Many newsletter/marketing emails instead support **RFC 8058 "one-click unsubscribe"** —
the same mechanism Gmail's own native "Unsubscribe" button next to the sender uses. The
sender includes two headers:

```
List-Unsubscribe: <https://example.com/unsub?id=abc123>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

When both are present, a client can unsubscribe with a single server-side `POST` to that
URL — no page visit, no second confirmation. Since the app already fetches messages with
`format: "full"` (lib/gmail.ts `fetchInboxMessages`), these headers are already present
in the raw Gmail payload — they're just not extracted yet.

This feature adds a real "Unsubscribe" button to the email action bar (next to Mark
read / Archive / Star / etc.) that appears **only** when an email qualifies for true
one-click unsubscribe, performs the POST server-side, and auto-archives the email on
success. The existing body-scraped banner is unchanged and continues to serve as the
fallback for emails that don't have proper one-click headers.

## Scope

- Extract `List-Unsubscribe` and `List-Unsubscribe-Post` headers during message parsing.
- Add a new API route that performs the one-click POST server-side.
- Add an "Unsubscribe" button to the action bars in `EmailModal.tsx` and
  `DetailPanel.tsx`, shown only when one-click is available.
- On success, auto-archive the email via the existing `onArchive` handler.
- Out of scope: the existing body-scraped banner (no changes), mailto:-based
  unsubscribe, bulk/inbox-wide unsubscribe management.

## 1. Header extraction (`lib/gmail.ts`)

Add a helper to parse the `List-Unsubscribe` header value. It's a comma-separated list
of angle-bracket-wrapped URIs, e.g. `<mailto:x@y.com>, <https://example.com/unsub?id=1>`.

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

In `parseMessage()`, call this and spread the result into the returned `RawEmail`:

```ts
const { unsubscribeUrl, unsubscribeOneClick } = parseListUnsubscribe(headers)
return {
  ...,
  unsubscribeUrl,
  unsubscribeOneClick,
}
```

## 2. Types (`lib/types.ts`)

Add to both `RawEmail` and `Email`:

```ts
unsubscribeUrl?: string        // https URL from List-Unsubscribe header
unsubscribeOneClick?: boolean  // true only if List-Unsubscribe-Post: List-Unsubscribe=One-Click is also present
```

## 3. New API route — `app/api/gmail/unsubscribe/route.ts`

Follows the same shape as `app/api/gmail/archive/route.ts`: `auth()` →
`requireGmailAccess()` → perform action → return `{ ok: true }` or error.

```ts
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

Add `UnsubscribeRequest` to `lib/types.ts`:

```ts
export interface UnsubscribeRequest {
  unsubscribeUrl: string
  account?: AccountId
}
```

`unsubscribeUrl` is not validated against an allowlist — it's a server's own published
header from a message the user has open, sent only as a `POST` with the fixed RFC body,
not used to read or proxy arbitrary responses back to the client.

## 4. UI — action bar button

**`EmailModal.tsx`** and **`DetailPanel.tsx`**: add an "Unsubscribe" button to the
existing action bar (next to Star/Delete), rendered only when
`email.unsubscribeOneClick && email.unsubscribeUrl`.

Button has 3 states: idle ("Unsubscribe"), in-flight ("Unsubscribing…", disabled), and
done ("Unsubscribed ✓", disabled). On click:

```tsx
async function handleUnsubscribe() {
  setUnsubState("loading")
  try {
    const res = await fetch("/api/gmail/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribeUrl: email.unsubscribeUrl, account: gmailAccount }),
    })
    if (!res.ok) throw new Error()
    setUnsubState("done")
    onArchive(email)   // existing handler — also closes the modal in EmailModal
  } catch {
    setUnsubState("idle")
  }
}
```

In `EmailModal.tsx`, `onArchive(email)` is currently always paired with `onClose()`
(see line 173) — do the same here so the modal closes after a successful unsubscribe,
consistent with the existing archive button.

The button styling reuses the existing `btn` / `btnBase` classes (no new theme variants
needed — these action bars are not `PartyMode`-aware).

## Testing / Verification

- Find a real newsletter email with `List-Unsubscribe` + `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click` headers (most marketing senders — e.g. Substack,
  Medium). Confirm the button appears in both EmailModal and DetailPanel.
- Confirm an email *without* these headers (e.g. a personal email) does not show the
  button, and the existing body-scraped banner still works for emails that have a
  plain unsubscribe link in the body but no header.
- Click Unsubscribe: verify the POST request goes out, the button shows
  "Unsubscribing…" then the email is archived (modal closes / row disappears from
  list).
- Test failure path: temporarily point `unsubscribeUrl` at a URL that returns a
  non-2xx, confirm the button resets to "Unsubscribe" and the email is *not*
  archived.
