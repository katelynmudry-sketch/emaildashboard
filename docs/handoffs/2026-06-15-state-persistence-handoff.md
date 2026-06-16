# Handoff: State persistence — categories + intentions journal history

**Date**: 2026-06-15
**Context**: This doc is for a conversation focused on the app's state/database layer. Two persistence gaps were identified and the design was approved; implementation has not started.

---

## Gap 1 — Onboarding categories (localStorage only)

### Current state

Categories chosen during the `CategoryProposal` step are saved to localStorage in `lib/categories.ts`:

```
key: inbox-ai-categories:<account-email>
value: { account, categories: Category[], proposedAt: ISO }
```

`saveCategories()` is called in two places in `components/Dashboard.tsx`:
- Line 626 — after the user confirms the AI proposal during first-time setup
- Line 1112 — when the user adds a new category manually later

**This is working.** Categories do persist across sessions on the same machine/browser. The gap is that they live only in the browser — lost on device switch, browser wipe, or future Supabase migration.

### What to build

Add a server-side backup: a `data/categories.json` file (or per-account JSON files) that mirrors whatever is in localStorage. The flow would be:

1. `POST /api/categories` — called from `saveCategories()` in `lib/categories.ts` alongside the localStorage write, persisting the same `CategoryConfig` payload to disk.
2. `GET /api/categories?account=<email>` — called on first load if localStorage for that account is empty (hydration fallback).

This means `lib/categories.ts` becomes a thin layer: write to localStorage AND ping the API. On first load, `getCategories()` returns localStorage value if present, otherwise falls back to a server fetch.

**Schema** (unchanged, just needs to be server-persisted too):
```ts
interface CategoryConfig {
  account: string
  categories: Category[]
  proposedAt: string   // ISO
}
```

For multi-account: store as `data/categories-<sanitized-email>.json`, one file per account. Same pattern as the existing `data/dashboard-content.json`.

---

## Gap 2 — Intentions history (journal)

### Current state

The Manifestation widget (`components/dashboard/ManifestationWidget.tsx`) reads and writes a single flat file:

```
data/dashboard-content.json
```

Schema:
```ts
interface ManifestationContent {
  yearIntention: string
  callingIn: Array<{ tag: string; color: string; text: string }>
  moonPhase?: string
  lastUpdated?: string   // ISO — only the last save, not indexed history
}
```

Every `PUT /api/dashboard/manifestation` calls `saveManifestationContent()` in `lib/dashboard-data.ts`, which **overwrites the entire file**. There is no history.

### Design decision: once-per-day upsert

When the user saves their intentions, that save is treated as "today's journal entry." If they save again on the same calendar day, it updates that day's entry (not creates a new one). Each new day starts a new entry. This is the simplest model and maps naturally to the future date-navigation UI.

### What to build

**1. New data file: `data/intentions-history.json`**

```ts
// Array of dated entries, newest last (or newest first — pick one and be consistent)
interface IntentionsHistory {
  entries: IntentionEntry[]
}

interface IntentionEntry {
  date: string              // "YYYY-MM-DD" — the upsert key
  yearIntention: string
  callingIn: Array<{ tag: string; color: string; text: string }>
  savedAt: string           // ISO timestamp of last write for this date
}
```

Keep `data/dashboard-content.json` as a "current/latest" pointer for the widget's read path (no breaking change to the GET endpoint).

**2. Update `lib/dashboard-data.ts`**

Add two functions alongside the existing ones:

```ts
// Upsert today's entry into history
export async function saveIntentionEntry(content: ManifestationContent): Promise<void>

// Return all past entries, sorted by date desc
export async function getIntentionsHistory(): Promise<IntentionEntry[]>
```

`saveIntentionEntry` should:
- Get today's date string (`new Date().toISOString().slice(0, 10)`)
- Load `intentions-history.json` (or start with `{ entries: [] }` if missing)
- Find an existing entry for today's date — if found, overwrite it; if not, push a new one
- Write `intentions-history.json` back to disk
- Also write `dashboard-content.json` (the existing single-record file) so the GET endpoint stays unchanged

**3. Update `PUT /api/dashboard/manifestation`**

Call `saveIntentionEntry(body)` instead of `saveManifestationContent(body)` (or call both, since `saveIntentionEntry` can delegate to `saveManifestationContent` for the current-record write).

**4. New `GET /api/dashboard/intentions-history`** (optional, for the deferred date-nav UI)

Returns `IntentionEntry[]` sorted by date desc. No changes to the widget needed now — this endpoint just needs to exist when the UI arrives.

---

## Deferred: Date-navigation UI

The morning dashboard will eventually let users click forward/back to browse past intention entries (like a journal). This is explicitly **not** part of this work. Once the history API above exists, the UI work is: add prev/next day buttons to `ManifestationWidget`, fetch the history list, and display the entry for the selected date.

Add to TODO.md:
```
- [ ] Dashboard date navigation — prev/next day buttons in ManifestationWidget to browse intentions history (requires Gap 2 above to be built first)
```

---

## Relevant files

| File | Role |
|---|---|
| `lib/categories.ts` | localStorage read/write for categories — add server API calls here |
| `lib/dashboard-data.ts` | File I/O for dashboard data — add `saveIntentionEntry`, `getIntentionsHistory` |
| `lib/types.ts` | Add `IntentionEntry`, `IntentionsHistory` types here |
| `data/dashboard-content.json` | Existing single-record intentions file — keep as current-entry pointer |
| `data/intentions-history.json` | New file (create on first save) |
| `app/api/dashboard/manifestation/route.ts` | Update PUT to call `saveIntentionEntry` |
| `app/api/dashboard/intentions-history/route.ts` | New route — GET history for future date-nav UI |
| `components/dashboard/ManifestationWidget.tsx` | No changes needed now |
| `components/Dashboard.tsx` | No changes needed now |

---

## Notes on future Supabase migration

Both of these file-based stores (`data/*.json`) are designed to be easy to swap for Supabase tables later. The server functions in `lib/dashboard-data.ts` and the new categories API are the only callsites — swapping the implementation behind those functions is a contained change. The TODO for Supabase is already tracked in `TODO.md` under "Database."
