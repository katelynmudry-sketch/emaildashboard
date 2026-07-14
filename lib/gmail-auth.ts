import { NextResponse } from "next/server"
import type { JWT } from "next-auth/jwt"
import type { AccountId } from "./types"

export function parseAccountId(value: string | null | undefined): AccountId {
  if (value === "work") return "work"
  return "personal"
}

export type GmailAuthResult =
  | { success: true; accessToken: string }
  | { success: false; response: NextResponse }

/** `token` comes from getServerToken() — never from the client-facing Session. */
export function requireGmailAccess(token: JWT | null, accountId: AccountId): GmailAuthResult {
  if (!token) {
    return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (accountId === "work") {
    if (!token.work_refresh_token) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Connect this Google account to load this inbox.", code: "ACCOUNT_NOT_LINKED" as const },
          { status: 403 },
        ),
      }
    }
    if (token.work_error === "RefreshTokenError") {
      return { success: false, response: NextResponse.json({ error: "TokenExpired" }, { status: 401 }) }
    }
    if (!token.work_access_token) {
      return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }
    return { success: true, accessToken: token.work_access_token }
  }

  if (token.error === "RefreshTokenError") {
    return { success: false, response: NextResponse.json({ error: "TokenExpired" }, { status: 401 }) }
  }
  if (!token.access_token) {
    return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { success: true, accessToken: token.access_token as string }
}
