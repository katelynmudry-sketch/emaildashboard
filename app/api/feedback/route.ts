import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/gmail"

const RECIPIENT = "katelynmudry@gmail.com"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accessToken = session.access_token
  if (!accessToken) return NextResponse.json({ error: "No Gmail access" }, { status: 401 })

  const { message } = await request.json()
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const senderEmail = session.user?.email ?? "unknown"
  const subject = `[Email Party Feedback] ${message.trim().slice(0, 60)}`
  const body = `From: ${senderEmail}\nSent: ${new Date().toLocaleString()}\n\n${message.trim()}`

  try {
    await sendEmail(accessToken, RECIPIENT, subject, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[feedback] Error sending:", err)
    const msg = err instanceof Error ? err.message : "Send failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
