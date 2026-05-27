import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

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
          ].join(" "),
          access_type: "offline",
          prompt: "consent", // always get refresh_token
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, user }) {
      const workEmail = (process.env.NEXT_PUBLIC_OWNER_WORK_EMAIL ?? "").trim().toLowerCase()

      if (account && user?.email) {
        const u = user.email.toLowerCase()
        const isWork = !!workEmail && u === workEmail
        if (isWork) {
          return {
            ...token,
            work_access_token: account.access_token,
            work_refresh_token: account.refresh_token ?? token.work_refresh_token,
            work_expires_at: account.expires_at,
            work_error: undefined,
          }
        }
        return {
          ...token,
          access_token: account.access_token,
          refresh_token: account.refresh_token ?? token.refresh_token,
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
        work_access_token: token.work_access_token as string | undefined,
        work_refresh_token: token.work_refresh_token as string | undefined,
        work_expires_at: token.work_expires_at as number | undefined,
        work_error: token.work_error as "RefreshTokenError" | undefined,
        workAccountLinked: !!token.work_refresh_token,
      }
    },
  },
})
