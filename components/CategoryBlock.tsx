"use client"

import { useState, useEffect, useRef } from "react"
import type { AccountId, Email, Category, Attachment, EmailKeyPoint } from "@/lib/types"
import { categoryNoun, type PartyMode } from "@/lib/party-mode"
import { recordAction } from "@/lib/stats"
import LabelSection from "./LabelSection"

// Defensive strip in case the model slips markdown into the summary despite being told not to.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
}

const SUMMARY_TITLE: Record<PartyMode, string> = {
  zen: "A Closer Look",
  party: "THE GIST",
  "wabi-sabi": "The Tea, Bestie",
}

const NOISY_CATEGORIES = /newsletter|subscri|promo|deals|marketing|digest|update|notif/i

function isNoisyCategory(name: string): boolean {
  return NOISY_CATEGORIES.test(name)
}

interface Props {
  category: Category
  categories: Category[]
  emails: Email[]
  selectedEmail: Email | null
  mode: PartyMode
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => void
  onArchive: (email: Email) => void
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => void
  onDelete: (email: Email) => void
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onTodo?: (email: Email) => void
  onToggleBriefing?: (email: Email) => void
  onSnooze: (email: Email) => void
  onUnsubscribe: (email: Email) => void
  gmailAccount: AccountId
  isPriority?: boolean
  onTogglePriority?: () => void
  showUnreadOnly: boolean
}

function getCategoryAccent(name: string, mode: PartyMode) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const accents = [
    { header: "#FF1F6E", text: "#FFF5E0", border: "rgba(255,31,110,0.30)",  glow: "rgba(255,31,110,0.10)" },
    { header: "#FFD000", text: "#0D0821", border: "rgba(255,208,0,0.30)",   glow: "rgba(255,208,0,0.10)" },
    { header: "#00E5C4", text: "#0D0821", border: "rgba(0,229,196,0.30)",   glow: "rgba(0,229,196,0.10)" },
    { header: "#FF6B1A", text: "#FFF5E0", border: "rgba(255,107,26,0.30)",  glow: "rgba(255,107,26,0.10)" },
    { header: "#C084FC", text: "#0D0821", border: "rgba(192,132,252,0.30)", glow: "rgba(192,132,252,0.10)" },
    { header: "#B8F000", text: "#0D0821", border: "rgba(184,240,0,0.30)",   glow: "rgba(184,240,0,0.10)" },
  ]
  const base = accents[Math.abs(hash) % accents.length]

  if (mode === "party") return base

  if (mode === "wabi-sabi") {
    const strongBorder = base.border.replace(/[\d.]+\)$/, "0.55)")
    return {
      header: "#FFFFFF",
      text: base.header,       // color used as text, not fill
      border: strongBorder,
      glow: "transparent"
    }
  }

  // zen: pale tinted header
  const paleHeader = base.glow.replace(/[\d.]+\)$/, "0.18)")
  const softBorder = base.border.replace(/[\d.]+\)$/, "0.22)")
  return {
    header: paleHeader,
    text: base.header,
    border: softBorder,
    glow: base.glow.replace(/[\d.]+\)$/, "0.05)")
  }
}

export default function CategoryBlock({
  category, categories, emails, selectedEmail, mode,
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onTodo, onToggleBriefing, onSnooze, onUnsubscribe, gmailAccount,
  isPriority = false, onTogglePriority,
  showUnreadOnly,
}: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)
  const accent = getCategoryAccent(category.name, mode)

  // Collapse state: default collapsed for noisy categories in zen mode
  const [collapsed, setCollapsed] = useState(
    mode === "zen" && isNoisyCategory(category.name)
  )

  // On-demand section summary — generated only when the user asks for it, never persisted.
  const [summary, setSummary] = useState<EmailKeyPoint[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)

  async function handleSummarize() {
    if (summary.length > 0) {
      setSummary([])
      return
    }
    setSummaryLoading(true)
    try {
      const res = await fetch("/api/ai/section-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryName: category.name,
          emails: sorted.slice(0, 150).map(e => ({
            id: e.id, from: e.from, subject: e.subject, priority: e.priority, actionFlag: e.actionFlag,
            microSummary: e.microSummary,
            // Prefer the real body over Gmail's auto snippet — the snippet is just a
            // teaser line and routinely misses details (dates, prices) further down.
            bodySnippet: (e.body || e.snippet || "").slice(0, 500),
          })),
          mode,
        }),
      })
      const data: { items?: EmailKeyPoint[] } = await res.json()
      setSummary(data.items ?? [])
      setSummaryCollapsed(false)
    } catch {
      setSummary([])
    } finally {
      setSummaryLoading(false)
    }
  }

  // Order points to match the email list order, dropping any with no extracted point.
  const orderedPoints = summary.length > 0
    ? sorted
        .map(e => ({ email: e, point: summary.find(p => p.id === e.id)?.point }))
        .filter((row): row is { email: Email; point: string } => !!row.point)
    : []

  // Party mode: track initial count for evolution
  const initialCount = useRef(emails.length)
  const clearedCount = Math.max(0, initialCount.current - emails.length)
  const evolutionPct = initialCount.current > 0
    ? (clearedCount / initialCount.current) * 100
    : 0
  const isFullyCleared = initialCount.current > 0 && emails.length === 0

  // Award bonus karma when a category reaches 100% cleared in party mode
  const bonusAwardedRef = useRef(false)
  useEffect(() => {
    if (mode === "party" && isFullyCleared && !bonusAwardedRef.current && initialCount.current >= 2) {
      bonusAwardedRef.current = true
      recordAction("archive") // +2 bonus karma as a celebration
    }
  }, [isFullyCleared, mode])

  // Evolution visual state
  function getEvolutionStyle(): { headerOverlay?: string; progressColor?: string; progressLabel?: string } {
    if (mode !== "party" || initialCount.current === 0) return {}
    if (isFullyCleared) return {
      headerOverlay: "linear-gradient(135deg, rgba(0,196,167,0.35), rgba(143,201,0,0.25))",
      progressColor: "linear-gradient(90deg, #00C4A7, #8FC900)",
      progressLabel: "🪷 Clear",
    }
    if (evolutionPct >= 50) return {
      headerOverlay: "linear-gradient(135deg, rgba(255,208,0,0.20), rgba(255,107,26,0.12))",
      progressColor: "linear-gradient(90deg, #FFD000, #FF6B1A)",
    }
    if (evolutionPct >= 1) return {
      headerOverlay: "rgba(255,208,0,0.06)",
      progressColor: "rgba(255,208,0,0.60)",
    }
    return {}
  }

  const evo = getEvolutionStyle()
  const showEvolution = mode === "party" && initialCount.current > 0

  const cardBg = mode === "zen" ? "#FFFEF9" : "#FFFFFF"
  const cardShadow = mode === "wabi-sabi" ? "none" : (isFullyCleared && mode === "party"
    ? "0 4px 28px rgba(0,196,167,0.22)"
    : `0 4px 28px ${accent.glow}`)

  const headerControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 1, marginLeft: 4 }}>
      {category.id !== "__delete__" && emails.length > 0 && (
        <button
          onClick={e => { e.stopPropagation(); handleSummarize() }}
          disabled={summaryLoading}
          title={summary.length > 0 ? "Hide summary" : "Summarize this section"}
          style={{
            background: "none", border: "none", cursor: summaryLoading ? "wait" : "pointer",
            fontSize: "0.72rem", lineHeight: 1, padding: "1px 3px",
            opacity: summaryLoading ? 0.4 : 0.55,
            color: "inherit",
          }}
          aria-label={summary.length > 0 ? "hide summary" : "summarize section"}
        >
          {summaryLoading ? "⏳" : "✨"}
        </button>
      )}
      {onTogglePriority && category.id !== "__delete__" && (
        <button
          onClick={e => { e.stopPropagation(); onTogglePriority() }}
          title={isPriority
            ? `Unpin as priority ${categoryNoun(mode).singular.toLowerCase()}`
            : `Pin as your priority ${categoryNoun(mode).singular.toLowerCase()} (top-center)`}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.72rem", lineHeight: 1, padding: "1px 3px",
            opacity: isPriority ? 0.9 : 0.28,
            filter: isPriority ? "none" : "grayscale(1)",
            transition: "opacity 0.15s",
            color: "inherit",
          }}
          aria-label={isPriority ? "unpin priority" : "pin priority"}
        >
          📌
        </button>
      )}
      <button
        onClick={e => { e.stopPropagation(); setCollapsed(v => !v) }}
        title={collapsed ? `Expand ${category.name}` : `Collapse ${category.name}`}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: "0.65rem", lineHeight: 1, padding: "1px 3px",
          opacity: 0.55, color: "inherit",
          transition: "transform 0.2s",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          display: "inline-block",
        }}
        aria-label={collapsed ? "expand" : "collapse"}
      >
        ▼
      </button>
    </div>
  )

  return (
    <div style={{ position: "relative" }}>

      {/* Evolution progress bar (Party mode) */}
      {showEvolution && evolutionPct > 0 && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          borderRadius: "0 0 12px 12px", overflow: "hidden", zIndex: 5,
        }}>
          <div style={{
            height: "100%",
            width: `${evolutionPct}%`,
            background: evo.progressColor ?? "#FFD000",
            transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
          }} />
        </div>
      )}

      <LabelSection
        title={
          isFullyCleared && mode === "party"
            ? `${category.name.toUpperCase()} — 🪷`
            : category.name.toUpperCase()
        }
        headerBg={accent.header}
        headerTextColor={accent.text}
        border={accent.border}
        boxShadow={cardShadow}
        cardBg={cardBg}
        headerOverlay={evo.headerOverlay}
        collapsed={collapsed}
        headerSuffix={headerControls}
        emails={sorted}
        categories={categories}
        selectedEmail={selectedEmail}
        bulkActions={[
          { label: "Mark read", handler: async (targets) => { for (const e of targets) await onMarkRead(e) } },
          { label: "Archive",   handler: async (targets) => { for (const e of targets) await onArchive(e) } },
          { label: "Delete",    handler: async (targets) => { for (const e of targets) await onDelete(e) }, danger: true },
          {
            label: "Unsubscribe",
            handler: async (targets) => {
              for (const e of targets.filter(e => e.unsubscribeOneClick && e.unsubscribeUrl)) {
                await onUnsubscribe(e)
              }
            },
          },
        ]}
        onSelect={onSelect}
        onExpand={onExpand}
        onClose={onClose}
        onMarkRead={onMarkRead}
        onArchive={onArchive}
        onSaveDraft={onSaveDraft}
        onSend={onSend}
        onStar={onStar}
        onDelete={onDelete}
        onRecategorize={onRecategorize}
        onMarkReplied={onMarkReplied}
        onMarkDeletable={onMarkDeletable}
        onNewCategory={onNewCategory}
        onToggleTodo={onToggleTodo}
        onTodo={onTodo}
        onToggleBriefing={onToggleBriefing}
        onSnooze={onSnooze}
        onUnsubscribe={onUnsubscribe}
        gmailAccount={gmailAccount}
        mode={mode}
        showUnreadOnly={showUnreadOnly}
      >
        {orderedPoints.length > 0 && (
          <div style={{
            padding: summaryCollapsed ? "10px 16px" : "10px 16px 8px",
            borderBottom: "1px solid rgba(26,10,53,0.06)",
          }}>
            <button
              onClick={e => { e.stopPropagation(); setSummaryCollapsed(v => !v) }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer", padding: 0,
                margin: summaryCollapsed ? 0 : "0 0 6px",
              }}
              aria-expanded={!summaryCollapsed}
              aria-label={summaryCollapsed ? `Expand ${SUMMARY_TITLE[mode]}` : `Collapse ${SUMMARY_TITLE[mode]}`}
            >
              <span style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: accent.text === "#FFF5E0" ? accent.header : accent.text,
              }}>
                {SUMMARY_TITLE[mode]}
              </span>
              <span style={{
                fontSize: "0.6rem",
                color: accent.text === "#FFF5E0" ? accent.header : accent.text,
                opacity: 0.7,
                transition: "transform 0.2s",
                transform: summaryCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}>
                ▼
              </span>
            </button>
            {!summaryCollapsed && (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                {orderedPoints.map(({ email, point }) => (
                  <li key={email.id} style={{ fontSize: "0.84rem", lineHeight: 1.45, color: "rgba(26,10,53,0.75)" }}>
                    <span style={{ fontWeight: 600, color: "rgba(26,10,53,0.9)" }}>{email.from.split("<")[0].trim() || email.from}</span>
                    {" — "}
                    {stripMarkdown(point)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </LabelSection>
    </div>
  )
}
