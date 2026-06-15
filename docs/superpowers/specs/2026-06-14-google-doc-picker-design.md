# Google Doc Picker for TODO Export

## Problem

The TODO Export settings (Personal/Work) currently require the user to paste a
Google Doc URL/ID into a text field, and the app authenticates with the broad
`https://www.googleapis.com/auth/documents` scope — which Google's consent
screen describes as full access to create/delete/organize/share *all* of the
user's Google Docs.

## Goal

Narrow the OAuth scope to `https://www.googleapis.com/auth/drive.file`
(per-file access, granted only to files the app creates or the user
explicitly picks), and replace the paste-a-URL UI with a Google Picker /
"create new doc" flow.

## Changes

### 1. Auth scope (`lib/auth.ts`)

Replace `https://www.googleapis.com/auth/documents` with
`https://www.googleapis.com/auth/drive.file` in the Google provider's scope
list. `prompt: "consent"` is already set, so no other auth plumbing changes.

**Migration**: existing sessions won't have `drive.file` until the user
re-authenticates. Previously-configured doc IDs (selected under the old
`documents` scope) will not be accessible under `drive.file` — the user must
re-pick/re-create via the new UI after reconnecting.

### 2. Picker client utility (`lib/google-picker.ts`)

- Lazily loads the Google Picker JS (`https://apis.google.com/js/api.js`,
  `gapi.load('picker', ...)`).
- Exports `openDocPicker(accessToken: string, apiKey: string): Promise<{ id: string; name: string } | null>`
  — builds a `PickerBuilder` with `ViewId.DOCUMENTS` (Google Docs only),
  the given OAuth access token, and the Picker API key. Resolves with the
  selected file's `{ id, name }`, or `null` if the user cancels.

New env var: `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` (Picker API key, HTTP-referrer
restricted, exposed to the client since Picker runs in-browser).

### 3. Create-doc API route (`app/api/docs/create/route.ts`)

- `POST { account: "personal" | "work", name: string }`
- Uses `parseAccountId` + `requireGmailAccess` (existing, generic helpers) to
  get that account's access token.
- Calls Drive API `files.create` with
  `mimeType: "application/vnd.google-apps.document"` and the given name.
- Returns `{ id, name }`. Because the app created the file, `drive.file`
  grants it access automatically — no Picker round-trip needed.

### 4. Settings storage (`lib/settings-storage.ts`)

Add two fields to `InboxSettings`:
- `todoExportDocNamePersonal: string`
- `todoExportDocNameWork: string`

(existing `todoExportDocIdPersonal` / `todoExportDocIdWork` fields are
reused, just no longer hand-edited via free text)

### 5. Settings UI (`components/settings/AccountsSettings.tsx`)

Replace the "Paste Google Doc URL or ID" input + Save button (for each of
Personal/Work) with a doc-picker control:

**No doc selected:**
- "📂 Choose from Drive" button → `openDocPicker(accessToken, apiKey)`,
  filtered to Google Docs. On selection, save `{ docId, docName }` to
  settings.
- "+ New Doc" button → POST `/api/docs/create` with a default name
  (`"Email Party TODOs — Personal"` / `"... — Work"`), save the returned
  `{ id, name }` to settings.

**Doc selected:**
- Shows `📄 {docName}` as a link to `https://docs.google.com/document/d/{id}/edit`
- "Change" button (re-opens the choose/create controls)
- "Clear" button (clears `todoExportDocId*` and `todoExportDocName*`)

**Work account**: if `!session.workAccountLinked`, the Work row's buttons are
disabled with hint text "Connect a work account first."

**Error handling**: if Picker or create-doc fails with a permission/403
error (stale session missing `drive.file`), show inline:
*"Couldn't access Google Drive — reconnect this account in Settings → Accounts."*

### Out of scope

- `app/api/docs/append-todo/route.ts` needs no changes — `drive.file` covers
  Docs API access for files the app has per-file access to.
- No changes to the 3-theme system; this settings panel is theme-neutral.
