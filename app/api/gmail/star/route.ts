import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { starMessage } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { messageId, account }: { messageId: string; account?: AccountId } = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    await starMessage(authz.accessToken, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[gmail/star]", err)
    return NextResponse.json({ error: "Star failed" }, { status: 500 })
  }
}
