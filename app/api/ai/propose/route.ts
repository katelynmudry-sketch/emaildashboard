import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { proposeCategories } from "@/lib/claude"
import type { ProposeRequest } from "@/lib/types"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { emails, existingLabelNames, account, customContext, systemContext, aboutYouContext, dreamInboxContext }: ProposeRequest & { customContext?: string; systemContext?: string; aboutYouContext?: string; dreamInboxContext?: string } = await request.json()
    const isWork = !!session.work_email && account === session.work_email
    const result = await proposeCategories(emails, existingLabelNames, account, isWork, { customContext, systemContext, aboutYouContext, dreamInboxContext })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Proposal failed" }, { status: 500 })
  }
}
