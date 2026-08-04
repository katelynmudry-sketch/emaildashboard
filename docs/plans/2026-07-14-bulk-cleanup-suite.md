# Fable Audit — Email Party Groundwork + Bulk Cleanup Plan

## Context
Full code review (architecture, performance, compactness, industry gaps) surfaced findings; user direction narrowed the plan to: (1) groundwork first — security fixes, theme unification, incremental categorization; (2) build a **bulk-ops suite** as the flagship feature — theme-unique bulk experiences like Mindful Purge, improved package cleanup, OTP/authenticator-email tagging with auto-suggest delete, and a sweep of previously read/archived emails suggesting deletes; (3) revamp gamification around bulk cleanup; (4) improved Daily Briefing with an **action-focused** paragraph.

Note: newest local commit b1a5d4b already fixed category seeding (proposes from last 100 read+unread via `/api/gmail/seed-emails`, plus a reset-and-recategorize setting) — no work needed there.

---

## Phase 1 — Groundwork

### 1a. Security fixes (small, do first)
- **Add auth to `/api/rules`** ([app/api/rules/route.ts](app/api/rules/route.ts)) — currently GET/POST/DELETE have no session check; anyone can rewrite rules injected into every user's Claude prompt. Use the same `auth()` session gate as other routes.
- **Stop exposing Google tokens to the browser** — `auth.ts:176-182` returns `refresh_token`/`access_token`/`work_*` into the client session. Keep them in the JWT only; strip from the session callback. Audit client code for any reads of these fields first (none expected — API routes read them server-side from the JWT).
- **Cap AI payloads** — `/api/ai/categorize` and `/api/ai/propose` accept unbounded `emails` arrays; cap server-side at 100 and return 400 above it.
- Stop returning raw `err.message` in 500s (generic message + server-side log); remove the subject-leaking `console.log` in `package-cleanup/route.ts:20`.

### 1b. Theme unification (unified components, theme-exclusive elements preserved)
Principle: **one component, three skins** — components read tokens from a single theme accessor instead of inline ternaries. Elements that are deliberately exclusive to one theme (e.g., Dharma/Breathwork widgets, Mindful Purge zen framing, roast) stay behind explicit mode guards, documented in one place.
- Extend [components/dashboard/theme-config.ts](components/dashboard/theme-config.ts) (or a new `lib/theme.ts`) with page-level tokens: `accent`, `pageBg`, `ambientGlow`, `buttonPrimary`, `buttonSecondary`, `cardBg/border/shadow`, `textMuted`. Export `getTheme(mode: PartyMode)`.
- Replace the ~32 inline `mode === "zen" ? … : mode === "wabi-sabi" ? … : …` color ternaries (16 in [components/Dashboard.tsx](components/Dashboard.tsx), plus MiniStat/TallyTicket/KarmaPill and CategoryBlock/LabelSection) with `getTheme(mode)` lookups.
- Move mode-specific **copy strings** into a table following the existing `categoryNoun()` pattern in [lib/party-mode.ts](lib/party-mode.ts) — e.g. `getCopy(mode).idleTitle`, `.loadingSubtitle`, `.roastButton`.
- Add a short `THEME_EXCLUSIVE` doc block (in theme file or CLAUDE.md) listing which elements intentionally appear in only one theme.
- While in these files: add the shared `apiPost(url, body)` helper (`lib/api.ts`) and collapse the ~20 hand-rolled fetch blocks; dedupe `Email extends RawEmail` in [lib/types.ts](lib/types.ts).

### 1c. Skip re-categorizing cached emails (biggest speed/cost win)
- In `loadInbox()` ([components/Dashboard.tsx:511](components/Dashboard.tsx#L511)): diff fetched message IDs against the categorized snapshot in [lib/inbox-cache.ts](lib/inbox-cache.ts); send only new/unknown emails to `/api/ai/categorize`, merge results with cached ones. The new "Reset & re-categorize" setting (commit b1a5d4b) already provides the manual full-redo escape hatch.
- Wrap the derived arrays (`briefingEmails`, per-category filters at Dashboard.tsx:2189) in `useMemo`, and `React.memo` `EmailRow`/`CategoryBlock`/`LabelSection` — cheap while touching these files.

---

## Phase 2 — Bulk Ops Suite (flagship feature)

### 2a. Shared bulk engine
- `useBulkSelection()` hook: selected-ID set, select-all-in-category, select-all-suggested, clear. Generalize from the existing Mindful Purge multi-select in Dashboard.tsx.
- `<BulkActionBar mode={mode}>`: floating bar with count + actions (delete, archive, mark read), fully themed via `getTheme(mode)`.
- **New batch API route** `app/api/gmail/batch/route.ts` using Gmail `messages.batchModify` / `batchDelete` — one round trip instead of N per-message POSTs (also fixes the per-email label-apply loop at Dashboard.tsx:725).
- All bulk actions logged in [lib/action-log.ts](lib/action-log.ts) with undo, plus a transient undo toast.

### 2b. Theme-unique bulk experiences — different TARGETS per theme
Same selection engine underneath, but each theme's purge hunts a different kind of clutter, matching its personality:

| Theme | Name | Target | Why it fits |
|---|---|---|---|
| 🧘 Zen | **Mindful Purge** (exists) | **Newsletters & subscriptions** — old digests, unread newsletters, mailing lists | Letting go of accumulation; releasing what you once thought you'd read. Pairs naturally with the unsubscribe action ("release this attachment"). |
| 🎉 Party | **Purge Party** | **Dead promos & expired hype** — expired sales, past event invites, flash deals, "last chance" emails whose chance has passed | The party that's over. Fast, high-volume, zero-regret deletes = maximum confetti per minute. |
| ☕ Basic AF | **Declutter Era** | **Shopping trail** — delivered-package chains, order confirmations, shipping updates, receipts | The online-shopping paper trail is peak PSL-girl territory ("the package ARRIVED bestie, we don't need the tracking saga"). Absorbs the improved package-cleanup detection from 2c. |

- **OTP/authenticator codes are suggested in ALL three purges** — they expire in minutes, so every theme's suggestion list leads with them as free wins.
- Each purge also shows an "everything else" tab with the general deletable suggestions, so no theme locks you out of a cleanup type — the theme just decides the headline target and the framing.
- Only copy, chrome, celebration, and default target differ; selection flow, batch API, and undo are shared.

### 2c. Smarter suggestions feeding the bulk list
- **OTP/authenticator tagging**: add `otp: true` detection to the categorize prompt in [lib/claude.ts](lib/claude.ts) (verification codes, sign-in links, 2FA emails). Distinct chip on the row; auto-included in bulk-delete suggestions (codes expire in minutes). Extend `Email` type.
- **Package cleanup improvements**: improve `/api/ai/package-cleanup` detection to group whole delivery chains per order/carrier (shipped→out-for-delivery→delivered) and feed "delivered" chains into the bulk suggestion list instead of a separate banner-only flow.
- Existing `deletable` flags (expired promos, old newsletters, past events — [components/settings/AiCleanupSettings](components/settings)) all funnel into the same suggestion list, grouped by reason.

### 2d. Read/archived sweep ("Deep Clean")
- New route `app/api/gmail/sweep/route.ts`: paginated fetch of older read/archived mail (`q: "is:read older_than:30d"` and `-in:inbox`), **metadata format only** (subjects/senders/dates — cheap and fast).
- New light Claude call (haiku, subjects+senders only, batched ~100/page) returning delete suggestions with reasons; reuse the deletable heuristics from `categorizeInbox`.
- UI: a "Deep Clean" entry point (header or settings) opening the themed bulk experience over sweep results, page-by-page ("Reviewed 100 of ~2,400"). Deletes go through the batch route.

---

## Phase 3 — Gamification revamp (around bulk cleanup)
- Rework [lib/stats.ts](lib/stats.ts): track `emailsPurged` (lifetime + today), cleanup streak (days with ≥1 cleanup), per-session purge counts. Retire abstract karma/XP scoring.
- Plant/garden ([components/PlantHeader.tsx](components/PlantHeader.tsx)) growth driven by cleanup progress instead of remaining-count.
- Per-theme celebration moments on bulk completion (confetti/lotus/latte-sparkle) — reuse [components/ConfettiBlast.tsx](components/ConfettiBlast.tsx).
- Roast API gets purge stats in its payload so hype/wisdom/PSL commentary reacts to cleanup wins (also pass `mode`, closing the known TODO in CLAUDE.md).

## Phase 4 — Improved Daily Briefing (action-focused paragraph)
- Add a Claude-generated **action paragraph** at the top of [components/BriefingSection.tsx](components/BriefingSection.tsx): replies owed, deadlines/dates spotted, suggested cleanups, count of urgent items — directive tone, themed styling but minimal fluff.
- Implementation: extend the `categorizeInbox` response in [lib/claude.ts](lib/claude.ts) with a `briefingSummary` field (single call, no extra request) generated from the same email batch; cache it with the inbox snapshot so it survives reloads.

---

## The full labeling model (once all changes land)

Two layers: **real Gmail labels** (visible in Gmail itself, survive everywhere) and **client-side tags** (chips computed by Claude or stored locally, only visible in Email Party).

### Layer 1 — Real Gmail labels (server-side, applied via Gmail API)
| Label | Source | When applied |
|---|---|---|
| **Category labels** (one per email — e.g. "Receipts", "School") | Proposed by Claude from your last 100 emails (commit b1a5d4b), confirmed by you, created via `ensure-label` | On categorization, via the new **batch** route (one API call instead of one per email) |
| **TODO** | You star/flag an email | On toggle |
| **Briefing** | Manual include/exclude override | On toggle |
| **Gmail star** | Star action | On toggle |

### Layer 2 — Client-side tags (chips in the app, not in Gmail)
| Tag | Source | What it drives |
|---|---|---|
| **Priority** (urgent / today / fyi) | Claude categorization | Row ordering, briefing inclusion |
| **OTP/authenticator** *(new)* | Claude categorization | Distinct chip; auto-suggested in every theme's bulk purge |
| **Deletable + reason** (expired promo, old newsletter, past event, security alert…) | Claude categorization + your AI-cleanup toggles | Feeds the theme-appropriate purge suggestion list |
| **Package chain** *(improved)* | Claude package detection, grouped per order | Delivered chains auto-suggested in Declutter Era / general purge |
| **Snoozed** | You, via snooze modal (localStorage) | Hidden until date |
| **Micro-summary** | Claude categorization | Row summary text |

### How an email flows through it
1. Fetch → check cache: already-categorized emails keep their labels/tags untouched (new incremental behavior).
2. New emails go to Claude in one call → each gets: category, priority, summary, and any of OTP / deletable / package-chain tags.
3. Category label applied to Gmail in one batch call.
4. Purge suggestions assemble from the tags, routed to the theme's target (newsletters → zen, dead promos → party, shopping trail → basic AF, OTPs → all).
5. Deep Clean runs the same tagging (cheap metadata-only version) over older read/archived mail, page by page.
6. Bulk actions go through the batch route and land in the action log with undo.

Nothing changes in Gmail beyond category/TODO/Briefing labels, stars, archive/trash state — all AI judgments stay client-side, so Gmail stays clean.

---

## Execution order
1. Phase 1a (security) → 1c (incremental categorization) → 1b (theme unification + helpers).
2. Phase 2a engine + batch route → 2b themed skins → 2c suggestion sources → 2d Deep Clean.
3. Phase 3 gamification → Phase 4 briefing paragraph.

Each phase is committable/testable on its own.

## Verification
- Security: unauthenticated `curl /api/rules` → 401; inspect `useSession()` in devtools → no `refresh_token`/`access_token` fields; POST 150 emails to categorize → 400.
- Incremental categorize: refresh twice; network tab shows second `/api/ai/categorize` call contains only new IDs (or is skipped) and the inbox renders from cache instantly.
- Theme unification: click through all 3 modes — header, stats, grid, briefing, modals visually unchanged; theme-exclusive elements still appear only in their theme.
- Bulk ops: in each mode, open the bulk experience, select suggestions (OTP + delivered packages appear pre-suggested), delete → single `/api/gmail/batch` request in network tab; undo restores; Gmail web UI confirms trash state.
- Deep Clean: run against real archive; verify pagination, metadata-only fetches, and that deletions match confirmations.
- Gamification: complete a bulk purge in each theme → correct celebration fires, purge counter/streak persists across reload.
- Briefing: paragraph renders with actionable items matching actual inbox contents; survives reload from cache.
- `npm run build` passes after each phase.

---

## Appendix — Future possibilities (industry gap analysis vs. Superhuman / Outlook)

Not in scope for this plan; kept as the backlog of table-stakes features from the original review.

| Gap | Notes |
|---|---|
| **Search** | No inbox search at all. Gmail API `q=` param makes a search box cheap to add — likely the highest-value next feature after bulk ops. |
| **Keyboard shortcuts** | No j/k navigation, e-to-archive, cmd-K. Superhuman's core identity; a small hotkey layer over the existing handlers would go far. |
| **Conversation/thread view** | Replies thread correctly at the API level, but the UI shows single messages only. |
| **Undo send** | Send fires immediately; a 5–10s client-side delayed send is the cheap version. |
| **Send later / scheduling** | None. |
| **Notifications** | No web/push notifications for urgent emails. |
| **Dark mode** | All 3 themes are light; no `prefers-color-scheme` support. |
| **Snippets/templates** | AI draft exists but no canned responses. |
| **Follow-up reminders** | Snooze exists; no "remind me if no reply" (Superhuman staple). |
| **Offline/PWA** | localStorage cache exists but no service worker/manifest. |
| **Labels management UI** | No rename/delete/recolor for categories once created. |
| **Mark-as-unread** | Mark-read is one-way. |
| **3rd+ accounts** | Capped at personal + one work account. |
| **Mobile experience** | Responsive classes exist but the dense header breaks down on small screens. |

Differentiators to protect while closing gaps: AI categorization with real Gmail labels, per-mode personality/copy, Daily Briefing heuristics, package cleanup, teach-Claude rules, gamified cleanup.