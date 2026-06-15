"use client"

import { useState } from "react"
import type { PartyMode } from "@/lib/party-mode"
import { setPartyMode, markGateSeen } from "@/lib/party-mode"
import ConfettiBlast from "./ConfettiBlast"

interface QuoteGateProps {
  onEnter: (mode: PartyMode) => void
}

// Live preview of each vibe while hovering its button — background, ornament, and copy
// all shift to match that mode's tone (per CLAUDE.md's 3-theme voice guide).
const PREVIEWS: Record<"default" | PartyMode, {
  bg: string
  textColor: string
  subTextColor: string
  labelColor: string
  mutedColor: string
  ornament: string
  glow: string
  label: string | null
  quote: string | null
  reflection: string | null
  lotusField?: boolean
}> = {
  default: {
    bg: "linear-gradient(145deg, #2D0F5C 0%, #6B1F5C 55%, #3D0A2E 100%)",
    textColor: "rgba(255,255,255,0.95)",
    subTextColor: "rgba(255,255,255,0.55)",
    labelColor: "rgba(255,208,0,0.85)",
    mutedColor: "rgba(255,255,255,0.30)",
    ornament: "🎉",
    glow: "rgba(255,31,110,0.45)",
    label: null,
    quote: null,
    reflection: null,
  },
  zen: {
    bg: "linear-gradient(145deg, #2B1B00 0%, #4A3300 55%, #1A0F00 100%)",
    textColor: "rgba(255,250,235,0.95)",
    subTextColor: "rgba(255,250,235,0.55)",
    labelColor: "rgba(255,208,0,0.70)",
    mutedColor: "rgba(255,250,235,0.30)",
    ornament: "🪷",
    glow: "rgba(255,208,0,0.45)",
    label: "Zen Mode · Preview",
    quote: "Wherever you are, be there totally.",
    reflection: "There's no inbox to conquer — only this moment, and the next small thing.",
    lotusField: true,
  },
  party: {
    bg: "linear-gradient(145deg, #2D0F5C 0%, #6B1F5C 55%, #3D0A2E 100%)",
    textColor: "rgba(255,255,255,0.95)",
    subTextColor: "rgba(255,255,255,0.55)",
    labelColor: "rgba(255,208,0,0.85)",
    mutedColor: "rgba(255,255,255,0.30)",
    ornament: "🎉",
    glow: "rgba(255,31,110,0.45)",
    label: "Party Mode · Preview",
    quote: "Ready to turn this inbox into your high score?",
    reflection: "Every sorted email is XP. Let's go clear some levels!",
  },
  "wabi-sabi": {
    bg: "#FFFFFF",
    textColor: "#1A0A35",
    subTextColor: "rgba(26,10,53,0.55)",
    labelColor: "#C17D3C",
    mutedColor: "rgba(26,10,53,0.30)",
    ornament: "🍵",
    glow: "rgba(193,125,60,0.45)",
    label: "Basic AF · Preview",
    quote: "literally just manifesting an empty inbox rn, it's giving main character energy",
    reflection: "no thoughts just vibes, pumpkin spice, and serving organized bestie 🎀",
  },
}

// Scattered positions for the zen "lotus field" decoration
const LOTUS_FIELD = [
  { left: "8%", top: "15%", size: "2.2rem", delay: "0s" },
  { left: "85%", top: "12%", size: "1.6rem", delay: "0.4s" },
  { left: "18%", top: "75%", size: "1.8rem", delay: "0.8s" },
  { left: "92%", top: "70%", size: "2.4rem", delay: "0.2s" },
  { left: "50%", top: "8%", size: "1.4rem", delay: "0.6s" },
  { left: "5%", top: "50%", size: "1.5rem", delay: "1s" },
  { left: "70%", top: "45%", size: "1.9rem", delay: "0.3s" },
  { left: "35%", top: "88%", size: "2.0rem", delay: "0.7s" },
  { left: "60%", top: "85%", size: "1.5rem", delay: "0.5s" },
  { left: "25%", top: "30%", size: "1.3rem", delay: "0.9s" },
]

export default function QuoteGate({ onEnter }: QuoteGateProps) {
  const [dismissing, setDismissing] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [chosen, setChosen] = useState<PartyMode | null>(null)
  const [hovered, setHovered] = useState<PartyMode | null>(null)

  // While dismissing, keep showing the chosen mode's colors — don't let the
  // mouseleave-triggered setHovered(null) flash the overlay back to default.
  const preview = dismissing && chosen ? PREVIEWS[chosen] : PREVIEWS[hovered ?? "default"]

  function enter(mode: PartyMode) {
    setChosen(mode)
    setHovered(mode)
    setPartyMode(mode)
    markGateSeen()
    if (mode === "party") setConfetti(true)
    setDismissing(true)
    setTimeout(() => onEnter(mode), mode === "party" ? 700 : 500)
  }

  const label = hovered ? preview.label : null
  const quote = hovered ? preview.quote : null
  const reflection = hovered ? preview.reflection : null

  return (
    <>
      {/* Gate overlay */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: preview.bg,
          opacity: dismissing ? 0 : 1,
          transform: dismissing && chosen === "party" ? "scale(1.04)" : "scale(1)",
          transition: "background 0.5s ease, opacity 0.5s ease, transform 0.5s ease",
          pointerEvents: dismissing ? "none" : "auto",
          overflow: "hidden",
        }}
      >
        {/* Lotus field — zen preview decoration */}
        {hovered === "zen" && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {LOTUS_FIELD.map((pos, i) => (
              <span
                key={i}
                style={{
                  position: "absolute", left: pos.left, top: pos.top,
                  fontSize: pos.size, opacity: 0.16,
                  animation: `float-gate ${3 + (i % 3)}s ease-in-out infinite`,
                  animationDelay: pos.delay,
                }}
              >
                🪷
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          width: "100%", height: "100%",
          gap: 28, padding: "40px 32px",
        }}>
          {/* Ornament */}
          <div style={{
            fontSize: "3rem",
            animation: "float-gate 3s ease-in-out infinite",
            filter: `drop-shadow(0 0 18px ${preview.glow})`,
            transition: "filter 0.5s ease",
          }}>
            {preview.ornament}
          </div>

          {/* Teacher / mode label */}
          {label && (
            <div style={{
              fontSize: "0.72rem", letterSpacing: "0.22em", textTransform: "uppercase",
              color: preview.labelColor,
              transition: "color 0.5s ease",
            }}>
              {label}
            </div>
          )}

          {/* Quote */}
          {quote && (
            <blockquote style={{
              fontStyle: "italic",
              fontSize: "clamp(1.15rem, 3.5vw, 1.9rem)",
              lineHeight: 1.6, textAlign: "center",
              color: preview.textColor,
              maxWidth: 580,
              margin: 0,
              transition: "color 0.5s ease",
            }}>
              &ldquo;{quote}&rdquo;
            </blockquote>
          )}

          {/* Reflection */}
          {reflection && (
            <p style={{
              fontSize: "0.95rem", color: preview.subTextColor,
              textAlign: "center", maxWidth: 420, lineHeight: 1.65, margin: 0,
              transition: "color 0.5s ease",
            }}>
              {reflection}
            </p>
          )}

          {/* Mode buttons */}
          <div
            style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}
            onMouseLeave={() => setHovered(null)}
          >
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
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(147,197,253,0.16)"; setHovered("zen") }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(147,197,253,0.08)" }}
            >
              🪷 Zen Mode
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
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,208,0,0.18)"; setHovered("party") }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,208,0,0.10)" }}
            >
              🎉 Party Mode
            </button>

            <button
              onClick={() => enter("wabi-sabi")}
              style={{
                padding: "12px 32px", borderRadius: 999,
                border: "1px solid rgba(139,63,216,0.35)",
                background: "rgba(139,63,216,0.08)",
                color: "rgba(180,150,220,0.90)",
                fontSize: "0.88rem", fontWeight: 600, letterSpacing: "0.10em",
                cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,63,216,0.16)"; setHovered("wabi-sabi") }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,63,216,0.08)" }}
            >
              🍵 Basic AF
            </button>
          </div>

          {/* Reassurance: vibe is changeable anytime */}
          <p style={{
            fontSize: "0.72rem", color: preview.mutedColor,
            letterSpacing: "0.04em", textAlign: "center", margin: 0,
            transition: "color 0.5s ease",
          }}>
            You can change this anytime from the header.
          </p>

          {/* Skip link */}
          <button
            onClick={() => enter("party")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "0.72rem", color: preview.mutedColor,
              letterSpacing: "0.08em", marginTop: 4,
              transition: "color 0.5s ease",
            }}
          >
            skip →
          </button>
        </div>
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
