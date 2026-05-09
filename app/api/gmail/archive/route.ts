import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { archiveMessage } from "@/lib/gmail"
import type { ArchiveRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messageId }: ArchiveRequest = await request.json()
    await archiveMessage(session.access_token, messageId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Archive failed" }, { status: 500 })
  }
}
