import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getServerToken } from "@/lib/auth"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import { fetchInboxMessages, getGmailService } from "@/lib/gmail"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sanitizeUtf8(str: string): string {
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�")
}

export async function POST(request: Request) {
  const token = await getServerToken()
  const { account, target } = await request.json().catch(() => ({ account: undefined, target: undefined }))
  const accountId = parseAccountId(account)
  const wantsDraftTone = target === "draftTone"
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const gmail = getGmailService(authz.accessToken)

    const [{ emails: received }, sentList] = await Promise.all([
      fetchInboxMessages(authz.accessToken, { maxResults: 50, unreadOnly: false, includeArchived: true }),
      gmail.users.messages.list({ userId: "me", labelIds: ["SENT"], maxResults: 50 }),
    ])

    const sentMessages = await Promise.all(
      (sentList.data.messages ?? []).map(m =>
        gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["To", "Subject"],
        })
      )
    )

    const receivedLines = received
      .slice(0, 50)
      .map(e => `- From: ${sanitizeUtf8(e.from)} | Subject: ${sanitizeUtf8(e.subject)} | ${sanitizeUtf8(e.body.slice(0, 150))}`)
      .join("\n")

    const sentLines = sentMessages
      .map(msg => {
        const to = msg.data.payload?.headers?.find(h => h.name === "To")?.value ?? ""
        const subject = msg.data.payload?.headers?.find(h => h.name === "Subject")?.value ?? "(no subject)"
        const snippet = msg.data.snippet ?? ""
        return `- To: ${sanitizeUtf8(to)} | Subject: ${sanitizeUtf8(subject)} | ${sanitizeUtf8(snippet).slice(0, 150)}`
      })
      .join("\n")

    const prompt = wantsDraftTone
      ? `
Based on these recent sent emails, write short instructions (2-4 sentences) describing this person's reply tone and writing style, for an AI email assistant to follow when drafting replies on their behalf. Cover formality, typical length, greeting/sign-off style, and any phrases they often use. Write it as direct instructions (e.g. "Keep replies short and casual...", "Sign off with...").

Recent sent emails:
${sentLines || "(none)"}

Return ONLY the instruction text. No markdown, no headers, no quotes, no explanation.
`.trim()
      : `
Based on these recent emails, write a short "About You" paragraph (3-5 sentences) that the user could save as a reference doc for an AI email assistant. Write it in first person ("I'm a...", "I run...", "I usually..."), describing who they are, what they do, and any patterns in how they communicate or what kinds of email they get.

Recent received emails:
${receivedLines || "(none)"}

Recent sent emails:
${sentLines || "(none)"}

Return ONLY the paragraph text. No markdown, no headers, no quotes, no explanation.
`.trim()

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : ""
    return wantsDraftTone ? NextResponse.json({ draftTone: text }) : NextResponse.json({ aboutYou: text })
  } catch (err) {
    console.error("[ai/about-you]", err)
    return NextResponse.json({ error: "About You generation failed" }, { status: 500 })
  }
}
