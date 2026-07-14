import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { createDraft } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { DraftRequest } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { to, subject, body, threadId, inReplyTo, messageId, account, attachments }: DraftRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const draftId = await createDraft(authz.accessToken, to, subject, body, threadId, inReplyTo, messageId, attachments)
    return NextResponse.json({ draftId })
  } catch (err) {
    console.error("[gmail/draft]", err)
    return NextResponse.json({ error: "Draft creation failed" }, { status: 500 })
  }
}
