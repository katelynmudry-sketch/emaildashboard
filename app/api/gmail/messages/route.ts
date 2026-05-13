import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchInboxMessages } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

const ALLOWED_MAX = new Set([30, 50, 100])

export async function GET(request: Request) {
  const session = await auth()
  const url = new URL(request.url)
  const accountId = parseAccountId(url.searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const rawMax = url.searchParams.get("max")
    const parsed = rawMax ? parseInt(rawMax, 10) : 30
    const maxResults = ALLOWED_MAX.has(parsed) ? parsed : 30

    const { emails, totalUnread } = await fetchInboxMessages(authz.accessToken, maxResults)
    return NextResponse.json({ emails, totalUnread, maxResults })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch messages" }, { status: 500 })
  }
}
