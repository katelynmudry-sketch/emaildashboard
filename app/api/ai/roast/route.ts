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

    const prompt = `You are a witty comedian riffing on someone's email inbox. Look at this inbox and write ONE specific, clever joke about it.

Rules:
- Must reference something actually IN the inbox (a real sender, subject line, or obvious pattern)
- Pick ONE of these styles — whichever fits the inbox best:
  - Dry corporate satire: mock the emails like a bored analyst ("14 newsletters from brands you haven't shopped at since 2019.")
  - Talk show monologue: light, punchy one-liner ("LinkedIn has notified you 47 times. Somewhere, a recruiter is still optimistic.")
  - Affectionate ribbing: warm, friendly poke ("Bold of you to keep 3 Duolingo guilt trips. The owl believes in you.")
  - Absurdist: lean into inbox weirdness ("Your spam folder has a richer social life than most people.")
- Under 30 words
- No hashtags, no emojis, no quotes around it, no "Your inbox is..." opener
- Just the joke. No preamble.

Inbox:
${snapshot}

Be witty and specific.`

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
