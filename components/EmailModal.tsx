"use client"

import { useState, useEffect } from "react"
import type { AccountId, Email, Attachment } from "@/lib/types"
import { downloadAttachment, attachmentUrl } from "@/lib/attachment-download"
import { pickSaveFolder } from "@/lib/save-folder"
import ComposeWindow from "./ComposeWindow"
import ImageLightbox from "./ImageLightbox"

interface Props {
  email: Email
  gmailAccount: AccountId
  onClose: () => void
  onMarkRead: (email: Email) => void
  onStar: (email: Email) => void
  onArchive: (email: Email) => void
  onDelete: (email: Email) => void
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => void
  onToggleTodo?: (email: Email) => void
  onSnooze?: (email: Email) => void
  initialComposeMode?: "ai" | "reply" | "forward" | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractUnsubscribeUrl(html: string | null, body: string): string | null {
  if (html) {
    const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1]
      const text = m[2].toLowerCase()
      if (/unsubscribe|opt.?out|manage.*pref|email.*pref/i.test(text) || /unsubscribe/i.test(href)) {
        if (href.startsWith("http")) return href
      }
    }
  }
  const plainRe = /https?:\/\/[^\s<>"]+unsubscribe[^\s<>"]+/i
  const match = body.match(plainRe)
  return match ? match[0] : null
}

// Gmail omits body.data for large inline images, leaving an unresolved
// cid: reference in the html until /api/gmail/html fetches it separately.
function hasUnresolvedCid(html: string): boolean {
  return /src=["']cid:/i.test(html)
}

function injectStyles(html: string): string {
  const script = `<script>(function(){
document.addEventListener('contextmenu',function(e){if(e.target.tagName==='IMG')e.preventDefault()},true);
document.addEventListener('click',function(e){var t=e.target;if(t.tagName!=='IMG')return;e.preventDefault();e.stopPropagation();parent.postMessage({type:'inbox-img-preview',src:t.src,name:t.alt||t.title||'image'},'*');});
})()\x3c/script>`
  const inject = `<base target="_blank"><style>html{zoom:0.9}img{cursor:pointer;max-width:100%}</style>${script}`
  return /<head>/i.test(html)
    ? html.replace(/<head>/i, `<head>${inject}`)
    : `${inject}${html}`
}

const btn = "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailModal({ email, gmailAccount, onClose, onMarkRead, onStar, onArchive, onDelete, onSaveDraft, onSend, onToggleTodo, onSnooze, initialComposeMode }: Props) {
  const [htmlBody, setHtmlBody] = useState<string | null>(email.htmlBody ?? null)
  const [loading, setLoading] = useState(!email.htmlBody)
  const [unsubscribeUrl, setUnsubscribeUrl] = useState<string | null>(() =>
    extractUnsubscribeUrl(email.htmlBody ?? null, email.body)
  )
  const [imgPreview, setImgPreview] = useState<{ src: string; name: string } | null>(null)
  const [imgLoadErrors, setImgLoadErrors] = useState<Set<string>>(new Set())
  const [composeMode, setComposeMode] = useState<"reply" | "forward" | null>(null)
  const [autoAiDraft, setAutoAiDraft] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [unsubState, setUnsubState] = useState<"idle" | "loading" | "done">("idle")

  // ── Load HTML body ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (email.htmlBody && !hasUnresolvedCid(email.htmlBody)) {
      setHtmlBody(email.htmlBody)
      setUnsubscribeUrl(extractUnsubscribeUrl(email.htmlBody, email.body))
      return
    }
    if (email.htmlBody) {
      // Show what we have immediately; fetch the enriched version (with
      // large inline cid: images resolved) in the background.
      setHtmlBody(email.htmlBody)
      setUnsubscribeUrl(extractUnsubscribeUrl(email.htmlBody, email.body))
    } else {
      setLoading(true)
    }
    fetch(`/api/gmail/html?id=${encodeURIComponent(email.id)}&account=${gmailAccount}`)
      .then(r => r.json())
      .then(data => {
        if (data.htmlBody) {
          setHtmlBody(data.htmlBody)
          setUnsubscribeUrl(extractUnsubscribeUrl(data.htmlBody, email.body))
        } else if (!email.htmlBody) {
          setHtmlBody(null)
          setUnsubscribeUrl(extractUnsubscribeUrl(null, email.body))
        }
      })
      .catch(() => { if (!email.htmlBody) setHtmlBody(null) })
      .finally(() => setLoading(false))
  }, [email.id, gmailAccount])

  // ── Image preview postMessage ────────────────────────────────────────────────

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "inbox-img-preview") {
        setImgPreview({ src: e.data.src as string, name: (e.data.name as string) || "image" })
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  // ── Esc to close ────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // ── Auto-open compose when launched with a mode ─────────────────────────────

  useEffect(() => {
    if (!initialComposeMode) return
    openCompose(initialComposeMode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialComposeMode, email.id])

  // ── Compose helpers ─────────────────────────────────────────────────────────

  function openCompose(mode: "ai" | "reply" | "forward") {
    setAutoAiDraft(mode === "ai")
    setComposeMode(mode === "ai" ? "reply" : mode)
  }

  function closeCompose() {
    setComposeMode(null)
    setAutoAiDraft(false)
  }

  // ── Attachment download ──────────────────────────────────────────────────────

  async function handleDownloadAttachment(att: { filename: string; mimeType: string; attachmentId: string }) {
    setDownloadingId(att.attachmentId)
    try {
      await downloadAttachment(email.id, att, gmailAccount)
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadAllAttachments() {
    if (!email.attachments?.length) return
    for (const att of email.attachments) {
      await handleDownloadAttachment(att)
    }
  }

  // ── One-click unsubscribe ────────────────────────────────────────────────────

  async function handleUnsubscribe() {
    if (!email.unsubscribeUrl) return
    setUnsubState("loading")
    try {
      const res = await fetch("/api/gmail/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unsubscribeUrl: email.unsubscribeUrl, account: gmailAccount }),
      })
      if (!res.ok) throw new Error()
      setUnsubState("done")
      onArchive(email)
      onClose()
    } catch {
      setUnsubState("idle")
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <div className="min-w-0 pr-4">
            <p className="text-xs text-zinc-400 mb-0.5">{email.from} · {email.fromEmail}</p>
            <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{email.subject}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-zinc-400 hover:text-zinc-700 text-xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-100 shrink-0 flex-wrap">
          <button onClick={() => onMarkRead(email)} className={btn}>Mark read</button>
          <button onClick={() => { onArchive(email); onClose() }} className={`${btn} text-zinc-900 font-semibold`}>Archive</button>
          <button onClick={() => onStar(email)} className={btn}>Star</button>
          <button onClick={() => { onDelete(email); onClose() }} className={`${btn} text-rose-600`}>Delete</button>
          {email.unsubscribeOneClick && email.unsubscribeUrl && (
            <button
              onClick={handleUnsubscribe}
              disabled={unsubState !== "idle"}
              className={`${btn} disabled:opacity-50`}
            >
              {unsubState === "loading" ? "Unsubscribing…" : unsubState === "done" ? "Unsubscribed ✓" : "Unsubscribe"}
            </button>
          )}
          {onToggleTodo && (
            <button
              onClick={() => onToggleTodo(email)}
              className={`${btn} ${email.todo ? "text-amber-800 bg-amber-100 border-amber-300" : ""}`}
            >
              {email.todo ? "★ TODO" : "☆ TODO"}
            </button>
          )}
          {onSnooze && (
            <button onClick={() => onSnooze(email)} className={btn}>💤 Snooze</button>
          )}
          <div className="flex-1" />
          <button onClick={() => openCompose("ai")} className={btn}>AI Draft</button>
          <button onClick={() => openCompose("reply")} className={btn}>Reply</button>
          <button onClick={() => openCompose("forward")} className={btn}>Forward</button>
        </div>

        {/* Unsubscribe banner */}
        {unsubscribeUrl && (
          <div className="flex items-center gap-3 px-5 py-2 bg-rose-50 border-b border-rose-100 shrink-0">
            <span className="text-xs text-rose-700 flex-1">📭 This email has an unsubscribe link.</span>
            <a
              href={unsubscribeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-rose-700 border border-rose-300 bg-white hover:bg-rose-50 px-3 py-1 rounded-full transition-colors"
            >
              Unsubscribe
            </a>
            <button
              onClick={() => setUnsubscribeUrl(null)}
              className="text-rose-400 hover:text-rose-600 text-sm leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-sm text-zinc-400">
              <div className="w-4 h-4 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
              Loading email…
            </div>
          ) : htmlBody ? (
            <iframe
              srcDoc={injectStyles(htmlBody)}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="w-full border-0"
              style={{ minHeight: "500px" }}
              onLoad={e => {
                const iframe = e.currentTarget
                const height = iframe.contentDocument?.body?.scrollHeight
                if (height) iframe.style.height = height + 32 + "px"
              }}
              title="Email content"
            />
          ) : (
            <div className="p-5 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {email.body || email.snippet}
            </div>
          )}
        </div>

        {/* Attachments bar */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="border-t border-zinc-100 px-5 py-3 shrink-0 bg-zinc-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mr-1">
                📎 {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
              </span>

              {email.attachments.map(att => {
                const isDownloading = downloadingId === att.attachmentId
                const emoji = att.mimeType.startsWith("image/") ? "🖼" :
                  att.mimeType === "application/pdf" ? "📄" :
                  att.mimeType.startsWith("video/") ? "🎥" :
                  att.mimeType.startsWith("audio/") ? "🎵" : "📎"
                const kb = att.size > 0 ? (att.size < 1024 * 1024
                  ? `${Math.round(att.size / 1024)} KB`
                  : `${(att.size / (1024 * 1024)).toFixed(1)} MB`) : ""

                const isImage = att.mimeType.startsWith("image/") && !imgLoadErrors.has(att.attachmentId)
                if (isImage) {
                  const url = attachmentUrl(email.id, att, gmailAccount)
                  return (
                    <div
                      key={att.attachmentId}
                      className="inline-flex items-center gap-1.5 pr-1.5 rounded-full border border-violet-200 bg-violet-50"
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
                          className="w-7 h-7 rounded-full object-cover"
                          onError={() => setImgLoadErrors(prev => new Set(prev).add(att.attachmentId))}
                        />
                      </button>
                      <span className="text-xs font-medium text-violet-700 max-w-[100px] truncate">{att.filename}</span>
                      {kb && <span className="text-xs opacity-60 text-violet-700">{kb}</span>}
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => void handleDownloadAttachment(att)}
                        className="shrink-0 text-violet-400 hover:text-violet-700 disabled:opacity-50 text-xs transition-colors"
                        title="Save to folder"
                        aria-label={`Save ${att.filename} to folder`}
                      >
                        {isDownloading ? "💾…" : "💾"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void pickSaveFolder(gmailAccount)}
                        className="shrink-0 text-violet-300 hover:text-violet-700 text-xs transition-colors"
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
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                  >
                    <span>{emoji}</span>
                    <span className="max-w-[140px] truncate">{att.filename}</span>
                    {kb && <span className="opacity-60">{kb}</span>}
                    {isDownloading
                      ? <span className="opacity-60">↓…</span>
                      : <span className="opacity-40">↓</span>
                    }
                  </button>
                )
              })}

              {gmailAccount === "work" && email.attachments.length > 1 && (
                <button
                  type="button"
                  disabled={downloadingId !== null}
                  onClick={() => void downloadAllAttachments()}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {downloadingId !== null ? "Saving…" : "💾 Save all to admin"}
                </button>
              )}

              {gmailAccount === "work" && email.attachments.length === 1 && (
                <button
                  type="button"
                  disabled={downloadingId !== null}
                  onClick={() => void handleDownloadAttachment(email.attachments![0])}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {downloadingId !== null ? "Saving…" : "💾 Save to admin"}
                </button>
              )}
            </div>
          </div>
        )}

        {imgPreview && (
          <ImageLightbox
            src={imgPreview.src}
            name={imgPreview.name}
            account={gmailAccount}
            onClose={() => setImgPreview(null)}
          />
        )}

        {/* Compose area */}
        {composeMode && (
          <ComposeWindow
            mode={composeMode}
            presentation="inline"
            gmailAccount={gmailAccount}
            email={email}
            autoAiDraft={autoAiDraft}
            onSend={(body, attachments, forwardTo) => {
              onSend(email, composeMode, body, attachments, forwardTo)
              closeCompose()
              onClose()
            }}
            onSaveDraft={async (body, attachments, forwardTo) => {
              await onSaveDraft(email, body, attachments, forwardTo)
              closeCompose()
            }}
            onClose={closeCompose}
          />
        )}
      </div>
    </div>
  )
}
