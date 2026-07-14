import { NextResponse } from "next/server"
import { auth, getServerToken } from "@/lib/auth"
import { sendEmail } from "@/lib/gmail"

const RECIPIENT = "katelynmudry@gmail.com"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getServerToken()
  const accessToken = token?.access_token as string | undefined
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
    return NextResponse.json({ error: "Send failed" }, { status: 500 })
  }
}
