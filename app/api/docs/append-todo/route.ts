import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { google } from "googleapis"

interface AppendTodoBody {
  docId: string
  note: string
  threadId: string
}

export async function POST(request: Request) {
  const session = await auth()
  const accessToken = session?.access_token
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body: AppendTodoBody = await request.json()
  const { docId } = body
  const note = body.note ?? ""
  const threadId = body.threadId ?? ""
  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 })
  }
  if (!note) {
    return NextResponse.json({ error: "Missing note" }, { status: 400 })
  }

  try {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: accessToken })
    const docs = google.docs({ version: "v1", auth: oauth2 })

    const doc = await docs.documents.get({ documentId: docId })
    const content = doc.data.body?.content ?? []
    const lastElement = content[content.length - 1]
    const endIndex = (lastElement?.endIndex ?? 1) - 1

    const link = `https://mail.google.com/mail/u/0/#all/${threadId}`
    const line = `• ${note}  (${link})\n`

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: Math.max(endIndex, 1) },
              text: line,
            },
          },
        ],
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[docs/append-todo]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Append failed" }, { status: 500 })
  }
}
