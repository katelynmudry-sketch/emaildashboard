import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { archiveMessage } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { ArchiveRequest } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { messageId, account }: ArchiveRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    await archiveMessage(authz.accessToken, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[gmail/archive]", err)
    return NextResponse.json({ error: "Archive failed" }, { status: 500 })
  }
}
