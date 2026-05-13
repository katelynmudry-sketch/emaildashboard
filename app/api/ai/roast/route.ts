import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { emails } = await request.json() as { emails: { from: string; subject: string; category: string; priority: string }[] }

    const snapshot = emails
      .slice(0, 60)
      .map(e => `- [${e.priority}] ${e.subject} (from ${e.from})`)
      .join("\n")

    const prompt = `Here is someone's current email inbox. Write a single savage, witty one-liner roasting the vibe of this inbox. Be specific — reference actual senders, subjects, or patterns you see. Keep it under 25 words. No hashtags, no emojis, no quotes around it. Just the roast.

Inbox:
${snapshot}`

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    })

    const roast = response.content[0].type === "text" ? response.content[0].text.trim() : "Your inbox is a mystery even Claude can't explain."
    return NextResponse.json({ roast })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Roast failed" }, { status: 500 })
  }
}
