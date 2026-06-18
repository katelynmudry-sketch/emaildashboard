"use client"

import { useState } from "react"
import { markEmailOptInAnswered } from "@/lib/party-mode"
import type { PartyMode } from "@/lib/party-mode"

export default function EmailOptInBanner({ mode, onDone }: { mode: PartyMode; onDone: () => void }) {
  const [sending, setSending] = useState(false)
  const isZen = mode === "zen"
  const isBasicAF = mode === "wabi-sabi"

  const copy = isZen
    ? {
        title: "A quiet invitation",
        body: "I sometimes build other small tools. Want an occasional note when one's ready?",
        yes: "Yes, gently",
        no: "Not now",
      }
    : isBasicAF
      ? {
          title: "ok this is so random but",
          body: "literally building other apps too, bestie. want the updates or nah",
          yes: "yes obsessed, sign me up",
          no: "no thanks",
        }
      : {
          title: "🎉 One more thing!",
          body: "I build other apps too — want me to email you when a new one drops?",
          yes: "Yes, hype me up!",
          no: "No thanks",
        }

  async function respond(consent: boolean) {
    setSending(true)
    if (consent) {
      try {
        await fetch("/api/email-signup", { method: "POST" })
      } catch {}
    }
    markEmailOptInAnswered()
    setSending(false)
    onDone()
  }

  const accent = isZen ? "#C8960C" : isBasicAF ? "#111111" : "#FF1F6E"

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 200,
        maxWidth: 320,
        padding: "16px 18px",
        borderRadius: isBasicAF ? 4 : 14,
        background: isZen ? "#FFFBF0" : isBasicAF ? "#F5E9DA" : "#FFFFFF",
        border: `1px solid ${accent}55`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: accent }}>{copy.title}</div>
      <div style={{ fontSize: "0.9rem", marginBottom: 12, color: "#333" }}>{copy.body}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={sending}
          onClick={() => respond(true)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: isBasicAF ? 4 : 8,
            border: "none",
            background: accent,
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copy.yes}
        </button>
        <button
          disabled={sending}
          onClick={() => respond(false)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: isBasicAF ? 4 : 8,
            border: `1px solid ${accent}55`,
            background: "transparent",
            color: "#333",
            cursor: "pointer",
          }}
        >
          {copy.no}
        </button>
      </div>
    </div>
  )
}
