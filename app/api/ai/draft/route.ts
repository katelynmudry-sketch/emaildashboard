import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateDraftReply } from "@/lib/claude"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { email, partialDraft, systemContext, customContext, aboutYouContext } = await request.json()
    const account = session.user?.email ?? ""
    const settings = (systemContext || customContext || aboutYouContext) ? { systemContext, customContext, aboutYouContext } : undefined
    const draft = await generateDraftReply(email, account, partialDraft ?? "", settings)
    return NextResponse.json({ draft })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Draft generation failed" }, { status: 500 })
  }
}
