"use client"

import { useEffect, useState } from "react"
import type { AccountId } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"

interface Props {
  open: boolean
  onClose: () => void
  account: AccountId
  mode: PartyMode
}

interface SentEmail {
  id: string
  to: string
  subject: string
  date: string
  snippet: string
}

const HEADER_GRADIENT: Record<PartyMode, string> = {
  party: "linear-gradient(135deg, #8B3FD8 0%, #FF1F6E 100%)",
  zen: "linear-gradient(135deg, #C8960C 0%, #8B6914 100%)",
  "wabi-sabi": "linear-gradient(135deg, #E8956A 0%, #C8860C 100%)",
}

const HEADER_TITLE: Record<PartyMode, string> = {
  party: "Sent",
  zen: "Sent",
  "wabi-sabi": "Sent (omg)",
}

const EMPTY_COPY: Record<PartyMode, string> = {
  party: "Nothing sent yet.",
  zen: "Nothing sent.",
  "wabi-sabi": "no sent emails bestie",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function SentDrawer({ open, onClose, account, mode }: Props) {
  const [loading, setLoading] = useState(false)
  const [emails, setEmails] = useState<SentEmail[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/gmail/sent?account=${account}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: { emails?: SentEmail[]; error?: string }) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setEmails(data.emails ?? [])
      })
      .catch(err => {
        if (err.name !== "AbortError") setError("Failed to load sent emails")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [open, account])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(26,10,53,0.35)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(480px, 96vw)",
        zIndex: 201,
        background: "#FFFFFF",
        boxShadow: "-8px 0 40px rgba(26,10,53,0.18)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.32s cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid rgba(26,10,53,0.08)",
          background: HEADER_GRADIENT[mode],
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem", color: "#FFF5E0",
              margin: 0, lineHeight: 1,
            }}>
              {HEADER_TITLE[mode]}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,245,224,0.18)", border: "none", borderRadius: 8,
                color: "#FFF5E0", width: 32, height: 32, cursor: "pointer",
                fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px" }}>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  height: 48, borderRadius: 8,
                  background: "rgba(26,10,53,0.06)",
                  animation: "sentPulse 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.08}s`,
                }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <p style={{ textAlign: "center", padding: "40px 0", color: "#FF1F6E", fontSize: "0.82rem" }}>
              {error}
            </p>
          )}

          {!loading && !error && emails.length === 0 && (
            <p style={{ textAlign: "center", padding: "40px 0", color: "rgba(26,10,53,0.40)", fontSize: "0.82rem" }}>
              {EMPTY_COPY[mode]}
            </p>
          )}

          {!loading && !error && emails.map(email => {
            const expanded = expandedId === email.id
            return (
              <div
                key={email.id}
                onClick={() => setExpandedId(expanded ? null : email.id)}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(26,10,53,0.06)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span style={{
                    fontSize: "0.82rem", fontWeight: 600, color: "#1A0A35",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
                  }}>
                    {email.subject}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: "0.70rem", color: "rgba(26,10,53,0.40)" }}>
                    {formatDate(email.date)}
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.45)", marginTop: 2 }}>
                  To: {email.to}
                </div>
                <p style={{
                  fontSize: "0.76rem", color: "rgba(26,10,53,0.60)", margin: "4px 0 0", lineHeight: 1.5,
                  overflow: "hidden",
                  textOverflow: expanded ? "initial" : "ellipsis",
                  whiteSpace: expanded ? "normal" : "nowrap",
                }}>
                  {email.snippet}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes sentPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  )
}
