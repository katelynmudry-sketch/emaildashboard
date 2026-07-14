import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { UnsubscribeRequest } from "@/lib/types"

export async function POST(request: Request) {
  const token = await getServerToken()
  const { unsubscribeUrl, account }: UnsubscribeRequest = await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
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
    console.error("[gmail/unsubscribe]", err)
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 500 })
  }
}
