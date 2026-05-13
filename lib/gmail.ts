import { google } from "googleapis"
import type { RawEmail } from "./types"

export function getGmailService(accessToken: string) {
  const oauth2 = new google.auth.OAuth2()
  oauth2.setCredentials({ access_token: accessToken })
  return google.gmail({ version: "v1", auth: oauth2 })
}

// ── Parse a raw Gmail message into RawEmail ──────────────────────────────────

function getHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function decodeBase64(data: string): string {
  const buf = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  return buf.toString("utf-8")
}

function extractPlainText(payload: any): string {
  if (!payload) return ""

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data)
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data)
      }
    }
    // Recurse into nested multipart parts
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith("multipart/")) {
        const nested = extractPlainText(part)
        if (nested) return nested
      }
    }
    // Fallback: strip HTML tags
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      }
    }
  }

  return payload.snippet ?? ""
}

export function extractHtmlBody(payload: any): string {
  if (!payload) return ""

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64(payload.body.data)
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64(part.body.data)
      }
      if (part.mimeType?.startsWith("multipart/")) {
        const nested = extractHtmlBody(part)
        if (nested) return nested
      }
    }
  }

  return ""
}

export function parseMessage(msg: any): RawEmail {
  const headers: { name?: string | null; value?: string | null }[] = msg.payload?.headers ?? []
  const body = extractPlainText(msg.payload).slice(0, 2000)
  const htmlBody = extractHtmlBody(msg.payload)
  const fromRaw = getHeader(headers, "from")
  // Extract display name vs email
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/)
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromRaw
  const fromEmail = fromMatch ? fromMatch[2] : fromRaw

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: fromName,
    fromEmail,
    to: getHeader(headers, "to"),
    subject: getHeader(headers, "subject") || "(no subject)",
    snippet: msg.snippet ?? "",
    body,
    htmlBody: htmlBody || undefined,
    date: new Date(parseInt(msg.internalDate)).toISOString(),
    internalDate: parseInt(msg.internalDate),
    inReplyTo: getHeader(headers, "in-reply-to") || undefined,
    messageId: getHeader(headers, "message-id") || undefined,
    labelIds: msg.labelIds ?? [],
  }
}

// ── Fetch unread inbox messages ───────────────────────────────────────────────

export interface InboxFetchResult {
  emails: RawEmail[]
  totalUnread: number
}

export async function fetchInboxMessages(accessToken: string, maxResults = 30): Promise<InboxFetchResult> {
  const gmail = getGmailService(accessToken)

  const list = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox",
    maxResults,
  })

  const totalUnread = list.data.resultSizeEstimate ?? 0
  const messages = list.data.messages ?? []
  if (messages.length === 0) return { emails: [], totalUnread }

  const details = await Promise.all(
    messages.map(m =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "full",
      }).then(r => parseMessage(r.data))
    )
  )

  return {
    emails: details.sort((a, b) => b.internalDate - a.internalDate),
    totalUnread,
  }
}

// ── Fetch existing Gmail label names for an account ───────────────────────────

export async function fetchExistingLabels(accessToken: string): Promise<{ id: string; name: string }[]> {
  const gmail = getGmailService(accessToken)
  const res = await gmail.users.labels.list({ userId: "me" })
  return (res.data.labels ?? [])
    .filter(l => l.type === "user") // only user-created labels, not system ones
    .map(l => ({ id: l.id!, name: l.name! }))
}

// ── Ensure a Gmail label exists, create if not ────────────────────────────────

export async function ensureLabel(accessToken: string, name: string): Promise<string> {
  const gmail = getGmailService(accessToken)
  const existing = await fetchExistingLabels(accessToken)
  const found = existing.find(l => l.name.toLowerCase() === name.toLowerCase())
  if (found) return found.id

  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  })
  return created.data.id!
}

// ── Apply a label to a message ────────────────────────────────────────────────

export async function applyLabel(accessToken: string, messageId: string, gmailLabelId: string): Promise<void> {
  const gmail = getGmailService(accessToken)
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: [gmailLabelId] },
  })
}

// ── Star a message ───────────────────────────────────────────────────────────

export async function starMessage(accessToken: string, messageId: string): Promise<void> {
  const gmail = getGmailService(accessToken)
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: ["STARRED"] },
  })
}

// ── Trash a message ──────────────────────────────────────────────────────────

export async function trashMessage(accessToken: string, messageId: string): Promise<void> {
  const gmail = getGmailService(accessToken)
  await gmail.users.messages.trash({
    userId: "me",
    id: messageId,
  })
}

// ── Search for recent delivery confirmation emails (last 7 days) ──────────────

export async function searchRecentDeliveries(
  accessToken: string
): Promise<{ id: string; subject: string; from: string; sender: string }[]> {
  const gmail = getGmailService(accessToken)

  const q = `subject:(delivered OR "has been delivered" OR "your order has arrived" OR "your package has arrived" OR "delivery confirmation") newer_than:7d -is:sent`
  const list = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 10,
  })

  const messages = list.data.messages ?? []
  if (messages.length === 0) return []

  const results = await Promise.all(
    messages.map(m =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From"],
      }).then(r => {
        const headers: { name?: string | null; value?: string | null }[] = r.data.payload?.headers ?? []
        const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value ?? "(no subject)"
        const fromRaw = headers.find(h => h.name?.toLowerCase() === "from")?.value ?? ""
        const domainMatch = fromRaw.match(/@([\w.-]+)/)
        const sender = domainMatch ? domainMatch[1] : fromRaw
        return { id: m.id!, subject, from: fromRaw, sender }
      })
    )
  )

  return results
}

// ── Search archived messages by sender domain ─────────────────────────────────

export async function searchArchivedMessages(
  accessToken: string,
  senderDomain: string
): Promise<{ id: string; subject: string; date: string; snippet: string }[]> {
  const gmail = getGmailService(accessToken)

  const senderQuery = senderDomain.includes(" ") ? `"${senderDomain}"` : senderDomain
  const q = `from:${senderQuery} subject:(order OR shipping OR shipped OR tracking OR delivery OR confirmation OR arrived OR delivered OR package OR parcel OR shipment OR item OR received)`
  const list = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: 20,
  })

  const messages = list.data.messages ?? []
  if (messages.length === 0) return []

  const results = await Promise.all(
    messages.map(m =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "Date"],
      }).then(r => {
        const headers: { name?: string | null; value?: string | null }[] = r.data.payload?.headers ?? []
        const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value ?? "(no subject)"
        const rawDate = headers.find(h => h.name?.toLowerCase() === "date")?.value ?? ""
        const date = rawDate ? new Date(rawDate).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : ""
        const snippet = r.data.snippet ?? ""
        return { id: m.id!, subject, date, snippet }
      })
    )
  )

  return results
}

// ── Archive a message (remove from INBOX) ────────────────────────────────────

export async function archiveMessage(accessToken: string, messageId: string): Promise<void> {
  const gmail = getGmailService(accessToken)
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["INBOX"] },
  })
}

// ── Mark as read ─────────────────────────────────────────────────────────────

export async function markAsRead(accessToken: string, messageId: string): Promise<void> {
  const gmail = getGmailService(accessToken)
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  })
}

// ── Create a draft reply ──────────────────────────────────────────────────────

export async function createDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string,
  messageId?: string
): Promise<string> {
  const gmail = getGmailService(accessToken)

  const isThreadedReply = Boolean(inReplyTo || messageId)
  const mimeSubject = isThreadedReply
    ? (subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`)
    : (subject.trim() || "(no subject)")
  const referencesHeader = inReplyTo && messageId && inReplyTo !== messageId
    ? `${inReplyTo} ${messageId}`
    : messageId ?? inReplyTo

  const mimeLines = [
    `To: ${to}`,
    `Subject: ${mimeSubject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    referencesHeader ? `References: ${referencesHeader}` : null,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].filter(Boolean).join("\r\n")

  const raw = Buffer.from(mimeLines).toString("base64url")

  const message: { raw: string; threadId?: string } = { raw }
  if (threadId) message.threadId = threadId

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message },
  })

  return draft.data.id!
}

// ── Send an email ─────────────────────────────────────────────────────────────

export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string,
  messageId?: string
): Promise<void> {
  const gmail = getGmailService(accessToken)

  if (!to || !to.trim()) {
    throw new Error("Recipient email address is required")
  }

  const isThreadedReply = Boolean(inReplyTo || messageId)
  const mimeSubject = isThreadedReply
    ? (subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`)
    : (subject.trim() || "(no subject)")
  const referencesHeader = inReplyTo && messageId && inReplyTo !== messageId
    ? `${inReplyTo} ${messageId}`
    : messageId ?? inReplyTo

  const mimeLines = [
    `To: ${to}`,
    `Subject: ${mimeSubject}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    referencesHeader ? `References: ${referencesHeader}` : null,
    "",
    body,
  ].filter(Boolean).join("\r\n")

  const raw = Buffer.from(mimeLines, "utf8").toString("base64url")

  const requestBody: { raw: string; threadId?: string } = { raw }
  if (threadId) requestBody.threadId = threadId

  await gmail.users.messages.send({
    userId: "me",
    requestBody,
  })
}
