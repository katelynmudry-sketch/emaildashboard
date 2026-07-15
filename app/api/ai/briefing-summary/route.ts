import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { generateBriefingSummary, type BriefingInput } from "@/lib/claude"

export async function POST(request: Request) {
  const token = await getServerToken()
  if (!token?.access_token && !token?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { emails, mode }: { emails: BriefingInput[]; mode?: string } = await request.json()
    if (Array.isArray(emails) && emails.length > 150) {
      return NextResponse.json({ error: "Too many emails — max 150 per request" }, { status: 400 })
    }
    const summary = await generateBriefingSummary(emails, mode ?? "party")
    return NextResponse.json({ summary })
  } catch (err) {
    console.error("[ai/briefing-summary]", err)
    return NextResponse.json({ error: "Briefing summary failed" }, { status: 500 })
  }
}
