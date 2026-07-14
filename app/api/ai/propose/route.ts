import { NextResponse } from "next/server"
import { auth, getServerToken } from "@/lib/auth"
import { proposeCategories } from "@/lib/claude"
import type { ProposeRequest } from "@/lib/types"

export async function POST(request: Request) {
  const [session, token] = await Promise.all([auth(), getServerToken()])
  if (!token?.access_token && !token?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { emails, existingLabelNames, account, customContext, systemContext, aboutYouContext, dreamInboxContext }: ProposeRequest & { customContext?: string; systemContext?: string; aboutYouContext?: string; dreamInboxContext?: string } = await request.json()
    if (Array.isArray(emails) && emails.length > 100) {
      return NextResponse.json({ error: "Too many emails — max 100 per request" }, { status: 400 })
    }
    const isWork = !!session?.work_email && account === session.work_email
    const result = await proposeCategories(emails, existingLabelNames, account, isWork, { customContext, systemContext, aboutYouContext, dreamInboxContext })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[ai/propose]", err)
    return NextResponse.json({ error: "Proposal failed" }, { status: 500 })
  }
}
