import type { AccountId } from "./types"
import { getSaveFolderHandle, saveToFolder } from "./save-folder"

/**
 * Fetches a Gmail attachment and either:
 *   (a) writes it to the account's configured save folder (if set + permission OK), or
 *   (b) triggers a standard browser download as fallback.
 *
 * Returns "folder" | "browser" | throws on network error.
 */
export async function downloadAttachment(
  messageId: string,
  att: { filename: string; mimeType: string; attachmentId: string },
  account: AccountId
): Promise<"folder" | "browser"> {
  // Build URL — pass mimeType and filename so the server sets correct headers
  const params = new URLSearchParams({
    messageId,
    attachmentId: att.attachmentId,
    account,
    mimeType: att.mimeType,
    filename: att.filename,
  })

  const res = await fetch(`/api/gmail/attachment?${params}`)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Attachment fetch failed (${res.status})${text ? `: ${text}` : ""}`)
  }

  const blob = await res.blob()

  // Try configured save folder first
  const folderHandle = await getSaveFolderHandle(account).catch(() => null)
  if (folderHandle) {
    const saved = await saveToFolder(folderHandle, att.filename, blob)
    if (saved) return "folder"
    // Permission revoked or error — fall through to browser download
  }

  // Browser download fallback
  triggerBrowserDownload(blob, att.filename)
  return "browser"
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  // Small delay before revoking to ensure click registers
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
