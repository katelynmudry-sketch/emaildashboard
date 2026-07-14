import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { batchModifyMessages } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"
import type { AccountId } from "@/lib/types"

export type BulkAction = "trash" | "archive" | "read" | "unread" | "restore" | "unarchive"

// Label diff per action. "trash"/"restore" use the TRASH label (not
// batchDelete, which is permanent) so bulk deletes stay undoable —
// see batchModifyMessages in lib/gmail.ts.
const ACTION_LABELS: Record<BulkAction, { addLabelIds?: string[]; removeLabelIds?: string[] }> = {
  // Matches trashMessage()'s single-message .trash() call — only touches
  // INBOX/TRASH, same as Gmail's own trash behavior (read state is untouched).
  trash: { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] },
  archive: { removeLabelIds: ["INBOX"] },
  read: { removeLabelIds: ["UNREAD"] },
  unread: { addLabelIds: ["UNREAD"] },
  restore: { addLabelIds: ["INBOX"], removeLabelIds: ["TRASH"] },
  unarchive: { addLabelIds: ["INBOX"] },
}

const MAX_MESSAGE_IDS = 500

export async function POST(request: Request) {
  const token = await getServerToken()
  const { messageIds, action, account }: { messageIds: string[]; action: BulkAction; account?: AccountId } =
    await request.json()
  const accountId = parseAccountId(account)
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json({ error: "messageIds is required" }, { status: 400 })
  }
  if (messageIds.length > MAX_MESSAGE_IDS) {
    return NextResponse.json({ error: `Too many messages — max ${MAX_MESSAGE_IDS} per request` }, { status: 400 })
  }
  const labels = ACTION_LABELS[action]
  if (!labels) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  try {
    await batchModifyMessages(authz.accessToken, messageIds, labels)
    return NextResponse.json({ ok: true, count: messageIds.length })
  } catch (err) {
    console.error("[gmail/batch]", err)
    return NextResponse.json({ error: "Batch update failed" }, { status: 500 })
  }
}
