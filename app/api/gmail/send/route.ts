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

  const from = account === "work" && session?.work_email ? session.work_email : (session?.user?.email ?? "")

  console.log("[send] to:", to, "| bodyLen:", body?.length, "| bodyPreview:", body?.slice(0, 80))

  try {
    await sendEmail(authz.accessToken, to, subject, body, threadId, inReplyTo, messageId, from, attachments)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[send] Error sending email:", err)
    const message = err instanceof Error ? err.message : "Send failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
