import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchRecentDeliveries } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const session = await auth()
  const accountId = parseAccountId(new URL(request.url).searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const deliveries = await searchRecentDeliveries(authz.accessToken)
    return NextResponse.json(deliveries)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed" }, { status: 500 })
  }
}
