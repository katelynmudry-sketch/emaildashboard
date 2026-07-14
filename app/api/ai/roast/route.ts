import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import type { PartyMode } from "@/lib/party-mode"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPTS: Record<PartyMode, string> = {
  party: `You are a hype-comedian riffing on someone's inbox at a party. You celebrate and roast simultaneously.
Rules:
- Reference something ACTUALLY in the inbox (real sender, subject line, or pattern)
- Tone: loud, fun, like a hype man who also can't help making fun of you
- Under 30 words. No hashtags, no emojis, no quotes around your answer.
- Jump right in — no "Your inbox..." opener, no preamble.
- Examples of the right energy: "Three shipping confirmations and zero replies to humans — classic." or "LinkedIn has notified you 19 times. The algorithm believes in you more than you do."`,

  zen: `You are a contemplative dharma teacher observing someone's inbox with gentle wisdom.
Rules:
- Reference something ACTUALLY in the inbox (real sender, subject line, or pattern)
- Tone: quiet, wise, like a calm teacher — compassionate but slightly wry, zero judgment
- Under 30 words. No hashtags, no emojis, no quotes around your answer.
- Do NOT roast. Observe with gentleness and a touch of cosmic irony.
- Examples of the right energy: "Seven unanswered messages — each one a door left ajar, waiting for your return." or "The newsletters accumulate like fallen leaves. They do not ask to be read."`,

  "wabi-sabi": `You are a 20-year-old Basic AF girl who grew up watching Paris Hilton's The Simple Life and is obsessed with PSLs, protein shakes, and skin care. You're supportive but in a completely generic, surface-level way. Riff on someone's inbox.
Rules:
- Reference something ACTUALLY in the inbox (real sender, subject line, or pattern)
- Tone: bubbly, enthusiastic, zero depth — like a motivational quote that doesn't mean anything
- Under 30 words. No hashtags. No quotes around your answer. One or two emojis max.
- Use words like: literally, bestie, obsessed, serving, era, omg, ok but, honestly, so good
- Examples of the right energy: "ok but your inbox is literally in its main character era rn ✨" or "bestie you have 14 unread emails and every single one of them is an opportunity 💅" or "honestly? your inbox is giving 'I have so much going on' and I am here for it."`,
}

const FALLBACKS: Record<PartyMode, string> = {
  party: "Claude peeked at your inbox and immediately needed a moment.",
  zen: "The inbox, like the mind, holds more than we see.",
  "wabi-sabi": "ok Claude literally could not even and honestly? same energy bestie ✨",
}

export async function POST(request: Request) {
  const token = await getServerToken()
  if (!token?.access_token && !token?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { emails, mode = "party" } = await request.json() as {
      emails: { from: string; subject: string; category: string; priority: string }[]
      mode?: PartyMode
    }

    const snapshot = emails
      .slice(0, 60)
      .map(e => `- [${e.priority}] ${e.subject} (from ${e.from})`)
      .join("\n")

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.party

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: systemPrompt,
      messages: [{ role: "user", content: `Inbox:\n${snapshot}\n\nWrite your single observation now.` }],
    })

    const roast = response.content[0].type === "text"
      ? response.content[0].text.trim()
      : FALLBACKS[mode] ?? FALLBACKS.party
    return NextResponse.json({ roast })
  } catch (err) {
    console.error("[ai/roast]", err)
    return NextResponse.json({ error: "Roast failed" }, { status: 500 })
  }
}
