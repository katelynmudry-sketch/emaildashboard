import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { markAsRead } from "@/lib/gmail"
import type { ReadRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messageId }: ReadRequest = await request.json()
    await markAsRead(session.access_token, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Mark read failed" }, { status: 500 })
  }
}
