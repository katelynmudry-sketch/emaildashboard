import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { google } from "googleapis"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

interface CreateDocBody {
  account?: string
  name: string
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body: CreateDocBody = await request.json()
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 })
  }

  const accountId = parseAccountId(body.account)
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: authz.accessToken })
    const drive = google.drive({ version: "v3", auth: oauth2 })

    const file = await drive.files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.document" },
      fields: "id, name",
    })

    return NextResponse.json({ id: file.data.id, name: file.data.name })
  } catch (err) {
    console.error("[docs/create]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed" }, { status: 500 })
  }
}
