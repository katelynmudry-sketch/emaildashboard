import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { AccountId } from "./types"

export function parseAccountId(value: string | null | undefined): AccountId {
  if (value === "work") return "work"
  return "personal"
}

export type GmailAuthResult =
  | { success: true; accessToken: string }
  | { success: false; response: NextResponse }

export function requireGmailAccess(session: Session | null, accountId: AccountId): GmailAuthResult {
  if (!session) {
    return { success: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (accountId === "work") {
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
