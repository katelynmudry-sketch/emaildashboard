import { auth } from "@/lib/auth"
import { getGmailService } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const session = await auth()
  const { searchParams } = new URL(request.url)
  const accountId = parseAccountId(searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  const messageId = searchParams.get("messageId")
  const attachmentId = searchParams.get("attachmentId")
  const mimeType = searchParams.get("mimeType") ?? "application/octet-stream"
  const filename = searchParams.get("filename") ?? "attachment"

  if (!messageId || !attachmentId) {
    return new Response(JSON.stringify({ error: "Missing messageId or attachmentId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const gmail = getGmailService(authz.accessToken)
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    })

    // Gmail returns URL-safe base64 — convert and decode to binary
    const b64 = (res.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/")
    // Add padding if needed
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    const binary = Buffer.from(padded, "base64")

    // Inline disposition lets images render directly in <img src>; other types still download.
    const disposition = mimeType.startsWith("image/") ? "inline" : "attachment"

    return new Response(binary, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(binary.length),
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to fetch attachment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
