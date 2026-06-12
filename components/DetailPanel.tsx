"use client"

import { useState, useEffect, useRef } from "react"
import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import { downloadAttachment, attachmentUrl } from "@/lib/attachment-download"
import { pickSaveFolder } from "@/lib/save-folder"
import ComposeWindow from "./ComposeWindow"
import ImageLightbox from "./ImageLightbox"

// Gmail omits body.data for large inline images, leaving an unresolved
// cid: reference in the html until /api/gmail/html fetches it separately.
function hasUnresolvedCid(html: string): boolean {
  return /src=["']cid:/i.test(html)
}

const TAG_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
  "bg-teal-500", "bg-indigo-500",
]

interface Props {
  email: Email | null
  gmailAccount: AccountId
  categories: Category[]
  onClose: () => void
  onArchive: (email: Email) => void
  onMarkRead: (email: Email) => void
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => void
  onStar: (email: Email) => void
  onDelete: (email: Email) => void
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700",
  today:  "bg-amber-100 text-amber-700",
  fyi:    "bg-emerald-100 text-emerald-700",
}

const btnBase =
  "text-[11px] font-medium px-2 py-1 rounded-md bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75 whitespace-nowrap"

export default function DetailPanel({ email, gmailAccount, categories, onClose, onArchive, onMarkRead, onSaveDraft, onSend, onStar, onDelete, onRecategorize, onMarkReplied, onMarkDeletable, onNewCategory }: Props) {
  const [draftMode, setDraftMode] = useState<"reply" | "forward" | null>(null)
  const [autoAiDraft, setAutoAiDraft] = useState(false)
  const [imgPreview, setImgPreview] = useState<{ src: string; name: string } | null>(null)
  const [imgLoadErrors, setImgLoadErrors] = useState<Set<string>>(new Set())
  const [archiving, setArchiving] = useState(false)
  const [archived, setArchived] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unsubState, setUnsubState] = useState<"idle" | "loading" | "done">("idle")
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [htmlBody, setHtmlBody] = useState<string | null>(email?.htmlBody ?? null)
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [teachClaude, setTeachClaude] = useState(true)
  const [moving, setMoving] = useState(false)
  const [moved, setMoved] = useState<string | null>(null)
  const moveRef = useRef<HTMLDivElement>(null)
  const [newTagOpen, setNewTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [newTagSaving, setNewTagSaving] = useState(false)
  const newTagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!email) return
    setMoved(null)
    setMoveOpen(false)
    setNewTagOpen(false)
    setNewTagName("")
    setNewTagColor(TAG_COLORS[0])
    if (email.htmlBody && !hasUnresolvedCid(email.htmlBody)) {
      setHtmlBody(email.htmlBody)
      return
    }
    if (email.htmlBody) {
      // Show what we have immediately; fetch the enriched version (with
      // large inline cid: images resolved) in the background.
      setHtmlBody(email.htmlBody)
    } else {
      setHtmlBody(null)
      setHtmlLoading(true)
    }
    fetch(`/api/gmail/html?id=${encodeURIComponent(email.id)}&account=${gmailAccount}`)
      .then(r => r.json())
      .then(data => { if (data.htmlBody) setHtmlBody(data.htmlBody) })
      .catch(() => {})
      .finally(() => setHtmlLoading(false))
  }, [email?.id, gmailAccount])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "inbox-img-preview") {
        setImgPreview({ src: e.data.src as string, name: (e.data.name as string) || "image" })
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  useEffect(() => {
    if (!moveOpen) return
    function handleClick(e: MouseEvent) {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) {
        setMoveOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [moveOpen])

  async function handleMove(newCategory: string) {
    if (!email || moving) return
    setMoving(true)
    setMoveOpen(false)
    await onRecategorize(email, newCategory, teachClaude)
    setMoved(newCategory)
    setMoving(false)
  }

  if (!email) return null

  async function handleDownloadAttachment(att: { filename: string; mimeType: string; attachmentId: string }) {
    setDownloadingId(att.attachmentId)
    try {
      await downloadAttachment(email!.id, att, gmailAccount)
    } finally {
      setDownloadingId(null)
    }
  }

  function handleArchive() {
    if (!email) return
    onArchive(email)
    setArchiving(false)
    setArchived(true)
  }

  async function handleUnsubscribe() {
    if (!email?.unsubscribeUrl) return
    setUnsubState("loading")
    try {
      const res = await fetch("/api/gmail/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unsubscribeUrl: email.unsubscribeUrl, account: gmailAccount }),
      })
      if (!res.ok) throw new Error()
      setUnsubState("done")
      handleArchive()
    } catch {
      setUnsubState("idle")
    }
  }

  return (
    <div className="relative flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-zinc-100">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[email.priority]}`}>
              {email.priority}
            </span>
            {email.replied && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">
                Replied
              </span>
            )}
            {email.forwarded && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                Forwarded
              </span>
            )}
            <span className="text-xs text-zinc-400">{email.timeAgo}</span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{email.subject}</h2>
          {email.deletable && (
            <p className="text-xs text-zinc-400 mt-1">
              🗑 Marked safe to delete
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-0.5">{email.from} · {email.fromEmail}</p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 text-xl leading-none shrink-0 mt-0.5"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[520px] overflow-y-auto p-4 space-y-3">
        {email.summary && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">AI Summary</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{email.summary}</p>
          </div>
        )}

        {htmlLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
            <div className="w-4 h-4 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
            Loading email…
          </div>
        ) : htmlBody ? (
          <iframe
            srcDoc={(() => {
              const script = `<script>(function(){
document.addEventListener('contextmenu',function(e){if(e.target.tagName==='IMG')e.preventDefault()},true);
document.addEventListener('click',function(e){var t=e.target;if(t.tagName!=='IMG')return;e.preventDefault();e.stopPropagation();parent.postMessage({type:'inbox-img-preview',src:t.src,name:t.alt||t.title||'image'},'*');});
})()\x3c/script>`
              const inject = `<base target="_blank"><style>html{zoom:0.85}img{cursor:pointer;max-width:100%}</style>${script}`
              return /<head>/i.test(htmlBody)
                ? htmlBody.replace(/<head>/i, `<head>${inject}`)
                : `${inject}${htmlBody}`
            })()}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="w-full border-0 rounded"
            style={{ minHeight: "200px" }}
            onLoad={e => {
              const iframe = e.currentTarget
              const height = iframe.contentDocument?.body?.scrollHeight
              if (height) iframe.style.height = height + 32 + "px"
            }}
            title="Email content"
          />
        ) : (
          <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap break-words">
            {email.body || email.snippet}
          </div>
        )}

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              📎 {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map(att => {
                const isDownloading = downloadingId === att.attachmentId
                const emoji = att.mimeType.startsWith("image/") ? "🖼" :
                  att.mimeType === "application/pdf" ? "📄" :
                  att.mimeType.startsWith("video/") ? "🎥" :
                  att.mimeType.startsWith("audio/") ? "🎵" : "📎"
                const size = att.size > 0
                  ? att.size < 1024 * 1024
                    ? `${Math.round(att.size / 1024)} KB`
                    : `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                  : ""

                const isImage = att.mimeType.startsWith("image/") && !imgLoadErrors.has(att.attachmentId)
                if (isImage) {
                  const url = attachmentUrl(email.id, att, gmailAccount)
                  return (
                    <div
                      key={att.attachmentId}
                      className="inline-flex items-center gap-1.5 pr-1.5 rounded-lg border border-violet-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setImgPreview({ src: url, name: att.filename })}
                        className="shrink-0"
                        title="Preview image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={att.filename}
                          className="w-12 h-12 rounded-md object-cover"
                          onError={() => setImgLoadErrors(prev => new Set(prev).add(att.attachmentId))}
                        />
                      </button>
                      <div className="flex flex-col min-w-0 py-1">
                        <span className="text-xs font-medium text-zinc-700 max-w-[120px] truncate">{att.filename}</span>
                        {size && <span className="text-[10px] text-violet-400">{size}</span>}
                      </div>
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => void handleDownloadAttachment(att)}
                        className="shrink-0 text-violet-400 hover:text-violet-600 disabled:opacity-50 text-sm px-1 transition-colors"
                        title="Save to folder"
                        aria-label={`Save ${att.filename} to folder`}
                      >
                        {isDownloading ? "💾…" : "💾"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void pickSaveFolder(gmailAccount)}
                        className="shrink-0 text-violet-300 hover:text-violet-600 text-xs px-1 transition-colors"
                        title="Choose save folder"
                        aria-label="Choose save folder"
                      >
                        ↓
                      </button>
                    </div>
                  )
                }

                return (
                  <button
                    key={att.attachmentId}
                    type="button"
                    disabled={isDownloading}
                    onClick={() => void handleDownloadAttachment(att)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <span>{emoji}</span>
                    <span className="max-w-[150px] truncate">{att.filename}</span>
                    {size && <span className="text-violet-400">{size}</span>}
                    <span className="text-violet-300">{isDownloading ? "↓…" : "↓"}</span>
                  </button>
                )
              })}
              {gmailAccount === "work" && email.attachments.length > 0 && (
                <button
                  type="button"
                  disabled={downloadingId !== null}
                  onClick={async () => { for (const att of email.attachments!) await handleDownloadAttachment(att) }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors shadow-sm ml-auto"
                >
                  {downloadingId ? "Saving…" : "💾 Save to admin"}
                </button>
              )}
            </div>
          </div>
        )}

        {draftMode && (
          <ComposeWindow
            mode={draftMode}
            presentation="inline"
            gmailAccount={gmailAccount}
            email={email}
            autoAiDraft={autoAiDraft}
            onSend={(body, attachments, forwardTo) => {
              onSend(email, draftMode, body, attachments, forwardTo)
              setDraftMode(null)
              setAutoAiDraft(false)
            }}
            onSaveDraft={async (body, attachments, forwardTo) => {
              await onSaveDraft(email, body, attachments, forwardTo)
              setDraftMode(null)
              setAutoAiDraft(false)
            }}
            onClose={() => { setDraftMode(null); setAutoAiDraft(false) }}
          />
        )}
      </div>

      {imgPreview && (
        <ImageLightbox
          src={imgPreview.src}
          name={imgPreview.name}
          account={gmailAccount}
          onClose={() => setImgPreview(null)}
        />
      )}

      {/* Actions */}
      <div className="px-3 py-2.5 border-t border-zinc-100 space-y-1.5">
        {archived ? (
          <p className="text-xs text-emerald-600 text-center font-medium">Archived ✓</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onMarkRead(email)}
                className={btnBase}
              >
                Mark read
              </button>
              <button
                onClick={() => { setAutoAiDraft(true); setDraftMode("reply") }}
                className={btnBase}
              >
                AI Draft
              </button>
              <button
                onClick={() => { setAutoAiDraft(false); setDraftMode(m => m === "reply" ? null : "reply") }}
                className={btnBase}
              >
                Reply
              </button>
              <button
                onClick={() => { setAutoAiDraft(false); setDraftMode(m => m === "forward" ? null : "forward") }}
                className={btnBase}
              >
                Forward
              </button>
              {!email.replied && (
                <button
                  onClick={() => onMarkReplied(email)}
                  className={btnBase}
                >
                  Mark replied
                </button>
              )}
              <button
                onClick={() => onStar(email)}
                className={btnBase}
              >
                Star
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className={`${btnBase} disabled:opacity-50`}
              >
                {archiving ? "…" : "Archive"}
              </button>
              <button
                onClick={() => {
                  onDelete(email)
                  setDeleting(false)
                }}
                disabled={deleting}
                className={`${btnBase} text-rose-600 disabled:opacity-50`}
              >
                {deleting ? "…" : "Delete"}
              </button>
              {email.unsubscribeOneClick && email.unsubscribeUrl && (
                <button
                  onClick={handleUnsubscribe}
                  disabled={unsubState !== "idle"}
                  className={`${btnBase} disabled:opacity-50`}
                >
                  {unsubState === "loading" ? "Unsubscribing…" : unsubState === "done" ? "Unsubscribed ✓" : "Unsubscribe"}
                </button>
              )}
            </div>

            {/* Recategorize */}
            <div className="relative" ref={moveRef}>
              <div className="flex items-center gap-1.5">
                {moved ? (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    {moved === "" ? "Removed tag ✓" : `Moved to ${moved} ✓${teachClaude ? " · Claude will remember this" : ""}`}
                  </span>
                ) : (
                  <button
                    onClick={() => setMoveOpen(o => !o)}
                    disabled={moving}
                    className={`${btnBase} disabled:opacity-50`}
                  >
                    {moving ? "Moving…" : `Move to… (${email.category})`}
                  </button>
                )}
              </div>

              {moveOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg p-2 min-w-[230px]">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-2 pb-1.5">Move to category</p>

                  {/* Existing categories */}
                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                    {categories.filter(c => c.name !== email.category).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleMove(cat.name)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 text-[12px] text-zinc-700"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cat.color}`} />
                        {cat.name}
                      </button>
                    ))}

                    {/* Untagged */}
                    {email.category && (
                      <button
                        onClick={() => handleMove("")}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 text-[12px] text-zinc-400"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 border border-zinc-300" />
                        No tag
                      </button>
                    )}

                    {/* Delete candidate */}
                    {!email.deletable && (
                      <button
                        onClick={() => { onMarkDeletable(email); setMoveOpen(false); setMoved("Delete candidates") }}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[12px] text-rose-600"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 bg-zinc-300" />
                        Delete candidate
                      </button>
                    )}
                  </div>

                  {/* New tag form */}
                  <div className="border-t border-zinc-100 mt-1.5 pt-1.5">
                    {newTagOpen ? (
                      <div className="px-2 space-y-1.5">
                        <input
                          ref={newTagInputRef}
                          type="text"
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === "Enter" && newTagName.trim()) {
                              e.preventDefault()
                              setNewTagSaving(true)
                              const id = await onNewCategory(newTagName.trim(), newTagColor)
                              await handleMove(newTagName.trim())
                              setNewTagSaving(false)
                              setNewTagOpen(false)
                              setNewTagName("")
                            } else if (e.key === "Escape") {
                              setNewTagOpen(false)
                            }
                          }}
                          placeholder="Tag name…"
                          className="w-full text-[12px] border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
                          autoFocus
                        />
                        <div className="flex items-center gap-1 flex-wrap">
                          {TAG_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setNewTagColor(c)}
                              className={`w-4 h-4 rounded-full ${c} transition-transform ${newTagColor === c ? "ring-2 ring-offset-1 ring-zinc-400 scale-110" : "hover:scale-105"}`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              if (!newTagName.trim() || newTagSaving) return
                              setNewTagSaving(true)
                              await onNewCategory(newTagName.trim(), newTagColor)
                              await handleMove(newTagName.trim())
                              setNewTagSaving(false)
                              setNewTagOpen(false)
                              setNewTagName("")
                            }}
                            disabled={!newTagName.trim() || newTagSaving}
                            className="text-[11px] font-medium px-2 py-1 rounded-md bg-violet-500 text-white disabled:opacity-40"
                          >
                            {newTagSaving ? "Creating…" : "Create & move"}
                          </button>
                          <button
                            onClick={() => { setNewTagOpen(false); setNewTagName("") }}
                            className="text-[11px] px-2 py-1 rounded-md text-zinc-500 hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNewTagOpen(true); setTimeout(() => newTagInputRef.current?.focus(), 0) }}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 text-[12px] text-violet-600 font-medium"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 border-2 border-violet-400 border-dashed" />
                        + New tag
                      </button>
                    )}
                  </div>

                  {/* Teach Claude toggle */}
                  <div className="border-t border-zinc-100 mt-1.5 pt-1.5 px-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teachClaude}
                        onChange={e => setTeachClaude(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-violet-500"
                      />
                      <span className="text-[11px] text-zinc-600">Teach Claude this rule</span>
                    </label>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                      Future emails from this sender will sort here automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
