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
    const { emails, existingLabelNames, account }: ProposeRequest = await request.json()
    const result = await proposeCategories(emails, existingLabelNames, account)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Proposal failed" }, { status: 500 })
  }
}
