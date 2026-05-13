import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGmailService, extractHtmlBody } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const session = await auth()
  const { searchParams } = new URL(request.url)
  const accountId = parseAccountId(searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const gmail = getGmailService(authz.accessToken)
  const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" })
  const htmlBody = extractHtmlBody(msg.data.payload)

  return NextResponse.json({ htmlBody: htmlBody || null })
}
