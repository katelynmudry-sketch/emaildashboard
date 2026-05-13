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

    const prompt = `You are a brutally funny comedian roasting someone's email inbox. Look at this inbox and write ONE savage, specific joke about it.

Rules:
- Must reference something actually IN the inbox (a real sender, subject line, or obvious pattern)
- Punch down on the emails, not the person — mock the newsletters, the promotional spam, the ignored bills
- Dry wit preferred over loud humor. Think: late-night monologue writer, not Twitter stan
- Under 30 words
- No hashtags, no emojis, no quotes around it, no "Your inbox is..." opener
- Just the roast. No preamble.

Inbox:
${snapshot}

Remember: be specific, be mean to the emails, make it actually funny.`

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    })

    const roast = response.content[0].type === "text" ? response.content[0].text.trim() : "Your inbox is a mystery even Claude can't explain."
    return NextResponse.json({ roast })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Roast failed" }, { status: 500 })
  }
}
