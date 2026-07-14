import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { fetchInboxMessages, fetchExistingLabels } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

const ALLOWED_MAX = new Set([30, 50, 100])

export async function GET(request: Request) {
  const token = await getServerToken()
  const url = new URL(request.url)
  const accountId = parseAccountId(url.searchParams.get("account"))
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const rawMax = url.searchParams.get("max")
    const parsed = rawMax ? parseInt(rawMax, 10) : 30
    const maxResults = ALLOWED_MAX.has(parsed) ? parsed : 30

    const unreadOnly = url.searchParams.get("unreadOnly") !== "false"
    const sortOrderParam = url.searchParams.get("sortOrder")
    const sortOrder: "newest" | "oldest" = sortOrderParam === "oldest" ? "oldest" : "newest"

    const [{ emails, totalUnread }, existingLabels] = await Promise.all([
      fetchInboxMessages(authz.accessToken, { maxResults, unreadOnly, sortOrder }),
      fetchExistingLabels(authz.accessToken),
    ])

    const todoLabel = existingLabels.find(l => l.name.toLowerCase() === "todo")
    const todoLabelId = todoLabel?.id ?? null

    return NextResponse.json({ emails, totalUnread, maxResults, todoLabelId })
  } catch (err) {
    console.error("[gmail/messages]", err)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}
