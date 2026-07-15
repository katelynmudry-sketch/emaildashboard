"use client"

import { useEffect, useState } from "react"
import type { AccountId } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"
import { getTheme } from "@/lib/theme"
import { useBulkSelection } from "@/lib/hooks/useBulkSelection"

interface SweepMessage {
  id: string
  subject: string
  from: string
  fromEmail: string
  date: string
  deletable: boolean
  reason: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  mode: PartyMode
  account: AccountId
  onDelete: (messageIds: string[]) => Promise<void>
}

/**
 * "Deep Clean" — pages through older read/archived mail (metadata-only fetch,
 * cheap Claude classification) and runs it through the same bulk-select +
 * batch-delete engine as the themed purges. See
 * docs/plans/2026-07-14-bulk-cleanup-suite.md Phase 2d.
 */
export default function DeepCleanModal({ open, onClose, mode, account, onDelete }: Props) {
  const theme = getTheme(mode)
  const [messages, setMessages] = useState<SweepMessage[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [resultSizeEstimate, setResultSizeEstimate] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const bulk = useBulkSelection(messages.map(m => m.id))

  async function loadPage(pageToken?: string) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ account })
      if (pageToken) params.set("pageToken", pageToken)
      const res = await fetch(`/api/gmail/sweep?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Sweep request failed")
      const data = await res.json() as { messages: SweepMessage[]; nextPageToken: string | null; resultSizeEstimate: number }
      const newlySelected = data.messages.filter(m => m.deletable).map(m => m.id)
      setMessages(prev => [...prev, ...data.messages])
      bulk.selectOnly([...bulk.selected, ...newlySelected])
      setNextPageToken(data.nextPageToken)
      setResultSizeEstimate(data.resultSizeEstimate)
    } catch {
      setError("Couldn't load more emails — try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setMessages([])
    setNextPageToken(null)
    setResultSizeEstimate(0)
    loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account])

  if (!open) return null

  async function handleDelete() {
    if (bulk.count === 0) return
    setDeleting(true)
    try {
      await onDelete([...bulk.selected])
      setMessages(prev => prev.filter(m => !bulk.isSelected(m.id)))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg flex flex-col overflow-hidden"
        style={{ background: theme.cardBg, border: theme.cardBorder, borderRadius: 16, maxHeight: "80vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid rgba(${theme.purgeWashRgb},0.15)` }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: theme.headingColor }}>Deep Clean</div>
            <div style={{ fontSize: "0.76rem", color: theme.textMuted }}>
              Reviewed {messages.length} of ~{Math.max(resultSizeEstimate, messages.length)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: theme.textMuted }}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: `rgba(${theme.purgeWashRgb},0.08)` }}>
          {messages.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-2.5" style={{ borderColor: `rgba(${theme.purgeWashRgb},0.08)` }}>
              <input
                type="checkbox"
                checked={bulk.isSelected(m.id)}
                onChange={() => bulk.toggle(m.id)}
                style={{ accentColor: theme.accent, flexShrink: 0, width: 15, height: 15 }}
              />
              <div className="min-w-0 flex-1">
                <div style={{
                  fontSize: "0.82rem", fontWeight: 500, color: "rgba(26,10,53,0.78)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {m.subject}
                </div>
                <div style={{ fontSize: "0.70rem", color: "rgba(26,10,53,0.42)", marginTop: 1 }}>
                  {(m.from.split("<")[0] || m.from).trim()}
                  {m.reason ? ` · ${m.reason}` : ""}
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && !loading && (
            <div className="px-5 py-8 text-center" style={{ fontSize: "0.85rem", color: theme.textMuted }}>
              Nothing older to review — your archive is already tidy.
            </div>
          )}
        </div>

        {error && (
          <div className="px-5 py-2" style={{ fontSize: "0.78rem", color: "#D4005A" }}>{error}</div>
        )}

        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid rgba(${theme.purgeWashRgb},0.15)` }}>
          {nextPageToken && (
            <button
              onClick={() => loadPage(nextPageToken)}
              disabled={loading}
              style={{
                padding: "6px 14px", borderRadius: 999,
                border: theme.buttonSecondaryBorder, background: "transparent",
                color: theme.buttonSecondaryText, fontSize: "0.8rem", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? "Scanning…" : "Scan 100 more"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={bulk.count === 0 || deleting}
            style={{
              marginLeft: "auto",
              padding: "6px 16px", borderRadius: 999, border: "none",
              background: bulk.count === 0 ? `rgba(${theme.purgeWashRgb},0.15)` : theme.buttonPrimaryBg,
              color: bulk.count === 0 ? theme.textMuted : theme.buttonPrimaryText,
              fontSize: "0.82rem", fontWeight: 700,
              cursor: bulk.count === 0 || deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            Delete {bulk.count > 0 ? `${bulk.count} ` : ""}selected
          </button>
        </div>
      </div>
    </div>
  )
}
