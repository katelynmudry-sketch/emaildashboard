"use client"

import { useEffect, useState } from "react"
import type { PartyMode } from "@/lib/party-mode"
import { setPartyMode, markGateSeen } from "@/lib/party-mode"
import ConfettiBlast from "./ConfettiBlast"

interface QuoteGateProps {
  onEnter: (mode: PartyMode) => void
}

interface DharmaData {
  teacher: { name: string; tradition: string }
  quote: string
  reflection: string
}

export default function QuoteGate({ onEnter }: QuoteGateProps) {
  const [dharma, setDharma] = useState<DharmaData | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [chosen, setChosen] = useState<PartyMode | null>(null)

  useEffect(() => {
    fetch("/api/dashboard/dharma", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then((d: DharmaData | null) => setDharma(d))
      .catch(() => {})
  }, [])

  function enter(mode: PartyMode) {
    setChosen(mode)
    setPartyMode(mode)
    markGateSeen()
    if (mode === "party") setConfetti(true)
    setDismissing(true)
    setTimeout(() => onEnter(mode), mode === "party" ? 700 : 500)
  }

  return (
    <>
      {/* Gate overlay */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "linear-gradient(145deg, #1A0A35 0%, #2D0F5C 55%, #0D1A35 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 28, padding: "40px 32px",
          opacity: dismissing ? 0 : 1,
          transform: dismissing && chosen === "party" ? "scale(1.04)" : "scale(1)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
          pointerEvents: dismissing ? "none" : "auto",
        }}
      >
        {/* Ornament */}
        <div style={{
          fontSize: "3rem",
          animation: "float-gate 3s ease-in-out infinite",
          filter: "drop-shadow(0 0 18px rgba(255,208,0,0.45))",
        }}>
          ☸️
        </div>

        {/* Teacher */}
        {dharma && (
          <div style={{
            fontSize: "0.72rem", letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(255,208,0,0.65)",
          }}>
            {dharma.teacher.name} · {dharma.teacher.tradition}
          </div>
        )}

        {/* Quote */}
        <blockquote style={{
          fontStyle: "italic",
          fontSize: "clamp(1.15rem, 3.5vw, 1.9rem)",
          lineHeight: 1.6, textAlign: "center",
          color: "rgba(255,255,255,0.92)",
          maxWidth: 580,
          margin: 0,
        }}>
          &ldquo;{dharma?.quote ?? "The present moment is the only moment available to us, and it is the door to all moments."}&rdquo;
        </blockquote>

        {/* Reflection */}
        {dharma?.reflection && (
          <p style={{
            fontSize: "0.95rem", color: "rgba(255,255,255,0.45)",
            textAlign: "center", maxWidth: 420, lineHeight: 1.65, margin: 0,
          }}>
            {dharma.reflection}
          </p>
        )}

        {/* Mode buttons */}
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => enter("zen")}
            style={{
              padding: "12px 32px", borderRadius: 999,
              border: "1px solid rgba(147,197,253,0.35)",
              background: "rgba(147,197,253,0.08)",
              color: "rgba(200,230,255,0.90)",
              fontSize: "0.88rem", fontWeight: 600, letterSpacing: "0.10em",
              cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(147,197,253,0.16)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(147,197,253,0.08)")}
          >
            🧘 Zen Mode
          </button>

          <button
            onClick={() => enter("party")}
            style={{
              padding: "12px 32px", borderRadius: 999,
              border: "1px solid rgba(255,208,0,0.40)",
              background: "rgba(255,208,0,0.10)",
              color: "rgba(255,208,0,0.92)",
              fontSize: "0.88rem", fontWeight: 600, letterSpacing: "0.10em",
              cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 0 20px rgba(255,208,0,0.15)",
              animation: "pulse-gate 2.4s ease-in-out infinite",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,208,0,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,208,0,0.10)")}
          >
            🎉 Party Mode
          </button>
        </div>

        {/* Skip link */}
        <button
          onClick={() => enter("party")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.72rem", color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.08em", marginTop: 4,
          }}
        >
          skip →
        </button>
      </div>

      {/* Keyframes via style tag */}
      <style>{`
        @keyframes float-gate {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-9px); }
        }
        @keyframes pulse-gate {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,208,0,0.3); }
          50% { box-shadow: 0 0 0 10px rgba(255,208,0,0); }
        }
      `}</style>

      {confetti && <ConfettiBlast onDone={() => setConfetti(false)} />}
    </>
  )
}
