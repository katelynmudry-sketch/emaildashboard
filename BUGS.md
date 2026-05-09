# BUGS & DEBT

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
