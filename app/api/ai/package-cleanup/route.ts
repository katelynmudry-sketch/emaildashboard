import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"
import { searchArchivedMessages } from "@/lib/gmail"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deliveredEmailId, orderSender }: { deliveredEmailId: string; orderSender: string } = await request.json()

    const candidates = await searchArchivedMessages(session.access_token, orderSender)
    if (candidates.length === 0) {
      return NextResponse.json({ emailIds: [] })
    }

    const prompt = `Sender domain: ${orderSender}

These emails are archived Gmail messages from that sender. Return only the IDs that are clearly part of the same order/shipping chain (order confirmation, shipping notification, tracking update, delivery confirmation):

${candidates.map(c => `ID: ${c.id}\nSubject: ${c.subject}`).join("\n---\n")}

Return a JSON array of IDs only, e.g. ["id1","id2"]. No explanation.`

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    })

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]"
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonText = fenced ? fenced[1].trim() : raw.trim()

    let emailIds: string[]
    try {
      emailIds = JSON.parse(jsonText)
    } catch {
      emailIds = []
    }

    const validIds = new Set(candidates.map(c => c.id))
    emailIds = emailIds.filter(id => validIds.has(id))

    return NextResponse.json({ emailIds })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cleanup failed" }, { status: 500 })
  }
}
