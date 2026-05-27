"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ThemeConfig } from "./theme-config"

type Phase = "idle" | "inhale" | "hold" | "exhale"

const DURATIONS: Record<Exclude<Phase, "idle">, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
}
const TOTAL_ROUNDS = 4
const CIRC = 2 * Math.PI * 45 // ≈ 283

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready",
  inhale: "Breathe in…",
  hold: "Hold…",
  exhale: "Let go…",
}

function playChime(hz: number, duration = 0.35) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.value = hz
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
    osc.onended = () => ctx.close()
  } catch {
    // Web Audio not available (SSR or blocked) — silent fallback
  }
}

interface BreathworkWidgetProps {
  theme: ThemeConfig
}

export default function BreathworkWidget({ theme }: BreathworkWidgetProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0) // 0–1 within current phase
  const [round, setRound] = useState(0)
  const [elapsed, setElapsed] = useState(0) // seconds total
  const [done, setDone] = useState(false)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>("idle")
  const phaseElapsedRef = useRef(0) // ms within current phase
  const roundRef = useRef(0)
  const totalElapsedRef = useRef(0)
  const lastTickRef = useRef<number | null>(null)

  const stopTimer = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    lastTickRef.current = null
  }, [])

  const advancePhase = useCallback(() => {
    const cur = phaseRef.current
    let next: Phase
    if (cur === "inhale") {
      next = "hold"
      playChime(396)
    } else if (cur === "hold") {
      next = "exhale"
      playChime(528)
    } else {
      // exhale -> inhale (or done)
      const nextRound = roundRef.current + 1
      if (nextRound >= TOTAL_ROUNDS) {
        stopTimer()
        setDone(true)
        setPhase("idle")
        phaseRef.current = "idle"
        setProgress(0)
        return
      }
      roundRef.current = nextRound
      setRound(nextRound)
      next = "inhale"
      playChime(528)
    }
    phaseRef.current = next
    phaseElapsedRef.current = 0
    setPhase(next)
    setProgress(0)
  }, [stopTimer])

  const tick = useCallback(() => {
    const now = Date.now()
    const dt = lastTickRef.current ? now - lastTickRef.current : 50
    lastTickRef.current = now

    const curPhase = phaseRef.current
    if (curPhase === "idle") return

    const dur = DURATIONS[curPhase as Exclude<Phase, "idle">] * 1000
    phaseElapsedRef.current += dt
    totalElapsedRef.current += dt

    const p = Math.min(phaseElapsedRef.current / dur, 1)
    setProgress(p)
    setElapsed(Math.floor(totalElapsedRef.current / 1000))

    if (phaseElapsedRef.current >= dur) {
      advancePhase()
    }
  }, [advancePhase])

  const start = useCallback(() => {
    if (done) {
      // reset
      phaseRef.current = "idle"
      phaseElapsedRef.current = 0
      roundRef.current = 0
      totalElapsedRef.current = 0
      lastTickRef.current = null
      setDone(false)
      setRound(0)
      setElapsed(0)
      setProgress(0)
      setPhase("idle")
    }
    playChime(528)
    phaseRef.current = "inhale"
    phaseElapsedRef.current = 0
    setPhase("inhale")
    lastTickRef.current = Date.now()
    tickRef.current = setInterval(tick, 50)
  }, [done, tick])

  const pause = useCallback(() => {
    stopTimer()
    setPhase("idle")
    phaseRef.current = "idle"
  }, [stopTimer])

  const reset = useCallback(() => {
    stopTimer()
    phaseRef.current = "idle"
    phaseElapsedRef.current = 0
    roundRef.current = 0
    totalElapsedRef.current = 0
    setPhase("idle")
    setProgress(0)
    setRound(0)
    setElapsed(0)
    setDone(false)
  }, [stopTimer])

  useEffect(() => () => stopTimer(), [stopTimer])

  // SVG ring values
  const active = phase !== "idle"
  const isInhale = phase === "inhale"
  const isHold = phase === "hold"

  // Fill: inhale fills in, hold stays full, exhale drains
  let ringFill = 0
  if (isInhale) ringFill = progress
  else if (isHold) ringFill = 1
  else if (phase === "exhale") ringFill = 1 - progress

  const strokeOffset = CIRC - ringFill * CIRC
  const ringColor = theme.accentColor

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
    }}>
      <div style={theme.labelStyle}>4 · 7 · 8 Breath</div>

      {/* SVG ring */}
      <div style={{ position: "relative", width: "110px", height: "110px" }}>
        <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx="55" cy="55" r="45"
            fill="none"
            stroke={`${ringColor}22`}
            strokeWidth="7"
          />
          {/* Fill */}
          <circle
            cx="55" cy="55" r="45"
            fill="none"
            stroke={ringColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={strokeOffset}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        {/* Center label */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          fontFamily: theme.titleFont,
        }}>
          {done ? (
            <div style={{ fontSize: "1.5rem" }}>✓</div>
          ) : (
            <>
              <div style={{ fontSize: "0.72rem", color: "#1A0A35", opacity: 0.6, whiteSpace: "nowrap" }}>
                {active ? PHASE_LABELS[phase] : "Ready"}
              </div>
              {active && (
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: ringColor }}>
                  {Math.ceil(
                    (DURATIONS[phase as Exclude<Phase, "idle">] * 1000 - phaseElapsedRef.current) / 1000
                  )}s
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Round counter */}
      <div style={{ display: "flex", gap: "5px" }}>
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div key={i} style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: i < round || done ? ringColor : `${ringColor}30`,
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      {/* Phase labels */}
      <div style={{ fontSize: "0.72rem", color: "#1A0A35", opacity: 0.5, letterSpacing: "0.06em" }}>
        {done ? "Session complete 🌸" : `4 in · 7 hold · 8 out`}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        {!active && !done && (
          <button onClick={start} style={btnStyle(ringColor)}>
            ▶ Start
          </button>
        )}
        {active && (
          <button onClick={pause} style={btnStyle(ringColor, true)}>
            ⏸ Pause
          </button>
        )}
        {done && (
          <button onClick={start} style={btnStyle(ringColor)}>
            ↺ Again
          </button>
        )}
        {(round > 0 || active) && (
          <button onClick={reset} style={ghostBtnStyle}>
            Reset
          </button>
        )}
      </div>

      {elapsed > 0 && (
        <div style={{ fontSize: "0.7rem", color: "#1A0A35", opacity: 0.4 }}>
          {elapsed}s elapsed
        </div>
      )}
    </div>
  )
}

function btnStyle(color: string, outline = false): React.CSSProperties {
  return {
    background: outline ? "transparent" : color,
    color: outline ? color : "#FFFFFF",
    border: `1.5px solid ${color}`,
    borderRadius: "20px",
    padding: "5px 14px",
    fontSize: "0.78rem",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600,
    letterSpacing: "0.04em",
  }
}

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#1A0A35",
  border: "1.5px solid rgba(0,0,0,0.15)",
  borderRadius: "20px",
  padding: "5px 14px",
  fontSize: "0.78rem",
  cursor: "pointer",
  fontFamily: "inherit",
  opacity: 0.6,
}
