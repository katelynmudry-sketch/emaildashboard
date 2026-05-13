import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markAsRead } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { ReadRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { messageId, account }: ReadRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    await markAsRead(authz.accessToken, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Mark read failed" }, { status: 500 })
  }
}
