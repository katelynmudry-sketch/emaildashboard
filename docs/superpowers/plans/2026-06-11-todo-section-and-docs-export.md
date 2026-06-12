# TODO Priority Section + Google Docs Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "My To-Dos" category block that always surfaces `email.todo`-flagged emails near the top of the grid, and an optional (beta-toggle) one-way export of newly-flagged TODOs to a user-chosen Google Doc.

**Architecture:** Reuse the existing `DELETE_CATEGORY` pseudo-category pattern in `Dashboard.tsx` for the TODO block — no new component. Add a Google `documents` OAuth scope to the existing NextAuth provider, a new settings fields trio (`todoExportEnabled`, `todoExportDocId`, `todoExportDocName`) in `lib/settings-storage.ts`, a settings UI block in `InstructionsPanel.tsx`, and a new `app/api/docs/append-todo/route.ts` using `googleapis` `docs_v1`. Wire a fire-and-forget call into `handleToggleTodo`.

**Tech Stack:** Next.js App Router, TypeScript, NextAuth v5, `googleapis` (already a dependency), localStorage-based settings.

**Note on testing:** This codebase has no automated test runner (manual `/verify` workflow via `npm run dev`). Each task ends with a manual verification step instead of an automated test run.

---

### Task 1: Add Google Docs OAuth scope

**Files:**
- Modify: `lib/auth.ts:34-43`

- [ ] **Step 1: Add the `documents` scope to the Google provider's scope list**

In `lib/auth.ts`, the `scope` array currently is:

```ts
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
```

Add `"https://www.googleapis.com/auth/documents"` as a new entry after the calendar scope:

```ts
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/documents",
          ].join(" "),
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, sign out and sign back in (since `prompt: "consent"` is already set, this re-triggers the consent screen). Confirm the Google consent screen lists "See, edit, create, and delete your Google Docs documents" and that sign-in still succeeds and the inbox loads normally.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: request Google Docs OAuth scope"
```

---

### Task 2: Add TODO export settings fields

**Files:**
- Modify: `lib/settings-storage.ts:7-21`

- [ ] **Step 1: Extend `InboxSettings` interface and `DEFAULTS`**

Current interface (lines 7-13):

```ts
export interface InboxSettings {
  personalRules: string
  workRules: string
  systemContext: string // overrides CLINIC_CONTEXT if non-empty
  aiPastEventDelete: boolean    // suggest deleting calendar event emails after the event has passed
  aiDeliveryChainCleanup: boolean // suggest deleting shipping emails once a package is delivered
}
```

Replace with:

```ts
export interface InboxSettings {
  personalRules: string
  workRules: string
  systemContext: string // overrides CLINIC_CONTEXT if non-empty
  aiPastEventDelete: boolean    // suggest deleting calendar event emails after the event has passed
  aiDeliveryChainCleanup: boolean // suggest deleting shipping emails once a package is delivered
  todoExportEnabled: boolean  // beta: append TODO-flagged emails to a Google Doc
  todoExportDocId: string     // Google Doc ID to append to
  todoExportDocName: string   // display name shown in settings
}
```

Current `DEFAULTS` (lines 15-21):

```ts
const DEFAULTS: InboxSettings = {
  personalRules: "",
  workRules: "",
  systemContext: "",
  aiPastEventDelete: true,
  aiDeliveryChainCleanup: true,
}
```

Replace with:

```ts
const DEFAULTS: InboxSettings = {
  personalRules: "",
  workRules: "",
  systemContext: "",
  aiPastEventDelete: true,
  aiDeliveryChainCleanup: true,
  todoExportEnabled: false,
  todoExportDocId: "",
  todoExportDocName: "",
}
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open the browser console, run `localStorage.getItem("inbox-ai:settings")` before opening the instructions panel — should be unset or missing the new keys. Open the Instructions panel once (triggers `loadSettings()`), then re-check — `JSON.parse(localStorage.getItem("inbox-ai:settings"))` should NOT yet contain `todoExportEnabled` (settings are only written on save, not on load — confirm this matches current behavior by checking that `personalRules` etc. also aren't written until Save is clicked). This is just a sanity check that nothing crashes; no visible UI change yet.

- [ ] **Step 3: Commit**

```bash
git add lib/settings-storage.ts
git commit -m "feat: add TODO export settings fields"
```

---

### Task 3: Build the Google Docs append API route

**Files:**
- Create: `app/api/docs/append-todo/route.ts`

- [ ] **Step 1: Write the route**

This follows the same auth/error pattern as `app/api/calendar/today/route.ts` (session-based access token, never throws to client) and uses the `docs_v1` client from `googleapis` (already a dependency, used for `calendar` elsewhere).

The Docs API requires knowing the end index of the document body to insert text at the end. `documents.get` returns `body.content`, whose last element's `endIndex` is the insertion point (minus 1, since the final index is reserved for the implicit final newline).

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { google } from "googleapis"

interface AppendTodoBody {
  docId: string
  subject: string
  from: string
  snippet: string
  threadId: string
}

export async function POST(request: Request) {
  const session = await auth()
  const accessToken = session?.access_token
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { docId, subject, from, snippet, threadId }: AppendTodoBody = await request.json()
  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 })
  }

  try {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: accessToken })
    const docs = google.docs({ version: "v1", auth: oauth2 })

    const doc = await docs.documents.get({ documentId: docId })
    const content = doc.data.body?.content ?? []
    const lastElement = content[content.length - 1]
    const endIndex = (lastElement?.endIndex ?? 1) - 1

    const fromName = from.split("<")[0].trim()
    const link = `https://mail.google.com/mail/u/0/#all/${threadId}`
    const line = `• ${subject} — ${fromName} — ${snippet}  (${link})\n`

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: Math.max(endIndex, 1) },
              text: line,
            },
          },
        ],
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[docs/append-todo]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Append failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running and signed in (after Task 1's re-consent), create a test Google Doc, copy its ID from the URL (`https://docs.google.com/document/d/<ID>/edit`), and run from the browser console on the app's origin (so the session cookie is sent):

```js
fetch("/api/docs/append-todo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    docId: "YOUR_DOC_ID",
    subject: "Test TODO",
    from: "Jane Doe <jane@example.com>",
    snippet: "This is a test snippet.",
    threadId: "abc123",
  }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true }`, and the Google Doc now has a new bullet line: `• Test TODO — Jane Doe — This is a test snippet.  (https://mail.google.com/mail/u/0/#all/abc123)`.

- [ ] **Step 3: Commit**

```bash
git add app/api/docs/append-todo/route.ts
git commit -m "feat: add Google Docs TODO append API route"
```

---

### Task 4: Add settings UI for TODO export (beta toggle + doc URL input)

**Files:**
- Modify: `components/InstructionsPanel.tsx`

- [ ] **Step 1: Add state for the new settings fields**

Near the other settings state (around line 112-113, after `aiDeliveryChainCleanup`):

```ts
  const [aiPastEventDelete, setAiPastEventDelete] = useState(true)
  const [aiDeliveryChainCleanup, setAiDeliveryChainCleanup] = useState(true)
```

Add immediately after:

```ts
  const [todoExportEnabled, setTodoExportEnabled] = useState(false)
  const [todoExportDocName, setTodoExportDocName] = useState("")
  const [todoExportUrlInput, setTodoExportUrlInput] = useState("")
  const [todoExportSaveOk, setTodoExportSaveOk] = useState(false)
```

- [ ] **Step 2: Load the new settings on open**

In the `useEffect` that loads settings (around line 147-152):

```ts
        const stored = loadSettings()
        setPersonalText(stored.personalRules)
        setWorkText(stored.workRules)
        setSystemContextText(stored.systemContext || d.systemContext)
        setAiPastEventDelete(stored.aiPastEventDelete !== false)
        setAiDeliveryChainCleanup(stored.aiDeliveryChainCleanup !== false)
```

Add after the last line:

```ts
        setTodoExportEnabled(stored.todoExportEnabled === true)
        setTodoExportDocName(stored.todoExportDocName)
        setTodoExportUrlInput(stored.todoExportDocName ? stored.todoExportDocId : "")
```

- [ ] **Step 3: Add a handler to parse and save the Doc URL**

Add this function near `handleSaveCustomRules` (around line 167-170). It accepts either a full Google Docs URL or a bare doc ID, extracts the ID via regex, and saves it along with a friendly display name (we don't have a Drive API call for the title in v1, so use the ID itself as the display name â€" simple and avoids an extra API call):

```ts
  function handleSaveTodoExportDoc() {
    const input = todoExportUrlInput.trim()
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
    const docId = match ? match[1] : input
    if (!docId) return
    setTodoExportDocName(docId)
    saveSettings({ todoExportDocId: docId, todoExportDocName: docId })
    setTodoExportSaveOk(true)
    setTimeout(() => setTodoExportSaveOk(false), 2500)
  }

  function handleToggleTodoExport() {
    const next = !todoExportEnabled
    setTodoExportEnabled(next)
    saveSettings({ todoExportEnabled: next })
  }
```

- [ ] **Step 4: Add the settings section to the "custom" tab UI**

In the "custom" tab render, after the "AI Actions" block closes (after line 456, the `</div>` that closes the AI Actions card, and before the "Personal inbox rules" `<div>` at line 458), insert a new card following the same visual style as the AI Actions card:

```tsx
              {/* ── TODO Export (beta) ── */}
              <div style={{ background: "rgba(0,196,167,0.04)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(0,196,167,0.12)" }}>
                <SectionLabel color="#00A88A">TODO Export (beta)</SectionLabel>
                <p style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.50)", margin: "0 0 10px", lineHeight: 1.5 }}>
                  When you flag an email as a TODO, append a line to a Google Doc with the subject, sender, and a link back to the email.
                </p>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={handleToggleTodoExport}
                    style={{
                      flexShrink: 0,
                      width: 36, height: 20, borderRadius: 99,
                      background: todoExportEnabled ? "#00C4A7" : "rgba(26,10,53,0.15)",
                      border: "none", cursor: "pointer", padding: 0,
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2,
                      left: todoExportEnabled ? 18 : 2,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                      transition: "left 0.2s",
                      display: "block",
                    }} />
                  </button>
                  <div>
                    <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>Enable TODO export</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>
                      {todoExportDocName ? `Currently exporting to doc: ${todoExportDocName}` : "No doc selected yet — paste a Google Doc link below."}
                    </div>
                  </div>
                </div>
                {todoExportEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={todoExportUrlInput}
                      onChange={e => setTodoExportUrlInput(e.target.value)}
                      placeholder="Paste Google Doc URL or ID"
                      style={{
                        flex: "1 1 240px",
                        borderRadius: 8,
                        border: "1px solid rgba(26,10,53,0.14)",
                        background: "rgba(26,10,53,0.03)",
                        padding: "8px 10px",
                        fontSize: "0.78rem",
                        color: "#1A0A35",
                        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                        outline: "none",
                      }}
                    />
                    <button onClick={handleSaveTodoExportDoc} style={{
                      padding: "8px 18px", borderRadius: 999,
                      background: "#00C4A7", color: "#0D0821", border: "none",
                      fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                      cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                    }}>
                      Save Doc
                    </button>
                    {todoExportSaveOk && <SaveOk show />}
                  </div>
                )}
              </div>
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open the Instructions panel, go to the "custom" tab. Confirm the new "TODO Export (beta)" card renders below "AI Actions". Toggle it on â€" the doc URL input appears. Paste a Google Doc URL (e.g. `https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit`), click "Save Doc" â€" confirm "✓ Saved!" appears and the description updates to "Currently exporting to doc: 1AbCdEfGhIjKlMnOp". Close and reopen the panel â€" confirm the toggle and doc name persist (read from `localStorage`).

- [ ] **Step 6: Commit**

```bash
git add components/InstructionsPanel.tsx
git commit -m "feat: add TODO export settings UI"
```

---

### Task 5: Wire export call into the TODO toggle handler

**Files:**
- Modify: `components/Dashboard.tsx:890-906`
- Modify: top of `components/Dashboard.tsx` (imports)

- [ ] **Step 1: Import `loadSettings`**

Check the top of `components/Dashboard.tsx` for existing imports from `@/lib/settings-storage`. If `loadSettings` is not already imported, add:

```ts
import { loadSettings } from "@/lib/settings-storage"
```

(If `lib/settings-storage` is already imported for another value, add `loadSettings` to that existing import statement instead of creating a duplicate import line.)

- [ ] **Step 2: Add the export call in `handleToggleTodo`**

Current code (lines 890-906... shown through line 904 in exploration, full body shown below for context):

```ts
  function handleToggleTodo(email: Email) {
    const next = !email.todo
    setEmails(prev => {
      const updated = prev.map(e => e.id === email.id ? { ...e, todo: next } : e)
      writeInboxCache(updated, categories)
      return updated
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(prev => prev ? { ...prev, todo: next } : null)
    fetch("/api/gmail/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, value: next, account: activeAccount }),
    })
      .then(r => r.json())
      .then(data => { if (data.labelId) setTodoLabelId(data.labelId) })
```

Add a new block right after the existing `fetch("/api/gmail/todo", ...)` call (after its `.then(...)` chain, still inside the function â€" check the remaining lines of the function for the closing brace/catch before placing this). Insert:

```ts
    if (next) {
      const settings = loadSettings()
      if (settings.todoExportEnabled && settings.todoExportDocId) {
        fetch("/api/docs/append-todo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docId: settings.todoExportDocId,
            subject: email.subject,
            from: email.from,
            snippet: email.snippet,
            threadId: email.threadId,
          }),
        }).catch(() => {})
      }
    }
```

Place this block at the same indentation level as the `fetch("/api/gmail/todo", ...)` call, after it completes (i.e., as a sibling statement within `handleToggleTodo`, not nested inside the `.then()` callbacks).

- [ ] **Step 3: Manual verification**

With export disabled in settings: flag an email as TODO via the ★ button. Confirm in the Network tab that `/api/gmail/todo` fires but `/api/docs/append-todo` does NOT.

Enable export and save a valid doc (Task 4). Flag a different email as TODO. Confirm `/api/docs/append-todo` fires with status 200, and the line appears in the Google Doc with that email's subject/sender/snippet/link.

Un-flag the email (click ★ again to remove TODO). Confirm `/api/docs/append-todo` does NOT fire (one-way export only on the flip to `true`), and the existing line in the Doc remains untouched.

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: export newly-flagged TODOs to Google Doc when enabled"
```

---

### Task 6: Add the "My To-Dos" category block

**Files:**
- Modify: `components/Dashboard.tsx` (near `DELETE_CATEGORY` definition, ~line 341-346)
- Modify: `components/Dashboard.tsx` (grid sort logic, ~lines 1870-1891)

- [ ] **Step 1: Define `TODO_CATEGORY` next to `DELETE_CATEGORY`**

Current code (lines 341-346):

```ts
  const DELETE_CATEGORY: Category = {
    id: "__delete__",
    name: "🗑️ Delete",
    color: "#888888",
    gmailLabelId: "",
  }
```

Add immediately after, a mode-aware TODO category. Since `mode` is in scope in `Dashboard.tsx` (it's the prop driving the whole 3-theme system per `CLAUDE.md`), define the name per-mode:

```ts
  const TODO_CATEGORY: Category = {
    id: "__todo__",
    name: mode === "zen" ? "🪷 To Sit With" : mode === "wabi-sabi" ? "✨ bestie's list" : "📌 My To-Dos",
    color: "#FFD000",
    gmailLabelId: "",
  }
```

- [ ] **Step 2: Insert the TODO block into the sorted grid**

Current sort logic (lines 1870-1891):

```ts
            {appState === "ready" && categories.length > 0 && (() => {
              // Sort: priority at index 1, non-empty first, empty to bottom
              const emailCount = (cat: Category) => emails.filter(e => e.category === cat.name).length
              const priorityCat = categories.find(c => c.name === priorityCategory)
              const nonPriority = categories.filter(c => c.name !== priorityCategory)
              const withEmails = nonPriority.filter(c => emailCount(c) > 0)
              const withoutEmails = nonPriority.filter(c => emailCount(c) === 0)

              let sorted: Category[]
              if (!priorityCat) {
                sorted = [...withEmails, ...withoutEmails]
              } else if (withEmails.length >= 1) {
                sorted = [withEmails[0], priorityCat, ...withEmails.slice(1), ...withoutEmails]
              } else {
                sorted = [priorityCat, ...withoutEmails]
              }

              const allCats: Category[] = [
                ...sorted,
                ...(deletableEmails.length > 0 ? [DELETE_CATEGORY] : []),
              ]
```

Replace with (TODO block is prepended to `sorted` so it lands at index 0, leaving the existing priority-pin-at-index-1 behavior untouched):

```ts
            {appState === "ready" && categories.length > 0 && (() => {
              // Sort: priority at index 1, non-empty first, empty to bottom
              const emailCount = (cat: Category) => emails.filter(e => e.category === cat.name).length
              const priorityCat = categories.find(c => c.name === priorityCategory)
              const nonPriority = categories.filter(c => c.name !== priorityCategory)
              const withEmails = nonPriority.filter(c => emailCount(c) > 0)
              const withoutEmails = nonPriority.filter(c => emailCount(c) === 0)

              let sorted: Category[]
              if (!priorityCat) {
                sorted = [...withEmails, ...withoutEmails]
              } else if (withEmails.length >= 1) {
                sorted = [withEmails[0], priorityCat, ...withEmails.slice(1), ...withoutEmails]
              } else {
                sorted = [priorityCat, ...withoutEmails]
              }

              const todoEmails = emails.filter(e => e.todo)

              const allCats: Category[] = [
                ...(todoEmails.length > 0 ? [TODO_CATEGORY] : []),
                ...sorted,
                ...(deletableEmails.length > 0 ? [DELETE_CATEGORY] : []),
              ]
```

- [ ] **Step 3: Provide the email list and selection for `TODO_CATEGORY` in the map**

Current `CategoryBlock` map (lines 1897-1932) branches on `cat.id === "__delete__"` for `emails` and `selectedEmail`. Current code:

```tsx
                  {allCats.map(cat => (
                    <CategoryBlock
                      key={cat.id}
                      category={cat}
                      categories={categories}
                      mode={mode}
                      emails={cat.id === "__delete__"
                        ? deletableEmails
                        : emails.filter(e => e.category === cat.name)}
                      selectedEmail={
                        cat.id === "__delete__"
                          ? (selectedEmail?.deletable ? selectedEmail : null)
                          : (selectedEmail?.category === cat.name ? selectedEmail : null)
                      }
```

Replace with:

```tsx
                  {allCats.map(cat => (
                    <CategoryBlock
                      key={cat.id}
                      category={cat}
                      categories={categories}
                      mode={mode}
                      emails={
                        cat.id === "__delete__" ? deletableEmails
                        : cat.id === "__todo__" ? todoEmails
                        : emails.filter(e => e.category === cat.name)
                      }
                      selectedEmail={
                        cat.id === "__delete__" ? (selectedEmail?.deletable ? selectedEmail : null)
                        : cat.id === "__todo__" ? (selectedEmail?.todo ? selectedEmail : null)
                        : (selectedEmail?.category === cat.name ? selectedEmail : null)
                      }
```

- [ ] **Step 4: Exclude the priority-pin toggle for the TODO block**

The existing `onTogglePriority` prop (line 1931) is:

```tsx
                      onTogglePriority={cat.id !== "__delete__" ? () => handleTogglePriority(cat.name) : undefined}
```

Replace with:

```tsx
                      onTogglePriority={(cat.id !== "__delete__" && cat.id !== "__todo__") ? () => handleTogglePriority(cat.name) : undefined}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`. With no emails flagged as TODO, confirm the grid looks unchanged (no "My To-Dos" block). Flag one email as TODO via the ★ button â€" confirm a new "📌 My To-Dos" block appears at the top-left of the grid (index 0), containing that email, and that it does NOT show a priority-pin (📌) toggle button. Flag a second email (different category) as TODO â€" confirm both appear in the "My To-Dos" block. Un-flag both â€" confirm the block disappears.

Switch to zen mode and confirm the block is titled "🪷 To Sit With"; switch to wabi-sabi (Basic AF) mode and confirm it's titled "✨ bestie's list". Confirm the block's accent color renders correctly in all 3 modes (uses the same hash-based `getCategoryAccent` as other categories, so any color is acceptable as long as it's themed consistently with other blocks).

- [ ] **Step 6: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: add My To-Dos category block for TODO-flagged emails"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 (To-Dos section) â†' Task 6. Part 2 (Docs export: scope, settings, API, wiring) â†' Tasks 1-5. Beta toggle â†' Task 4. One-way export (no removal on un-flag) â†' Task 5 explicitly gates on `next` (only fires when flipping to `true`).
- **Type consistency:** `InboxSettings.todoExportEnabled/todoExportDocId/todoExportDocName` (Task 2) match the fields read in `InstructionsPanel.tsx` (Task 4) and `Dashboard.tsx` (Task 5). `TODO_CATEGORY.id = "__todo__"` (Task 6) matches the `cat.id === "__todo__"` checks in the same task.
- **Placeholder scan:** No TBDs; all code blocks are complete and copy-pasteable in context.
