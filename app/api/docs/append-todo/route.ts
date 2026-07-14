import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { google } from "googleapis"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

interface AppendTodoBody {
  docId: string
  note: string
  threadId: string
  accountEmail?: string
  includeLink?: boolean
  account?: string
}

export async function POST(request: Request) {
  const token = await getServerToken()
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body: AppendTodoBody = await request.json()
  const { docId } = body
  const note = body.note ?? ""
  const threadId = body.threadId ?? ""
  const accountEmail = body.accountEmail ?? ""
  const includeLink = body.includeLink !== false
  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 })
  }
  if (!note) {
    return NextResponse.json({ error: "Missing note" }, { status: 400 })
  }

  const accountId = parseAccountId(body.account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: authz.accessToken })
    const docs = google.docs({ version: "v1", auth: oauth2 })

    const doc = await docs.documents.get({ documentId: docId })
    const content = doc.data.body?.content ?? []
    const lastElement = content[content.length - 1]
    const endIndex = (lastElement?.endIndex ?? 1) - 1

    const insertIndex = Math.max(endIndex, 1)
    // Blank line between entries — skip it when the doc is still empty.
    const prefix = endIndex > 0 ? "\n" : ""
    const bullet = "• "
    const linkLabel = "Open email"

    const gmailUrl = `https://mail.google.com/mail/u/0/#all/${threadId}`
    // AccountChooser switches to the correct Google account before following the Gmail link —
    // without this, threadId-based links open in whichever account is "u/0" in the browser session.
    const link = accountEmail
      ? `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(accountEmail)}&continue=${encodeURIComponent(gmailUrl)}`
      : gmailUrl

    const lineBody = includeLink ? `${note} — ${linkLabel}` : note
    const text = `${prefix}${bullet}${lineBody}\n`

    const requests: object[] = [
      {
        insertText: {
          location: { index: insertIndex },
          text,
        },
      },
    ]

    if (includeLink) {
      const linkStart = insertIndex + prefix.length + bullet.length + (lineBody.length - linkLabel.length)
      const linkEnd = linkStart + linkLabel.length
      requests.push({
        updateTextStyle: {
          range: { startIndex: linkStart, endIndex: linkEnd },
          textStyle: { link: { url: link } },
          fields: "link",
        },
      })
    }

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[docs/append-todo]", err)
    return NextResponse.json({ error: "Append failed" }, { status: 500 })
  }
}
