import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { getToken, type JWT } from "next-auth/jwt"
import { cookies, headers } from "next/headers"

/**
 * On sign-in, Auth.js calls the jwt callback with a bare `defaultToken`
 * (just name/email/picture/sub from the account being signed in) — it does
 * NOT carry over the previously-issued token's custom fields. To detect a
 * "second account" sign-in (and to avoid clobbering the first account's
 * tokens), we decode the still-present old session cookie ourselves.
 */
async function getPreviousToken(): Promise<JWT | null> {
  // Match the secret resolution next-auth itself uses (lib/env.ts):
  // AUTH_SECRET takes precedence over NEXTAUTH_SECRET.
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

async function refreshGoogleAccess(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!res.ok || !data.access_token || data.expires_in == null) {
    throw data
  }
  return {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/drive.file",
          ].join(" "),
          access_type: "offline",
          prompt: "consent", // always get refresh_token
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, user, trigger, session }) {
      // Swap which linked account is "personal" vs "work" — triggered via
      // useSession().update({ swapAccounts: true }) from the Accounts settings tab.
      if (trigger === "update" && (session as { swapAccounts?: boolean } | null)?.swapAccounts) {
        const workEmail = token.work_email as string | undefined
        if (!workEmail) return token

        return {
          ...token,
          email: workEmail,
          primary_email: workEmail,
          access_token: token.work_access_token,
          refresh_token: token.work_refresh_token,
          expires_at: token.work_expires_at,
          error: token.work_error,
          work_email: token.primary_email,
          work_access_token: token.access_token,
          work_refresh_token: token.refresh_token,
          work_expires_at: token.expires_at,
          work_error: token.error,
        }
      }

      if (account && user?.email) {
        const newEmail = user.email.toLowerCase()
        // `token` here is just a bare {name, email, picture, sub} for the
        // account that's signing in right now — it doesn't carry the
        // previously-issued token's custom fields. Decode the still-present
        // old session cookie to find out who the primary account was.
        const previous = await getPreviousToken()
        const primaryEmail = previous?.primary_email?.toLowerCase()

        // Second account: a different email signed in while a primary is already stored
        const isSecondAccount = !!primaryEmail && newEmail !== primaryEmail
        if (isSecondAccount) {
          return {
            ...previous,
            // Restore the primary's email — the new sign-in's email belongs in work_email.
            email: primaryEmail,
            work_email: newEmail,
            work_access_token: account.access_token,
            work_refresh_token: account.refresh_token ?? previous?.work_refresh_token,
            work_expires_at: account.expires_at,
            work_error: undefined,
          }
        }

        // Primary account (first sign-in, or re-authenticating same email)
        return {
          ...previous,
          ...token,
          email: user.email,
          primary_email: newEmail,
          access_token: account.access_token,
          refresh_token: account.refresh_token ?? previous?.refresh_token,
          expires_at: account.expires_at,
          error: undefined,
        }
      }

      let next: Record<string, unknown> = { ...token }

      if (typeof next.refresh_token === "string" && typeof next.expires_at === "number") {
        if (Date.now() >= next.expires_at * 1000 - 60_000) {
          try {
            const r = await refreshGoogleAccess(next.refresh_token)
            next = { ...next, access_token: r.access_token, expires_at: r.expires_at, error: undefined }
          } catch {
            next = { ...next, access_token: undefined, error: "RefreshTokenError" as const }
          }
        }
      }

      if (typeof next.work_refresh_token === "string" && typeof next.work_expires_at === "number") {
        if (Date.now() >= next.work_expires_at * 1000 - 60_000) {
          try {
            const r = await refreshGoogleAccess(next.work_refresh_token)
            next = { ...next, work_access_token: r.access_token, work_expires_at: r.expires_at, work_error: undefined }
          } catch {
            next = { ...next, work_access_token: undefined, work_error: "RefreshTokenError" as const }
          }
        }
      }

      return next
    },

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
  },
})
