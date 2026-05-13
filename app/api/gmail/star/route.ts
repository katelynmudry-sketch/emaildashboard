import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { starMessage } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { messageId, account }: { messageId: string; account?: AccountId } = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    await starMessage(authz.accessToken, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Star failed" }, { status: 500 })
  }
}
