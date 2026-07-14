import { NextResponse } from "next/server"
import { auth, getServerToken } from "@/lib/auth"
import { generateDraftReply } from "@/lib/claude"

export async function POST(request: Request) {
  const [session, token] = await Promise.all([auth(), getServerToken()])
  if (!token?.access_token && !token?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { email, partialDraft, systemContext, customContext, aboutYouContext, dreamInboxContext, draftTone } = await request.json()
    const account = session?.user?.email ?? ""
    const settings = (systemContext || customContext || aboutYouContext || dreamInboxContext || draftTone)
      ? { systemContext, customContext, aboutYouContext, dreamInboxContext, draftTone }
      : undefined
    const draft = await generateDraftReply(email, account, partialDraft ?? "", settings)
    return NextResponse.json({ draft })
  } catch (err) {
    console.error("[ai/draft]", err)
    return NextResponse.json({ error: "Draft generation failed" }, { status: 500 })
  }
}
