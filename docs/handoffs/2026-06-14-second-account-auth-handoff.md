# Handoff: Second-account sign-in kicks out the primary account (Vercel)

**Date**: 2026-06-14
**Symptom**: Clicking "Connect second Gmail" (onboarding Step 2, or Settings → Accounts) signs in a second Google account, but it **replaces** the primary account instead of being stored as `work_*`. Session ends up with the second account as "personal" and the first account is gone. Reported happening both in onboarding and the main inbox.

**Status**: Root cause fixed and verified working **locally**. Same fix pushed to `main` / GitHub, but the symptom is **still occurring on the Vercel deployment**. This doc is for whoever picks up the Vercel-side investigation.

---

## Root cause (confirmed, fixed)

`lib/auth.ts` — the `jwt` callback's second-account detection compared `user.email` (the account currently signing in) against `token.primary_email`.

**The bug**: Auth.js v5 does *not* pass the previously-issued token into the `jwt` callback on sign-in. Per `@auth/core`'s own types:

> "When `trigger` is `signIn` or `signUp`, [`token`] will be a subset of `JWT` — `name`, `email` and `image` will be included." (i.e. no custom fields like `primary_email`/`work_*`/`access_token`)

Source: `node_modules/@auth/core/src/index.ts` (`callbacks.jwt` type), confirmed by `node_modules/@auth/core/src/lib/actions/callback/index.js` line ~72 — `defaultToken` is built fresh from `{ name, email, picture, sub }` of the *new* sign-in, with no merge of the old session cookie.

**Effect**: `token.primary_email` was always `undefined` during *any* sign-in → `isSecondAccount` was always `false` → every sign-in (including "Connect second Gmail") fell into the "primary account" branch and overwrote `primary_email`/`access_token`/`refresh_token` with the new account's data, wiping out account #1.

---

## Fix applied (commit `d7991e4`, on `main`, pushed)

Added `getPreviousToken()` to `lib/auth.ts`: during the sign-in branch of the `jwt` callback, decode the **still-present old session cookie** (it hasn't been overwritten yet — the new cookie is only written in the response) using `getToken` from `next-auth/jwt` + `cookies()`/`headers()` from `next/headers`. This recovers `primary_email`, `work_email`, `work_access_token`, etc. from the *previous* session so the second-account check actually has something to compare against, and the primary account's tokens get spread forward (`...previous`) instead of clobbered.

```ts
async function getPreviousToken(): Promise<JWT | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  try {
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ")
    if (!cookieHeader) return null
    const secureCookie = requestHeaders.get("x-forwarded-proto") === "https"
    return await getToken({
      req: { headers: new Headers({ cookie: cookieHeader }) },
      secret,
      secureCookie,
    })
  } catch {
    return null
  }
}
```

Verified locally: connecting a second Gmail account during onboarding now correctly stores it as `work_email`/`work_*` and the primary account (`primary_email`, `access_token`, etc.) survives.

**Local-only verification**: `npx tsc --noEmit` ✅, `npx next build` ✅, manual two-account connect flow ✅.

---

## ⚠️ Uncommitted follow-up fix (do this first on the Vercel branch)

While reviewing, found that `getPreviousToken()`'s secret resolution was checking `process.env.NEXTAUTH_SECRET` only. **`next-auth` itself resolves the secret as `AUTH_SECRET ?? NEXTAUTH_SECRET`** (see `node_modules/next-auth/src/lib/env.ts`, `setEnvDefaults`). Locally, `AUTH_SECRET` and `NEXTAUTH_SECRET` happen to be the same value in `.env.local`, so this didn't matter there.

**If Vercel has `AUTH_SECRET` set to a *different* value than `NEXTAUTH_SECRET`** (or only one of the two is set there but they differ from local), then:
- Auth.js encrypts/signs the session cookie using whichever secret it resolves to (`AUTH_SECRET` wins if set).
- `getPreviousToken()` would try to decode with the wrong secret → silent decode failure (caught) → returns `null` → **same bug as before, on Vercel only**.

This has already been edited in the working tree (uncommitted as of this doc):

```ts
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
```

**Action**: commit + push this, *and* check Vercel env vars (see checklist below) regardless — even with this fix, if the two secrets genuinely differ between local and Vercel in a way that breaks decode of *already-issued* cookies, users may need to re-sign-in once after deploy.

---

## Troubleshooting checklist for Vercel

1. **Confirm the deployed commit.** Vercel dashboard → Deployments → check the commit hash matches `d7991e4` or later (and includes the uncommitted secret-precedence fix above once pushed).

2. **Check `AUTH_SECRET` vs `NEXTAUTH_SECRET` in Vercel env vars** (Project Settings → Environment Variables, check Production *and* Preview):
   - Is `AUTH_SECRET` set at all? (Could've been auto-added by `npx auth secret` or a Vercel/Auth.js marketplace integration.)
   - Does its value match `NEXTAUTH_SECRET`?
   - If they differ, either delete the stale one or make them match — then redeploy. Existing sessions will be invalidated (users need to sign in again), which is expected.

3. **Check `NEXTAUTH_URL` / `AUTH_URL`** are set correctly for the production domain (affects redirect URIs and `secureCookie` detection indirectly via `createActionURL`, though our `getPreviousToken` derives `secureCookie` from the `x-forwarded-proto` request header directly, which Vercel sets to `https`).

4. **Cookie size / chunking.** Two accounts' worth of `access_token`/`refresh_token`/`work_*` fields in one JWT cookie may exceed ~4KB and get split into `__Secure-authjs.session-token.0`, `.1`, etc. (flagged as technical debt in `docs/plans/2026-06-11-generic-multi-account-auth.md`). `cookies().getAll()` should return all chunk cookies and `getToken`'s internal `SessionStore` should reconstruct them — but this is a code path that's easy to get subtly wrong and harder to hit locally with only one account's tokens. If steps 1–3 check out, add temporary logging here:
   ```ts
   console.log("cookie names:", cookieStore.getAll().map(c => c.name))
   console.log("previous token keys:", previous ? Object.keys(previous) : null)
   ```
   and check Vercel function logs (`get_runtime_logs` via the Vercel MCP tool, or `vercel logs`) during a second-account sign-in to see whether `previous` comes back `null` and whether chunked cookie names are present.

5. **Confirm Google OAuth redirect URI** for the production domain is registered in Google Cloud Console (`https://<vercel-domain>/api/auth/callback/google`) — a redirect mismatch would surface as a different error (Google error page), not this symptom, but worth ruling out if anything about the flow looks off.

---

## How to manually test once redeployed

1. Sign out completely (clear cookies for the domain, or use an incognito window).
2. Sign in with Account A → confirm it's "Personal" (check Settings → Accounts shows Account A's email under Personal).
3. Click "Connect second Gmail" → pick Account B (`prompt: "select_account consent"` should show the account chooser).
4. After redirect back, Settings → Accounts should show **both** Account A (Personal) and Account B (Work) — Account A must NOT disappear.
5. Refresh the page — both accounts should persist (tests that the JWT round-trips through cookie encode/decode correctly, including chunking if applicable).

---

## Relevant files

- `lib/auth.ts` — the fix (jwt callback + `getPreviousToken`)
- `lib/types.ts` — `JWT`/`Session` type augmentations (`primary_email`, `work_email`, `work_*`)
- `components/settings/AccountsSettings.tsx` — "Connect second Gmail" button, swap accounts
- `docs/plans/2026-06-11-generic-multi-account-auth.md` — original design doc + cookie-size technical debt note
