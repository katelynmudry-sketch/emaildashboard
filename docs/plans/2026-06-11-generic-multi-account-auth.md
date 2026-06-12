# Email Party — Launch & Distribution Roadmap

**Date:** 2026-06-11  
**Goal:** Ship Email Party as a publicly usable product — generic multi-account auth, hosted on Vercel, installable as a PWA, and wrapped with Capacitor for App Store distribution on iOS and Android.

---

## Full Roadmap Overview

Work is sequenced so each stage builds on the last. Do not skip ahead — in particular, the mobile UI pass must happen before Capacitor wrapping or the App Store submission will look bad.

| Stage | What | Why first |
|-------|------|-----------|
| **1 — Auth** (this doc, Blocks 1–5) | Remove hardcoded owner emails; make two-account flow work for anyone | Everything else depends on auth working generically |
| **2 — Vercel Deploy** (Block 6) | Host on a real domain; add sisters as Google test users | Needed before anyone outside your machine can test |
| **3 — Mobile UI** (Block 7) | Responsive redesign for phone screens | Must look good before wrapping in Capacitor |
| **4 — PWA** (Block 8) | `manifest.json` + icons → installable from browser | Quick win; sisters can add to home screen immediately |
| **5 — Capacitor** (Block 9) | Wrap web app for iOS + Android App Store submission | Builds on top of polished mobile UI |
| **6 — Google Verification** (Block 10, parallel) | Submit OAuth app for Google's security review | Long lead time — start paperwork early, runs in parallel |

---

## Stage 1 — Generic Multi-Account Auth

### Header

**Goal:** Remove every hardcoded owner-email env var from the auth and account-switching logic so any user can sign in with up to two Google accounts.

**Architecture:** The current system identifies the "work" account by comparing the sign-in email against `NEXT_PUBLIC_OWNER_WORK_EMAIL`. Replace this with a dynamic rule: the first Google sign-in is always "personal"; any subsequent sign-in with a *different* email is "work." The work email is stored in the JWT and surfaced through the session. All UI components that currently read account emails from env-var-backed constants are updated to read from the live session instead.

**Design Patterns:** Session-as-source-of-truth — the JWT is the single store for both accounts' tokens and emails; env vars are no longer involved in runtime account routing.

**Tech Stack:** Next.js 16 App Router · NextAuth v5 (JWT strategy) · TypeScript

---

## Pre-flight Checks

- **No test framework installed** — `package.json` has no test runner. Verification gate for every chunk is `npx tsc --noEmit` (type-check) plus a manual smoke test noted inline.
- **Auth architecture:** `lib/auth.ts` exports `{ handlers, auth, signIn, signOut }`. Routes import `handlers`; components import `signIn`/`signOut` from `next-auth/react`. No changes to that split.
- **File conventions:** Named exports from `lib/`, default exports from `components/`. Types co-located in `lib/types.ts`.
- **Error handling:** No toast library in this project — errors surface as `errorMsg` state in `Dashboard.tsx`. No changes to that pattern.
- **Reuse audit:**
  - `refreshGoogleAccess` in `lib/auth.ts` — call as-is, no change needed.
  - `requireGmailAccess` in `lib/gmail-auth.ts` — modify in place.
  - `ACCOUNTS` constant in `lib/types.ts` — replace with `getAccounts(session)` function.

---

## Block 1 — Session Type & JWT

Make the JWT and Session carry `work_email` so the rest of the app can read it.

**Success Criteria:**
- [ ] `session.work_email` is typed in `lib/types.ts`
- [ ] `token.work_email` is typed in the JWT augmentation
- [ ] `npx tsc --noEmit` passes with zero errors after this block

### Chunk 1.1 — Add `work_email` to session/JWT types

**Files:** Modify `lib/types.ts:1-27`

**Step 1 — Failing check:**
Add a reference to `session.work_email` anywhere in `Dashboard.tsx` (e.g., `console.log(session?.work_email)`). Run:
```
npx tsc --noEmit
```
Expected error: `Property 'work_email' does not exist on type 'Session'`

**Step 2 — Implement:**
In `lib/types.ts`, update both augmentation blocks:

```ts
// In `declare module "next-auth"` → Session interface, add:
work_email?: string

// In `declare module "@auth/core/jwt"` → JWT interface, add:
work_email?: string
```

**Step 3 — Verify:**
```
npx tsc --noEmit
```
Expected: no errors for `session.work_email`. Remove the temporary `console.log`.

**Step 4 — Commit:**
```bash
git add lib/types.ts
git commit -m "types: add work_email to Session and JWT augmentations"
```

---

## Block 2 — Auth Callback

Replace the env-var email comparison with dynamic second-account detection.

**Success Criteria:**
- [ ] `NEXT_PUBLIC_OWNER_WORK_EMAIL` is no longer read inside `lib/auth.ts`
- [ ] A second Google sign-in with a *different* email stores tokens under `work_*` keys
- [ ] Re-signing in with the *same* email as the primary refreshes the personal tokens (no regression)
- [ ] `work_email` is present in the session after a second sign-in

### Chunk 2.1 — Dynamic second-account detection in JWT callback

**Files:** Modify `lib/auth.ts:52-74`

**Step 1 — Failing check:**
```
npx tsc --noEmit
```
Baseline — should currently pass.

**Step 2 — Implement:**

Replace the `jwt` callback's sign-in branch (lines 52–74) with:

```ts
async jwt({ token, account, user }) {
  if (account && user?.email) {
    const newEmail = user.email.toLowerCase()
    const primaryEmail = (token.email as string | undefined)?.toLowerCase()

    // Second account: a different email signed in while a primary is already stored
    const isSecondAccount = !!primaryEmail && newEmail !== primaryEmail
    if (isSecondAccount) {
      return {
        ...token,
        work_email: newEmail,
        work_access_token: account.access_token,
        work_refresh_token: account.refresh_token ?? token.work_refresh_token,
        work_expires_at: account.expires_at,
        work_error: undefined,
      }
    }

    // Primary account (first sign-in, or re-authenticating same email)
    return {
      ...token,
      access_token: account.access_token,
      refresh_token: account.refresh_token ?? token.refresh_token,
      expires_at: account.expires_at,
      error: undefined,
    }
  }
  // ... rest of refresh logic unchanged
```

**Step 3 — Update `session` callback** (lines 103–116) to expose `work_email`:

```ts
async session({ session, token }) {
  return {
    ...session,
    access_token: token.access_token as string,
    refresh_token: token.refresh_token as string,
    expires_at: token.expires_at as number,
    error: token.error as "RefreshTokenError" | undefined,
    work_email: token.work_email as string | undefined,
    work_access_token: token.work_access_token as string | undefined,
    work_refresh_token: token.work_refresh_token as string | undefined,
    work_expires_at: token.work_expires_at as number | undefined,
    work_error: token.work_error as "RefreshTokenError" | undefined,
    workAccountLinked: !!token.work_refresh_token,
  }
},
```

**Step 4 — Verify:**
```
npx tsc --noEmit
```
Expected: zero errors.

**Step 5 — Commit:**
```bash
git add lib/auth.ts
git commit -m "auth: detect second account dynamically instead of matching owner env var"
```

---

## Block 3 — Server-side Gmail Auth Guard

Remove the env-var `WORK_CONFIGURED` gate so any user's second account works.

**Success Criteria:**
- [ ] `NEXT_PUBLIC_OWNER_WORK_EMAIL` is no longer read in `lib/gmail-auth.ts`
- [ ] Work account requests succeed when `session.work_access_token` exists, regardless of env vars

### Chunk 3.1 — Replace `WORK_CONFIGURED` with session check

**Files:** Modify `lib/gmail-auth.ts:1-56`

**Step 1 — Implement:**

Remove the top-level `WORK_CONFIGURED` constant and update `requireGmailAccess`:

```ts
export function requireGmailAccess(session: Session | null, accountId: AccountId): GmailAuthResult {
  if (!session) {
    return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (accountId === "work") {
    // Work is "configured" when the user has completed a second sign-in
    if (!session.work_refresh_token) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Connect this Google account to load this inbox.", code: "ACCOUNT_NOT_LINKED" as const },
          { status: 403 },
        ),
      }
    }
    if (session.work_error === "RefreshTokenError") {
      return { success: false, response: NextResponse.json({ error: "TokenExpired" }, { status: 401 }) }
    }
    if (!session.work_access_token) {
      return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }
    return { success: true, accessToken: session.work_access_token }
  }

  if (session.error === "RefreshTokenError") {
    return { success: false, response: NextResponse.json({ error: "TokenExpired" }, { status: 401 }) }
  }
  if (!session.access_token) {
    return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { success: true, accessToken: session.access_token }
}
```

Also remove the `parseAccountId` guard that gates work on `WORK_CONFIGURED` — any authenticated user should be able to use account id `"work"`:

```ts
export function parseAccountId(value: string | null | undefined): AccountId {
  if (value === "work") return "work"
  return "personal"
}
```

**Step 2 — Verify:**
```
npx tsc --noEmit
```

**Step 3 — Commit:**
```bash
git add lib/gmail-auth.ts
git commit -m "auth: remove WORK_CONFIGURED env-var gate, rely on session tokens"
```

---

## Block 4 — Session-driven Account Configs (UI)

Replace the static `ACCOUNTS` env-var constant with a `getAccounts(session)` function. Update every call site.

**Success Criteria:**
- [ ] `ACCOUNTS` constant deleted from `lib/types.ts`
- [ ] `getAccounts(session)` returns correct labels/emails for any signed-in user
- [ ] `AccountToggle` shows the actual signed-in email addresses (or "Account 1" / "Account 2" if unavailable)
- [ ] Cache keys in `Dashboard.tsx` use session emails

### Chunk 4.1 — Replace `ACCOUNTS` with `getAccounts(session)`

**Files:** Modify `lib/types.ts:174-185`

**Implement:**

Delete the `ACCOUNTS` constant and add:

```ts
import type { Session } from "next-auth"

export function getAccounts(session: Session | null): AccountConfig[] {
  const personalEmail = session?.user?.email ?? ""
  const workEmail = (session as { work_email?: string } | null)?.work_email ?? ""
  return [
    {
      id: "personal",
      email: personalEmail,
      label: personalEmail ? personalEmail.split("@")[0] : "Account 1",
    },
    {
      id: "work",
      email: workEmail,
      label: workEmail ? workEmail.split("@")[0] : "Account 2",
    },
  ]
}
```

**Verify:**
```
npx tsc --noEmit
```
Expected: errors for every remaining `ACCOUNTS` import — that's the failing state that drives the next chunk.

**Commit:**
```bash
git add lib/types.ts
git commit -m "types: replace static ACCOUNTS constant with getAccounts(session) helper"
```

### Chunk 4.2 — Update `AccountToggle` to accept accounts as prop

**Files:** Modify `components/AccountToggle.tsx:1-31`

**Implement:**

Replace the `ACCOUNTS` import with an `accounts` prop:

```tsx
"use client"

import type { AccountId, AccountConfig } from "@/lib/types"

interface Props {
  active: AccountId
  accounts: AccountConfig[]
  onChange: (id: AccountId) => void
  loading: boolean
}

export default function AccountToggle({ active, accounts, onChange, loading }: Props) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-full p-1">
      {accounts.map(account => (
        <button
          key={account.id}
          onClick={() => !loading && onChange(account.id)}
          disabled={loading}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            active === account.id
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {account.label}
        </button>
      ))}
    </div>
  )
}
```

**Verify:**
```
npx tsc --noEmit
```
Expected: `Dashboard.tsx` now errors on the `AccountToggle` call site (missing `accounts` prop). Drives next chunk.

**Commit:**
```bash
git add components/AccountToggle.tsx
git commit -m "AccountToggle: accept accounts prop instead of reading from ACCOUNTS constant"
```

### Chunk 4.3 — Update Dashboard.tsx call sites

**Files:** Modify `components/Dashboard.tsx`

Three call sites to fix:

**1. Import** — Replace `import { ACCOUNTS } from "@/lib/types"` with `import { getAccounts } from "@/lib/types"` (line 6).

**2. Derive accounts from session** — After the `session` is available (around line 214, near existing state declarations), add:

```ts
const accounts = getAccounts(session)
const activeAccountConfig = accounts.find(a => a.id === activeAccount)!
```

Remove the existing `const activeAccountConfig = ACCOUNTS.find(...)` line (~line 321).

**3. AccountToggle call site** (~line 1237) — Add `accounts={accounts}`:

```tsx
<AccountToggle
  active={activeAccount}
  accounts={accounts}
  onChange={handleAccountSwitch}
  loading={isLoading}
/>
```

**4. Cache key in `handleAccountSwitch`** (~line 750) — Replace the `ACCOUNTS.find(...)` lookup:

```ts
// Before:
const accountEmail = ACCOUNTS.find(a => a.id === id)!.email

// After:
const accountEmail = accounts.find(a => a.id === id)?.email ?? id
```

**5. Connect work Gmail button** (~line 1355) — Remove the `&& activeAccountConfig.email` guard so all users see the button when the work account is not yet linked. Also drop the `login_hint` (we don't pre-know their second email):

```tsx
{workNeedsLink && (
  <button
    type="button"
    onClick={() =>
      signIn(
        "google",
        { redirectTo: typeof window !== "undefined" ? window.location.pathname : "/" },
        { prompt: "select_account consent" },
      )
    }
    ...
  >
    Connect second Gmail
  </button>
)}
```

**Verify:**
```
npx tsc --noEmit
```
Expected: zero errors.

**Commit:**
```bash
git add components/Dashboard.tsx
git commit -m "dashboard: derive account configs from session, fix connect button for all users"
```

---

## Block 5 — Env Var Cleanup & Setup Docs

**Success Criteria:**
- [ ] `.env.example` no longer lists OWNER emails as required
- [ ] `SETUP.md` has clear sharing/deployment instructions
- [ ] Anyone following the setup guide can get a working two-account instance

### Chunk 5.1 — Update `.env.example`

**Files:** Modify `.env.example`

Remove `NEXT_PUBLIC_OWNER_EMAIL` and `NEXT_PUBLIC_OWNER_WORK_EMAIL`. Update the owner AI context block to reflect it's now fully optional:

```
# Copy this file to .env.local and fill in the values

# next-auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# Google OAuth — must be a Web Application type client (not Desktop)
# Create at: console.cloud.google.com > APIs & Services > Credentials
# Authorized redirect URI to add: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic
ANTHROPIC_API_KEY=

# Optional: custom AI system prompt for email categorization/summaries.
# If blank, the built-in default prompt is used.
# Users can also override this per-session via the Settings panel.
CLINIC_CONTEXT=
```

**Commit:**
```bash
git add .env.example
git commit -m "env: remove hardcoded owner email vars, mark CLINIC_CONTEXT as optional"
```

### Chunk 5.2 — Update SETUP.md for sharing

**Files:** Modify `SETUP.md`

Add a new section **"Sharing with Others"** after the existing local setup steps:

```markdown
## Sharing with Others

### Option A — Self-hosted (recommended)
Each person clones the repo and sets up their own Google OAuth credentials and `.env.local`.
They get full privacy — their tokens never touch your server.

Steps for each person:
1. Clone the repo
2. Follow Steps 1–4 above (each person needs their own Google OAuth client ID + Anthropic key)
3. In Google Cloud Console, add their redirect URI: `https://<their-domain>/api/auth/callback/google`
4. Deploy to Vercel, Railway, or run locally

### Option B — You host it, others log in
You run one instance and others sign in via Google OAuth.

**Required:** Move your Google OAuth app from "Testing" to "Published":
1. Google Cloud Console → APIs & Services → OAuth consent screen
2. Click **Publish App** → confirm
3. (Optional) If your app uses sensitive scopes like Gmail, submit for Google verification — or add testers manually under "Test users" for up to 100 people without full verification.

**Note:** The Anthropic API key is shared in this model — all users' AI calls bill to your account.

### Two-account setup (for any user)
1. Sign in with your primary Gmail account → this becomes "Account 1"
2. Click **"Connect second Gmail"** in the header → sign in with your second account
3. The account toggle in the header lets you switch between both inboxes
```

**Commit:**
```bash
git add SETUP.md
git commit -m "docs: add sharing/deployment guide and two-account setup instructions"
```

---

## Technical Debt (Stage 1)

| Item | Risk | Resolution |
|------|------|------------|
| No automated tests | If the JWT callback logic regresses, it won't be caught until manual login | Add vitest + NextAuth mock tests in a future session |
| Session JWT holds both accounts' tokens in one cookie | Cookie size limit (~4KB) could be hit if tokens are long | Acceptable for now; switch to database sessions if it becomes an issue |
| `CLINIC_CONTEXT` still a global env var | All users share the same default AI prompt | Already overridable per-user via Settings panel; document this clearly |

---

## Stage 2 — Vercel Deployment

Get a real URL so sisters can test. The Google OAuth app stays in "Testing" mode — just add their emails as test users manually.

**Success Criteria:**
- [ ] App is live at a public URL
- [ ] Sisters' Gmail addresses added as Google test users
- [ ] Sign-in and two-account flow verified on production

### Block 6 — Deploy to Vercel

#### Chunk 6.1 — Connect repo and configure env vars

**Steps:**
1. Go to vercel.com → New Project → Import from GitHub (`katelynmudry-sketch/emaildashboard`)
2. Framework: Next.js (auto-detected)
3. Add all env vars from `.env.local` in the Vercel dashboard:
   - `NEXTAUTH_URL` → set to your Vercel domain (e.g. `https://emailparty.vercel.app`)
   - `NEXTAUTH_SECRET` → same value as local
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `ANTHROPIC_API_KEY`
4. Deploy

#### Chunk 6.2 — Add production redirect URI to Google Cloud

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:
- Add to "Authorized redirect URIs": `https://<your-vercel-domain>/api/auth/callback/google`

#### Chunk 6.3 — Add sisters as test users

Google Cloud Console → APIs & Services → OAuth consent screen → Test Users → Add their Gmail addresses.  
Up to 100 test users, no Google review required.

#### Chunk 6.4 — Verify end-to-end

- Sign in on the production URL with your own account
- Confirm two-account connect flow works
- Send sisters the link and confirm they can sign in

**Note on API costs:** Your Anthropic key covers all AI calls for all users. Light use (categorize + briefing daily) runs roughly $2–5/month for a small test group.

---

## Stage 3 — Mobile UI Redesign

The current layout is desktop-first. Before wrapping in Capacitor, every screen needs to work on a phone. This is the largest design effort in the roadmap.

**Success Criteria:**
- [ ] App is usable one-handed on a 390px-wide screen (iPhone 14 size)
- [ ] Category grid collapses to single column on mobile
- [ ] Header buttons don't overflow or get cut off
- [ ] Email rows are tappable with finger-sized hit targets (min 44px)
- [ ] Compose/reply modal fills screen on mobile
- [ ] Morning dashboard widgets stack vertically

### Block 7 — Responsive UI Pass

This block gets its own dedicated planning session when Stage 2 is complete. The chunks will be per-component (header, category grid, email row, compose modal, dashboard widgets). A mockup prototype will be created first per the `/plan` process.

**Key areas to address:**
- `components/Dashboard.tsx` — header row with many buttons needs a mobile menu or collapsed layout
- `components/CategoryBlock.tsx` — grid needs `grid-cols-1` on small screens
- `components/EmailRow.tsx` — hover actions need to become tap actions on mobile
- `components/ComposeWindow.tsx` — needs full-screen modal treatment on mobile
- `components/dashboard/DashboardPanel.tsx` — widgets need vertical stacking

---

## Stage 4 — PWA (Progressive Web App)

Make the web app installable from the browser. Users tap "Add to Home Screen" and it looks and feels like a native app — own icon, full-screen, no browser chrome.

**Success Criteria:**
- [ ] App has a `manifest.json` with name, icons, colors, and `display: standalone`
- [ ] App icon looks good on iOS and Android home screens
- [ ] Passes Chrome's PWA installability checklist (Lighthouse audit)
- [ ] Sisters can successfully "Add to Home Screen" on both iOS and Android

### Block 8 — PWA Setup

#### Chunk 8.1 — Create `manifest.json`

**Files:** Create `public/manifest.json`, Modify `app/layout.tsx`

```json
{
  "name": "Email Party",
  "short_name": "Email Party",
  "description": "AI-powered Gmail triage",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#EEE4FF",
  "theme_color": "#7C3AED",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

In `app/layout.tsx`, add to `<head>`:
```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#7C3AED" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

#### Chunk 8.2 — Create app icons

Generate icons at these sizes: 192×192, 512×512. Use the 📬 emoji or a custom logo. Tools: Figma, Canva, or `sharp` npm package to resize.

Place in `public/`: `icon-192.png`, `icon-512.png`.

#### Chunk 8.3 — Verify with Lighthouse

Run Chrome DevTools → Lighthouse → Progressive Web App audit. Fix any issues flagged. Common ones: missing `apple-touch-icon`, wrong `display` mode, missing `description`.

**Commit:**
```bash
git add public/manifest.json public/icon-192.png public/icon-512.png app/layout.tsx
git commit -m "feat: add PWA manifest and icons for home screen install"
```

---

## Stage 5 — Capacitor (App Store Wrapper)

Wrap the web app in a native shell for iOS and Android. This runs in a WebView — same codebase, native distribution.

**Prerequisites:** Stage 3 (mobile UI) must be complete first.

**Success Criteria:**
- [ ] App builds and runs on iOS Simulator
- [ ] App builds and runs on Android Emulator
- [ ] Sign-in works via in-app browser (SFSafariViewController / Chrome Custom Tab) — NOT a plain WebView
- [ ] App submitted to App Store Connect (iOS)
- [ ] App submitted to Google Play Console (Android)

### Block 9 — Capacitor Setup

#### Chunk 9.1 — Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/browser
npx cap init "Email Party" "com.emailparty.app" --web-dir=out
```

Update `next.config.ts` to enable static export:
```ts
const nextConfig: NextConfig = {
  output: "export",
}
```

**Important:** Static export means no Next.js API routes in the app bundle. The API routes stay on Vercel — the Capacitor app points at the hosted Vercel URL for all API calls. You'll need to configure the base URL.

#### Chunk 9.2 — Fix OAuth sign-in for WebView

Google blocks OAuth inside a plain WebView. Use `@capacitor/browser` to open an in-app browser (SFSafariViewController on iOS, Chrome Custom Tab on Android).

In `components/AuthGuard.tsx`, detect Capacitor and use the plugin:
```ts
import { Browser } from "@capacitor/browser"
import { Capacitor } from "@capacitor/core"

// When on native, open sign-in URL via in-app browser instead of redirect
if (Capacitor.isNativePlatform()) {
  await Browser.open({ url: signInUrl })
} else {
  signIn("google", { redirectTo: "/" })
}
```

#### Chunk 9.3 — Add iOS and Android platforms

```bash
npx cap add ios
npx cap add android
npx next build
npx cap sync
```

Open in Xcode: `npx cap open ios`  
Open in Android Studio: `npx cap open android`

#### Chunk 9.4 — App icons and splash screens

Capacitor requires many icon sizes. Use the `@capacitor/assets` tool:
```bash
npm install @capacitor/assets --save-dev
npx capacitor-assets generate
```

Provide a 1024×1024 source icon PNG.

#### Chunk 9.5 — App Store submission checklist

**Apple App Store:**
- [ ] Apple Developer account ($99/yr — already have this)
- [ ] Create App ID in App Store Connect
- [ ] Configure signing in Xcode
- [ ] Create screenshots (6.5" iPhone, 12.9" iPad min)
- [ ] Write App Store description — emphasize AI + privacy angle
- [ ] Submit for review (typically 1–3 days)

**Google Play:**
- [ ] Google Play Console account ($25 one-time)
- [ ] Generate signed `.aab` from Android Studio
- [ ] Create store listing with screenshots
- [ ] Submit for review (typically 1–3 days, often faster than Apple)

---

## Stage 6 — Google OAuth Verification (Parallel Track)

This runs in parallel with Stages 3–5. It has a long lead time (weeks of back-and-forth with Google), so start early.

**Why needed:** The Gmail scopes used by this app (`gmail.modify`, `gmail.compose`) are "sensitive" scopes. Without verification, the sign-in screen shows a scary "This app isn't verified" warning, and you're capped at 100 test users.

**Success Criteria:**
- [ ] Privacy policy published at a real URL on your domain
- [ ] Demo video recorded showing exactly what data is accessed and why
- [ ] OAuth consent screen submission submitted to Google
- [ ] Verification approved — "This app isn't verified" warning removed

### Block 10 — Google Verification Paperwork

#### Chunk 10.1 — Privacy policy

Write and publish a privacy policy. Must cover:
- What data is accessed (Gmail messages, calendar)
- Where it's stored (nowhere — tokens in user's browser session only)
- How it's used (AI categorization, displayed to the user only)
- Contact information

Publish at `yourdomain.com/privacy`. Can be a simple static page.

#### Chunk 10.2 — Record demo video

Google requires a video showing the OAuth flow and exactly how each scope is used. Record a screen recording showing:
1. The sign-in flow
2. Gmail being fetched and displayed
3. AI categorization happening
4. The two-account connect flow

Upload to YouTube (unlisted is fine).

#### Chunk 10.3 — Submit to Google

Google Cloud Console → APIs & Services → OAuth consent screen → Submit for verification.

Fill in: privacy policy URL, demo video URL, justification for each scope (why you need `gmail.modify` vs read-only, etc.).

**Expected timeline:** 2–6 weeks. Google may come back with questions. Reply promptly.

---

## Technical Debt (Full Roadmap)

| Item | Risk | Resolution |
|------|------|------------|
| No automated tests | Auth regressions won't be caught | Add vitest in a future session |
| JWT cookie size | Two accounts' tokens in one ~4KB cookie | Switch to database sessions if needed |
| Static export for Capacitor | API routes must stay on Vercel; app needs hosted URL configured | Document clearly; use env var for API base URL |
| Anthropic API costs shared | All users' AI calls bill to one key | Add rate limiting or per-user keys if usage grows |
| App Store "web wrapper" risk | Apple may reject if they think it's just a web wrapper | Ensure value-add is clear in description; PWA route avoids this entirely |

---

## Production & Design Standards

- **No new `fetch` calls in Stage 1** — existing timeout patterns unchanged.
- **Error handling** — no new async paths in Stage 1; existing `errorMsg` state pattern unchanged.
- **Type safety** — `npx tsc --noEmit` is the verification gate for every Stage 1 chunk.

---

## Current Status

- [x] Stages identified and sequenced
- [ ] Stage 1 (auth) — ready to build → use `/build`
- [ ] Stage 2 (Vercel deploy)
- [ ] Stage 3 (mobile UI — needs its own `/plan` session)
- [ ] Stage 4 (PWA)
- [ ] Stage 5 (Capacitor)
- [ ] Stage 6 (Google verification — start paperwork during Stage 3)

Ready to start Stage 1? Use `/build`.
