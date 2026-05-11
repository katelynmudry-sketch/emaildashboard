import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

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
          ].join(" "),
          access_type: "offline",
          prompt: "consent", // always get refresh_token
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: persist tokens
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        }
      }

      // Token still valid
      if (Date.now() < (token.expires_at as number) * 1000 - 60_000) {
        return token
      }

      // Refresh expired token
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refresh_token as string,
          }),
        })
        const refreshed = await res.json()
        if (!res.ok) throw refreshed
        return {
          ...token,
          access_token: refreshed.access_token,
          expires_at: Math.floor(Date.now() / 1000 + refreshed.expires_in),
          // refresh_token is not rotated by Google, keep existing
        }
      } catch {
        return { ...token, error: "RefreshTokenError" as const }
      }
    },

    async session({ session, token }) {
      return {
        ...session,
        access_token: token.access_token as string,
        refresh_token: token.refresh_token as string,
        expires_at: token.expires_at as number,
        error: token.error as "RefreshTokenError" | undefined,
      }
    },
  },
})
