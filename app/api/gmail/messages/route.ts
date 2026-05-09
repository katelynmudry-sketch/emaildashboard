import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchInboxMessages } from "@/lib/gmail"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.error === "RefreshTokenError") {
    return NextResponse.json({ error: "TokenExpired" }, { status: 401 })
  }

  try {
    const emails = await fetchInboxMessages(session.access_token)
    return NextResponse.json(emails)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch messages" }, { status: 500 })
  }
}
