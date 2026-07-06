import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ensureLabel, applyLabel, removeLabel } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

const BRIEFING_LABEL = "BRIEFING"
const BRIEFING_EXCLUDED_LABEL = "BRIEFING_EXCLUDED"

export async function POST(request: Request) {
  const session = await auth()
  const { messageId, value, account }: { messageId: string; value: "include" | "exclude" | null; account?: AccountId } = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const [includeId, excludeId] = await Promise.all([
      ensureLabel(authz.accessToken, BRIEFING_LABEL),
      ensureLabel(authz.accessToken, BRIEFING_EXCLUDED_LABEL),
    ])

    if (value === "include") {
      await applyLabel(authz.accessToken, messageId, includeId)
      await removeLabel(authz.accessToken, messageId, excludeId)
    } else if (value === "exclude") {
      await applyLabel(authz.accessToken, messageId, excludeId)
      await removeLabel(authz.accessToken, messageId, includeId)
    } else {
      await removeLabel(authz.accessToken, messageId, includeId)
      await removeLabel(authz.accessToken, messageId, excludeId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Briefing label failed" }, { status: 500 })
  }
}
