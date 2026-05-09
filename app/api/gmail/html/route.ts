import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGmailService, extractHtmlBody } from "@/lib/gmail"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const gmail = getGmailService(session.access_token)
  const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" })
  const htmlBody = extractHtmlBody(msg.data.payload)

  return NextResponse.json({ htmlBody: htmlBody || null })
}
