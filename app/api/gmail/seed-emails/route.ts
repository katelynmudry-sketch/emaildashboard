import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchInboxMessages } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const session = await auth()
  const url = new URL(request.url)
  const accountId = parseAccountId(url.searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const { emails } = await fetchInboxMessages(authz.accessToken, {
      maxResults: 100,
      unreadOnly: false,
      sortOrder: "newest",
    })
    return NextResponse.json({ emails })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch seed emails" }, { status: 500 })
  }
}
