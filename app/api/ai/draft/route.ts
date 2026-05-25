import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateDraftReply } from "@/lib/claude"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { email, partialDraft } = await request.json()
    const account = session.user?.email ?? ""
    const draft = await generateDraftReply(email, account, partialDraft ?? "")
    return NextResponse.json({ draft })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Draft generation failed" }, { status: 500 })
  }
}
