# BUGS & DEBT

## Low – DEBT (added 2026-07-14 — theme unification pass)

### ~20 hand-rolled fetch blocks in Dashboard.tsx could collapse to a shared `apiPost(url, body)` helper
Deferred out of the Phase 1b theme-unification commit (docs/plans/2026-07-14-bulk-cleanup-suite.md) to keep that diff scoped to token extraction. Worth doing before/during Phase 2a, which adds more fetch call sites.

### `Email extends RawEmail` still duplicated in `lib/types.ts`
Same reason as above — deferred rather than bundled into the theme-unification diff.

## Low – DEBT (added 2026-05-27 — settings panel audit)

### `CATEGORIZE_INSTRUCTIONS` was exported from a route file (now moved to `lib/claude-utils.ts`)
Already fixed in this session. Noting for posterity: constants should live in `lib/`, not route files.

### `sendChatMessage` in `InstructionsPanel.tsx` does too much
Combines optimistic UI append, fetch, two error paths, and response merge into one async function.
If the chat editor grows, extract the fetch logic to a `useChatEditor()` hook.
File: `components/InstructionsPanel.tsx` lines ~202–239

### `categorization-rules.json` file writes fail silently on Vercel
`lib/rules.ts` uses `fs.writeFileSync` which is a no-op on Vercel's read-only filesystem.
"Teach Claude" sender rules created in the UI won't persist on the hosted version.
Fix: migrate `rules.ts` to use the same localStorage → request-body pattern as settings.
File: `lib/rules.ts`

## Low – DEBT

### Auth-check boilerplate duplicated across all 7 route handlers
Every route in `app/api/**` repeats the same `auth()` → 401 guard pattern verbatim. A shared `withAuth(handler)` wrapper or Next.js middleware would let changes propagate in one place.
Affected files: `messages/route.ts`, `labels/route.ts`, `label/route.ts`, `archive/route.ts`, `read/route.ts`, `draft/route.ts`, `ensure-label/route.ts`, `ai/categorize/route.ts`, `ai/propose/route.ts`

### Dashboard.tsx owns too many concerns (SRP)
All data-fetching, mutation logic, and UI state live in one component. Consider extracting async flows (fetch → propose → categorize) into a `useInbox(account)` hook, leaving Dashboard to compose UI only.
File: `components/Dashboard.tsx`

### `timeAgo` utility lives in `lib/claude.ts`
A date-formatting helper has no business in the Claude/LLM module. Move to `lib/utils.ts` if other modules need it.
File: `lib/claude.ts` (around line 33)

### Multi-account toggle is misleading
The Gmail API routes call `auth()` and use the signed-in OAuth session — there's only one Google account token. Switching to "work" in the UI changes the Claude context prompt but still fetches the same inbox. True multi-account support would require separate OAuth flows.
File: `components/Dashboard.tsx`, `app/api/gmail/**`

### `debug: true` in NextAuth config
Will log access/refresh tokens to server console in production. Remove or gate on `process.env.NODE_ENV !== "production"`.
File: `lib/auth.ts:5`
