import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ensureLabel, applyLabel, removeLabel } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

const TODO_LABEL_NAME = "TODO"

export async function POST(request: Request) {
  const session = await auth()
  const { messageId, value, account }: { messageId: string; value: boolean; account?: AccountId } = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const labelId = await ensureLabel(authz.accessToken, TODO_LABEL_NAME)
    if (value) {
      await applyLabel(authz.accessToken, messageId, labelId)
    } else {
      await removeLabel(authz.accessToken, messageId, labelId)
    }
    return NextResponse.json({ ok: true, labelId })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "TODO label failed" }, { status: 500 })
  }
}
