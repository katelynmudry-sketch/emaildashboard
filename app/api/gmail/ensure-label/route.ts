import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ensureLabel } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { name, account }: { name: string; account?: AccountId } = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const id = await ensureLabel(authz.accessToken, name)
    return NextResponse.json({ id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Label creation failed" }, { status: 500 })
  }
}
