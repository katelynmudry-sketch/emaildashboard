"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import type { PartyMode } from "@/lib/party-mode"
import type { ProductionNotes } from "@/lib/production-notes"

const ADMIN_EMAIL = "katelynmudry@gmail.com"

const copy = {
  party: {
    header: "Status",
    issuesLabel: "Current issues",
    nextLabel: "What's next",
    formPlaceholder: "What's on your mind?",
    sendBtn: "Send",
    sending: "Sending...",
    success: "Sent!",
    error: "Something went wrong.",
  },
  zen: {
    header: "Status",
    issuesLabel: "Things to hold lightly",
    nextLabel: "What's unfolding",
    formPlaceholder: "Share what you noticed…",
    sendBtn: "Send",
    sending: "Sending…",
    success: "Received. Thank you.",
    error: "Something went wrong.",
  },
  "wabi-sabi": {
    header: "What's the tea",
    issuesLabel: "Known issues",
    nextLabel: "Coming soon",
    formPlaceholder: "Drop your thoughts, bestie 💅",
    sendBtn: "Send",
    sending: "Sending...",
    success: "Sent! 💕",
    error: "Ugh, something went wrong.",
  },
}

function getAccent(mode: PartyMode) {
  if (mode === "zen") return "#C8960C"
  if (mode === "wabi-sabi") return "#111111"
  return "#7C3AED"
}

const FS = "0.70rem"
const MUTED = "rgba(26,10,53,0.55)"

export default function ProductionNotesBand({ mode }: { mode: PartyMode }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.email?.toLowerCase() === ADMIN_EMAIL

  const [notes, setNotes] = useState<ProductionNotes | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editIssues, setEditIssues] = useState("")
  const [editNext, setEditNext] = useState("")
  const [saving, setSaving] = useState(false)
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

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: editIssues, next: editNext }),
      })
      if (res.ok) {
        setNotes(await res.json())
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

  const taStyle: React.CSSProperties = {
    width: "100%", padding: "3px 6px", borderRadius: 4,
    border: `1px solid ${accent}44`, background: "rgba(255,255,255,0.6)",
    fontSize: FS, lineHeight: 1.4, resize: "vertical",
    fontFamily: "inherit", color: "#1A0A35", outline: "none",
  }

  return (
    <div style={{ fontSize: FS, color: MUTED, textAlign: "right" }}>
      {/* Collapsed trigger — same style as Sent/Settings/Sign out */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: FS, fontWeight: 500, opacity: 0.55, padding: "4px 0", color: "inherit" }}
      >
        {open ? "▸" : "▾"} {t.header}
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{ marginTop: 6, textAlign: "left", width: 240 }}>

          {/* Notes display or edit */}
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <div style={{ fontWeight: 600, opacity: 0.5, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.issuesLabel}</div>
                <textarea value={editIssues} onChange={e => setEditIssues(e.target.value)} rows={2} style={taStyle} />
              </div>
              <div>
                <div style={{ fontWeight: 600, opacity: 0.5, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.nextLabel}</div>
                <textarea value={editNext} onChange={e => setEditNext(e.target.value)} rows={2} style={taStyle} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={saveEdit} disabled={saving} style={{ fontSize: FS, padding: "2px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: accent, color: "#fff", fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditing(false)} style={{ fontSize: FS, padding: "2px 8px", borderRadius: 4, cursor: "pointer", background: "none", border: `1px solid ${accent}44`, color: accent }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.issuesLabel}: </span>
                <span>{notes?.issues ?? "—"}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t.nextLabel}: </span>
                <span>{notes?.next ?? "—"}</span>
              </div>
              {isAdmin && (
                <button onClick={startEdit} style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", fontSize: FS, opacity: 0.45, padding: 0 }}>
                  ✏️ edit
                </button>
              )}
            </div>
          )}

          {/* Comment form */}
          {!editing && (
            <div style={{ borderTop: `1px solid ${accent}22`, paddingTop: 6 }}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t.formPlaceholder}
                rows={2}
                style={taStyle}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <button
                  onClick={submitFeedback}
                  disabled={submitState === "sending" || !message.trim()}
                  style={{ padding: "2px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: accent, color: "#fff", fontSize: FS, fontWeight: 600, opacity: (submitState === "sending" || !message.trim()) ? 0.5 : 1 }}
                >
                  {submitState === "sending" ? t.sending : t.sendBtn}
                </button>
                {submitState === "success" && <span style={{ color: "#00A884", fontWeight: 600 }}>{t.success}</span>}
                {submitState === "error" && <span style={{ color: "#E53E3E" }}>{t.error}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
