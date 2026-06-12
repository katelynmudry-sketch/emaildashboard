import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { UnsubscribeRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { unsubscribeUrl, account }: UnsubscribeRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const res = await fetch(unsubscribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Sender returned ${res.status}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unsubscribe failed" }, { status: 500 })
  }
}
