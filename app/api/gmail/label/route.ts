import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { applyLabel } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { LabelRequest } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { messageId, gmailLabelId, account }: LabelRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    await applyLabel(authz.accessToken, messageId, gmailLabelId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[gmail/label]", err)
    return NextResponse.json({ error: "Label apply failed" }, { status: 500 })
  }
}
