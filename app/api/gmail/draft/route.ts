import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createDraft } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { DraftRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { to, subject, body, threadId, inReplyTo, messageId, account, attachments }: DraftRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const draftId = await createDraft(authz.accessToken, to, subject, body, threadId, inReplyTo, messageId, attachments)
    return NextResponse.json({ draftId })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Draft creation failed" }, { status: 500 })
  }
}
