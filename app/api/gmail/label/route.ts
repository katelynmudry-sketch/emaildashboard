import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { applyLabel } from "@/lib/gmail"
import type { LabelRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messageId, gmailLabelId }: LabelRequest = await request.json()
    await applyLabel(session.access_token, messageId, gmailLabelId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Label apply failed" }, { status: 500 })
  }
}
