import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { searchRecentDeliveries } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const token = await getServerToken()
  const accountId = parseAccountId(new URL(request.url).searchParams.get("account"))
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const deliveries = await searchRecentDeliveries(authz.accessToken)
    return NextResponse.json(deliveries)
  } catch (err) {
    console.error("[gmail/recent-deliveries]", err)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
