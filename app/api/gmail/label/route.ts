import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { applyLabel } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { LabelRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { messageId, gmailLabelId, account }: LabelRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    await applyLabel(authz.accessToken, messageId, gmailLabelId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Label apply failed" }, { status: 500 })
  }
}
