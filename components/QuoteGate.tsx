"use client"

import { useState, useEffect } from "react"
import type { PartyMode } from "@/lib/party-mode"
import { setPartyMode, markGateSeen } from "@/lib/party-mode"
import ConfettiBlast from "./ConfettiBlast"

interface QuoteGateProps {
  onEnter: (mode: PartyMode) => void
}

// Live preview of each vibe while hovering (desktop) or tapping (mobile) its
// button — background, ornament, and copy all shift to match that mode's
// tone (per CLAUDE.md's 3-theme voice guide).
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

const MODE_BUTTONS: {
  mode: PartyMode
  emoji: string
  label: string
  border: string
  bg: string
  hoverBg: string
  color: string
  glow?: string
  pulse?: boolean
}[] = [
  {
    mode: "zen",
    emoji: "🪷",
    label: "Zen Mode",
    border: "1px solid rgba(147,197,253,0.35)",
    bg: "rgba(147,197,253,0.08)",
    hoverBg: "rgba(147,197,253,0.16)",
    color: "rgba(200,230,255,0.90)",
  },
  {
    mode: "party",
    emoji: "🎉",
    label: "Party Mode",
    border: "1px solid rgba(255,208,0,0.40)",
    bg: "rgba(255,208,0,0.10)",
    hoverBg: "rgba(255,208,0,0.18)",
    color: "rgba(255,208,0,0.92)",
    glow: "0 0 20px rgba(255,208,0,0.15)",
    pulse: true,
  },
  {
    mode: "wabi-sabi",
    emoji: "🍵",
    label: "Basic AF",
    border: "1px solid rgba(139,63,216,0.35)",
    bg: "rgba(139,63,216,0.08)",
    hoverBg: "rgba(139,63,216,0.16)",
    color: "rgba(180,150,220,0.90)",
  },
]

export default function QuoteGate({ onEnter }: QuoteGateProps) {
  const [dismissing, setDismissing] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [chosen, setChosen] = useState<PartyMode | null>(null)
  const [hovered, setHovered] = useState<PartyMode | null>(null)
  const [supportsHover, setSupportsHover] = useState(true)

  // Touch devices don't get real hover — detect once on mount so mode
  // buttons can switch to a "tap to preview, tap again to choose" flow.
  useEffect(() => {
    setSupportsHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches)
  }, [])

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

  // Desktop: hover already previews, so a click commits immediately.
  // Mobile/touch (no hover): first tap previews, a second tap on the
  // same button commits.
  function handleModeClick(mode: PartyMode) {
    if (supportsHover || hovered === mode) {
      enter(mode)
    } else {
      setHovered(mode)
    }
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
          overflow: "auto",
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
          minHeight: "100%", width: "100%",
          gap: 18, padding: "40px 24px",
          boxSizing: "border-box",
        }}>
          {/* Ornament */}
          <div style={{
            fontSize: "2.6rem",
            animation: "float-gate 3s ease-in-out infinite",
            filter: `drop-shadow(0 0 18px ${preview.glow})`,
            transition: "filter 0.5s ease",
          }}>
            {preview.ornament}
          </div>

          {/* Title + app explanation + encouragement (always visible) */}
          <div style={{ textAlign: "center", maxWidth: 520 }}>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 5vw, 2.6rem)",
              letterSpacing: "0.04em",
              color: preview.textColor,
              margin: "0 0 8px",
              lineHeight: 1.1,
              transition: "color 0.5s ease",
            }}>
              EMAIL PARTY
            </h1>
            <p style={{
              fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.4,
              color: preview.textColor,
              margin: "0 0 8px",
              transition: "color 0.5s ease",
            }}>
              Inbox zero is just one party away.
            </p>
            <p style={{
              fontSize: "0.95rem", lineHeight: 1.6,
              color: preview.subTextColor,
              margin: "0 0 6px",
              transition: "color 0.5s ease",
            }}>
              Auto-organized and visually sorted into the spaces that matter — your Gardens,
              Arenas, or Eras — so you instantly see what needs you today, what can wait, and
              what&rsquo;s ready for a reply, whether you write it yourself or let AI draft one for you.
            </p>
            <p style={{
              fontSize: "0.82rem", lineHeight: 1.6,
              color: preview.mutedColor,
              margin: 0,
              transition: "color 0.5s ease",
            }}>
              Pick the vibe that feels right for you — you can change it anytime from the header.
            </p>
          </div>

          {/* Live demo line — updates with hover (desktop) / tap (mobile) */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 10,
            minHeight: 210, width: "100%",
          }}>
            {label && (
              <div style={{
                fontSize: "0.72rem", letterSpacing: "0.22em", textTransform: "uppercase",
                color: preview.labelColor,
                transition: "color 0.5s ease",
              }}>
                {label}
              </div>
            )}

            {quote ? (
              <blockquote style={{
                fontStyle: "italic",
                fontSize: "clamp(1.05rem, 3.2vw, 1.7rem)",
                lineHeight: 1.6, textAlign: "center",
                color: preview.textColor,
                maxWidth: 580,
                margin: 0,
                transition: "color 0.5s ease",
              }}>
                &ldquo;{quote}&rdquo;
              </blockquote>
            ) : (
              <p style={{
                fontSize: "0.85rem", letterSpacing: "0.06em",
                textAlign: "center",
                color: preview.mutedColor,
                margin: 0,
                transition: "color 0.5s ease",
              }}>
                {supportsHover ? "👀 Hover a vibe below to preview it" : "👀 Tap a vibe below to preview it"}
              </p>
            )}

            {reflection && (
              <p style={{
                fontSize: "0.95rem", color: preview.subTextColor,
                textAlign: "center", maxWidth: 420, lineHeight: 1.65, margin: 0,
                transition: "color 0.5s ease",
              }}>
                {reflection}
              </p>
            )}
          </div>

          {/* Mode buttons */}
          <div
            style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}
            onMouseLeave={supportsHover ? () => setHovered(null) : undefined}
          >
            {MODE_BUTTONS.map(btn => {
              const isHovered = hovered === btn.mode
              return (
                <button
                  key={btn.mode}
                  onClick={() => handleModeClick(btn.mode)}
                  onMouseEnter={supportsHover ? () => setHovered(btn.mode) : undefined}
                  style={{
                    padding: "12px 32px", borderRadius: 999,
                    border: btn.border,
                    background: isHovered ? btn.hoverBg : btn.bg,
                    color: btn.color,
                    fontSize: "0.88rem", fontWeight: 600, letterSpacing: "0.10em",
                    cursor: "pointer", transition: "background 0.2s",
                    display: "flex", alignItems: "center", gap: 8,
                    boxShadow: btn.glow,
                    animation: btn.pulse ? "pulse-gate 2.4s ease-in-out infinite" : undefined,
                  }}
                >
                  {btn.emoji} {btn.label}
                  {!supportsHover && isHovered && (
                    <span style={{ fontSize: "0.72rem", opacity: 0.75 }}>· tap again</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Skip link */}
          <button
            onClick={() => enter("party")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "0.72rem", color: preview.mutedColor,
              letterSpacing: "0.08em", marginTop: 2,
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
