import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { ensureLabel } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { name, account }: { name: string; account?: AccountId } = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const id = await ensureLabel(authz.accessToken, name)
    return NextResponse.json({ id })
  } catch (err) {
    console.error("[gmail/ensure-label]", err)
    return NextResponse.json({ error: "Label creation failed" }, { status: 500 })
  }
}
