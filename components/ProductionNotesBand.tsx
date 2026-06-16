"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { PartyMode } from "@/lib/party-mode"
import type { ProductionNotes } from "@/lib/production-notes"

const ADMIN_EMAIL = "katelynmudry@gmail.com"

const copy = {
  party: {
    header: "📋 What's happening",
    issuesLabel: "⚠️ Current issues",
    nextLabel: "🔭 What's next",
    formToggle: "Drop a note ▾",
    formPlaceholder: "What's on your mind?",
    sendBtn: "Send",
    sending: "Sending...",
    success: "Sent!!",
    error: "Something went wrong.",
  },
  zen: {
    header: "Current notes",
    issuesLabel: "Things to hold lightly",
    nextLabel: "What's unfolding",
    formToggle: "Leave a note ▾",
    formPlaceholder: "Share what you noticed…",
    sendBtn: "Send",
    sending: "Sending…",
    success: "Received. Thank you.",
    error: "Something went wrong. Please try again.",
  },
  "wabi-sabi": {
    header: "📋 What's the tea",
    issuesLabel: "⚠️ Known issues",
    nextLabel: "🔭 Coming soon!!",
    formToggle: "Leave a note ▾",
    formPlaceholder: "Drop your thoughts, bestie 💅",
    sendBtn: "Send note ✨",
    sending: "Sending...",
    success: "Sent! You're literally the best 💕",
    error: "Ugh, something went wrong.",
  },
}

function getBandStyle(mode: PartyMode): React.CSSProperties {
  if (mode === "zen") return { background: "rgba(200,150,12,0.04)", borderBottom: "1px solid rgba(200,150,12,0.15)" }
  if (mode === "wabi-sabi") return { background: "rgba(17,17,17,0.02)", borderBottom: "1px solid rgba(17,17,17,0.10)" }
  return { background: "rgba(139,92,246,0.05)", borderBottom: "1px solid rgba(139,92,246,0.12)" }
}

function getAccent(mode: PartyMode) {
  if (mode === "zen") return "#C8960C"
  if (mode === "wabi-sabi") return "#111111"
  return "#7C3AED"
}

export default function ProductionNotesBand({ mode }: { mode: PartyMode }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.email?.toLowerCase() === ADMIN_EMAIL

  const [notes, setNotes] = useState<ProductionNotes | null>(null)
  const [editing, setEditing] = useState(false)
  const [editIssues, setEditIssues] = useState("")
  const [editNext, setEditNext] = useState("")
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "success" | "error">("idle")

  const t = copy[mode]
  const accent = getAccent(mode)

  useEffect(() => {
    fetch("/api/notes")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNotes(data) })
      .catch(() => {})
  }, [])

  function startEdit() {
    setEditIssues(notes?.issues ?? "")
    setEditNext(notes?.next ?? "")
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: editIssues, next: editNext }),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotes(updated)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function submitFeedback() {
    if (!message.trim()) return
    setSubmitState("sending")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      if (res.ok) {
        setSubmitState("success")
        setMessage("")
        setTimeout(() => setSubmitState("idle"), 3000)
      } else {
        setSubmitState("error")
        setTimeout(() => setSubmitState("idle"), 4000)
      }
    } catch {
      setSubmitState("error")
      setTimeout(() => setSubmitState("idle"), 4000)
    }
  }

  const textareaBase: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${accent}44`,
    background: "rgba(255,255,255,0.6)",
    fontSize: "0.88rem",
    lineHeight: 1.5,
    resize: "vertical",
    fontFamily: "inherit",
    color: "#1A0A35",
    outline: "none",
  }

  return (
    <div style={{ padding: "10px 28px 12px", ...getBandStyle(mode) }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color: accent,
        }}>
          {t.header}
        </span>
        {isAdmin && !editing && (
          <button
            onClick={startEdit}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", opacity: 0.5, padding: "0 2px", lineHeight: 1 }}
            title="Edit notes"
          >
            ✏️
          </button>
        )}
        {editing && (
          <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button
              onClick={saveEdit}
              disabled={saving}
              style={{
                fontSize: "0.75rem", padding: "2px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                background: accent, color: "#fff", fontWeight: 600, opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              style={{
                fontSize: "0.75rem", padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                background: "none", border: `1px solid ${accent}44`, color: accent,
              }}
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {/* Two-column notes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: `${accent}bb`, marginBottom: 4 }}>
            {t.issuesLabel}
          </div>
          {editing ? (
            <textarea
              value={editIssues}
              onChange={e => setEditIssues(e.target.value)}
              rows={3}
              style={textareaBase}
            />
          ) : (
            <p style={{ fontSize: "0.875rem", color: "rgba(26,10,53,0.75)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>
              {notes?.issues ?? "—"}
            </p>
          )}
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: `${accent}bb`, marginBottom: 4 }}>
            {t.nextLabel}
          </div>
          {editing ? (
            <textarea
              value={editNext}
              onChange={e => setEditNext(e.target.value)}
              rows={3}
              style={textareaBase}
            />
          ) : (
            <p style={{ fontSize: "0.875rem", color: "rgba(26,10,53,0.75)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>
              {notes?.next ?? "—"}
            </p>
          )}
        </div>
      </div>

      {/* Comment form */}
      <div>
        <button
          onClick={() => setFormOpen(o => !o)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.75rem", fontWeight: 600, color: accent,
            textTransform: "uppercase", letterSpacing: "0.08em", padding: 0,
          }}
        >
          {formOpen ? t.formToggle.replace("▾", "▸") : t.formToggle}
        </button>

        {formOpen && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 }}>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t.formPlaceholder}
              rows={3}
              style={textareaBase}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={submitFeedback}
                disabled={submitState === "sending" || !message.trim()}
                style={{
                  padding: "5px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: accent, color: "#fff", fontSize: "0.82rem", fontWeight: 600,
                  opacity: (submitState === "sending" || !message.trim()) ? 0.55 : 1,
                }}
              >
                {submitState === "sending" ? t.sending : t.sendBtn}
              </button>
              {submitState === "success" && (
                <span style={{ fontSize: "0.82rem", color: "#00A884", fontWeight: 600 }}>{t.success}</span>
              )}
              {submitState === "error" && (
                <span style={{ fontSize: "0.82rem", color: "#E53E3E" }}>{t.error}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
