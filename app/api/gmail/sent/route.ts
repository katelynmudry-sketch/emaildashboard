import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGmailService } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

interface SentEmail {
  id: string
  to: string
  subject: string
  date: string
  snippet: string
}

export async function GET(request: Request) {
  const session = await auth()
  const url = new URL(request.url)
  const accountId = parseAccountId(url.searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const gmail = getGmailService(authz.accessToken)
    const list = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 30,
    })
    const messages = await Promise.all(
      (list.data.messages ?? []).map(m =>
        gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["To", "Subject", "Date"],
        })
      )
    )
    const emails: SentEmail[] = messages.map(msg => ({
      id: msg.data.id!,
      to: msg.data.payload?.headers?.find(h => h.name === "To")?.value ?? "",
      subject: msg.data.payload?.headers?.find(h => h.name === "Subject")?.value ?? "(no subject)",
      date: new Date(Number(msg.data.internalDate)).toISOString(),
      snippet: (msg.data.snippet ?? "").slice(0, 120),
    }))
    return NextResponse.json({ emails })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sent" },
      { status: 500 }
    )
  }
}
