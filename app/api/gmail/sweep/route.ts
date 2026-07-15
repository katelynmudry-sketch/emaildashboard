import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { sweepOlderMessages } from "@/lib/gmail"
import { proposeSweepDeletions } from "@/lib/claude"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export const maxDuration = 60

export async function GET(request: Request) {
  const token = await getServerToken()
  const { searchParams } = new URL(request.url)
  const accountId = parseAccountId(searchParams.get("account"))
  const pageToken = searchParams.get("pageToken") ?? undefined
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const page = await sweepOlderMessages(authz.accessToken, pageToken)
    const suggestions = await proposeSweepDeletions(
      page.messages.map(m => ({ id: m.id, subject: m.subject, from: m.from })),
    )
    const reasonById = new Map(suggestions.map(s => [s.id, s.reason]))

    return NextResponse.json({
      messages: page.messages.map(m => ({
        ...m,
        deletable: reasonById.has(m.id),
        reason: reasonById.get(m.id) ?? null,
      })),
      nextPageToken: page.nextPageToken,
      resultSizeEstimate: page.resultSizeEstimate,
    })
  } catch (err) {
    console.error("[gmail/sweep]", err)
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 })
  }
}
