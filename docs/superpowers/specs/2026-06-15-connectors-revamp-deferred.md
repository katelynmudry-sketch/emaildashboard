# Connectors Revamp — Deferred (Google Doc Picker rolled back)

## Status

The Google Doc picker for TODO Export (added in `d7991e4`, designed in
`2026-06-14-google-doc-picker-design.md`) has been **rolled back**. Settings →
Connectors → TODO Export is back to the original "paste a Google Doc URL or
ID" text field for both Personal and Work.

## Why

Live testing on `emailparty.vercel.app` hit a wall:

- "Choose from Drive" → Google's own Picker dialog: **"There was an error!
  The API developer key is invalid."** — an unrecoverable full-screen overlay
  (only fixable by reloading the page).
- This points at the Google Cloud project for `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`
  not having the **Google Picker API** enabled (or API/referrer restrictions
  excluding it) — a one-time Google Cloud Console setup step that wasn't
  completed.
- Given the user is about to evaluate connectors holistically (Todoist,
  Notion, Calendar, etc.), it made more sense to revert to the known-working
  paste-URL flow now and redesign the picker alongside that broader pass,
  rather than debug Google Cloud project config in isolation.

## What was reverted

- `components/settings/ConnectorsSettings.tsx` — "Choose from Drive" / "+ New
  Doc" buttons removed; restored the "Paste Google Doc URL or ID" input +
  "Save Doc" button for Personal and Work.
- `lib/auth.ts` — OAuth scope reverted from `https://www.googleapis.com/auth/drive.file`
  back to `https://www.googleapis.com/auth/documents` (required for the
  paste-URL flow, since `drive.file` only grants access to files the app
  created or the user picked via Picker — not arbitrary pasted doc IDs).
  Existing users will see the consent screen again on next sign-in
  (`prompt: "consent"` was already set).
- `lib/settings-storage.ts` — removed `todoExportDocNamePersonal` /
  `todoExportDocNameWork` (picker-only display-name fields). `todoExportDocIdPersonal`
  / `todoExportDocIdWork` remain, as before.
- Removed `lib/google-picker.ts` and `app/api/docs/create/route.ts` (unused
  without the picker UI).
- `.env.example` — removed `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`.
- `app/api/docs/append-todo/route.ts` — unchanged; works the same with either
  scope.

## Revisit later, alongside the connectors pass

When picking this back up (with Todoist, Notion, Calendar connectors):

1. Decide whether the Picker-based flow (narrower `drive.file` scope, nicer
   "Choose from Drive" / "+ New Doc" UX — see the 2026-06-14 design doc) is
   worth the Google Cloud Console setup burden for users, vs. keeping the
   simple paste-URL field.
2. If reviving the picker: in Google Cloud Console for the project behind
   `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, enable **"Google Picker API"** (APIs &
   Services → Library), and check the key's API/HTTP-referrer restrictions
   include it and the deployed domain. Confirm "Choose from Drive" actually
   opens before re-shipping.
3. Either way, design the Connectors tab so Google Docs, Todoist, Notion, and
   Calendar all follow one consistent "connect / configure" pattern instead of
   one-off UIs per connector.
