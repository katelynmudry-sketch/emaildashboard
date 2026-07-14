import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { unarchiveMessage } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { ArchiveRequest } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { messageId, account }: ArchiveRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    await unarchiveMessage(authz.accessToken, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[gmail/unarchive]", err)
    return NextResponse.json({ error: "Unarchive failed" }, { status: 500 })
  }
}
