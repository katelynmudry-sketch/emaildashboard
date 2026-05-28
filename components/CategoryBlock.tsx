"use client"

import { useState, useEffect, useRef } from "react"
import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"
import { recordAction } from "@/lib/stats"
import LabelSection from "./LabelSection"

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
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
}

function getCategoryAccent(name: string) {
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
  return accents[Math.abs(hash) % accents.length]
}

export default function CategoryBlock({
  category, categories, emails, selectedEmail, mode,
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onSnooze, gmailAccount,
}: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)
  const accent = getCategoryAccent(category.name)

  // Collapse state: default collapsed for noisy categories in zen mode
  const [collapsed, setCollapsed] = useState(
    mode === "zen" && isNoisyCategory(category.name)
  )

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

  return (
    <div style={{ position: "relative" }}>
      {/* Collapse toggle — always available, noisy cats default-closed in zen */}
      <button
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? `Expand ${category.name}` : `Collapse ${category.name}`}
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 10,
          background: "none", border: "none", cursor: "pointer",
          fontSize: "0.7rem", color: "rgba(26,10,53,0.35)",
          padding: "2px 4px", lineHeight: 1,
          transition: "color 0.15s, transform 0.2s",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
        }}
        aria-label={collapsed ? "expand" : "collapse"}
      >
        ▼
      </button>

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
        boxShadow={isFullyCleared && mode === "party"
          ? "0 4px 28px rgba(0,196,167,0.22)"
          : `0 4px 28px ${accent.glow}`
        }
        headerOverlay={evo.headerOverlay}
        collapsed={collapsed}
        emails={sorted}
        categories={categories}
        selectedEmail={selectedEmail}
        bulkActions={[
          { label: "Mark read", handler: async (targets) => { for (const e of targets) await onMarkRead(e) } },
          { label: "Archive",   handler: async (targets) => { for (const e of targets) await onArchive(e) } },
          { label: "Delete",    handler: async (targets) => { for (const e of targets) await onDelete(e) }, danger: true },
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
        onSnooze={onSnooze}
        gmailAccount={gmailAccount}
      />
    </div>
  )
}
