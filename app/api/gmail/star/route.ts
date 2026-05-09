import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { starMessage } from "@/lib/gmail"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messageId }: { messageId: string } = await request.json()
    await starMessage(session.access_token, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Star failed" }, { status: 500 })
  }
}
