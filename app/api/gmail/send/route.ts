import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { DraftRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  const { to, subject, body, threadId, inReplyTo, messageId, account, attachments }: DraftRequest = await request.json()
  
  if (!to || !to.trim()) {
    return NextResponse.json({ error: "Recipient email address is required" }, { status: 400 })
  }

  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  const workEmail = (process.env.NEXT_PUBLIC_OWNER_WORK_EMAIL ?? "").trim().toLowerCase()
  const from = account === "work" && workEmail ? workEmail : (session?.user?.email ?? "")

  try {
    await sendEmail(authz.accessToken, to, subject, body, threadId, inReplyTo, messageId, from, attachments)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[send] Error sending email:", err)
    const message = err instanceof Error ? err.message : "Send failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
