import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { AccountId } from "./types"

const WORK_CONFIGURED = !!(process.env.NEXT_PUBLIC_OWNER_WORK_EMAIL ?? "").trim()

export function parseAccountId(value: string | null | undefined): AccountId {
  if (value === "work" && WORK_CONFIGURED) return "work"
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
    if (!WORK_CONFIGURED) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Work inbox is not configured.", code: "WORK_ACCOUNT_NOT_CONFIGURED" as const },
          { status: 403 },
        ),
      }
    }
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
