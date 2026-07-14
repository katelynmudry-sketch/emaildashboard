import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getServerToken } from "@/lib/auth"
import { searchArchivedMessages } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const token = await getServerToken()
  const { deliveredEmailId, orderSender, account }: { deliveredEmailId: string; orderSender: string; account?: AccountId } =
    await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const candidates = await searchArchivedMessages(authz.accessToken, orderSender)
    if (candidates.length === 0) {
      return NextResponse.json({ emailIds: [] })
    }

    const prompt = `Sender: ${orderSender}

These are archived Gmail messages from that sender. Return the IDs of all emails that are shipping/delivery notifications (order confirmations, shipping updates, out for delivery, delivered notices, tracking updates, package notifications, shipment updates). These are safe to delete.

${candidates.map(c => `ID: ${c.id}\nSubject: ${c.subject}`).join("\n---\n")}

Return a JSON array of IDs only, e.g. ["id1","id2"]. No explanation.`

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
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

    const validMap = new Map(candidates.map(c => [c.id, c]))
    emailIds = emailIds.filter(id => validMap.has(id))
    const emails = emailIds.map(id => {
      const c = validMap.get(id)!
      return { id: c.id, subject: c.subject, date: c.date, snippet: c.snippet }
    })

    return NextResponse.json({ emailIds, emails })
  } catch (err) {
    console.error("[ai/package-cleanup]", err)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}
