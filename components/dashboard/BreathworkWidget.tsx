"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
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
    // silent fallback
  }
}

interface BreathworkWidgetProps {
  theme: ThemeConfig
}

export default function BreathworkWidget({ theme }: BreathworkWidgetProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [round, setRound] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>("idle")
  const phaseElapsedRef = useRef(0)
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
      next = "hold"; playChime(396)
    } else if (cur === "hold") {
      next = "exhale"; playChime(528)
    } else {
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
      next = "inhale"; playChime(528)
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
    setProgress(Math.min(phaseElapsedRef.current / dur, 1))
    setElapsed(Math.floor(totalElapsedRef.current / 1000))
    if (phaseElapsedRef.current >= dur) advancePhase()
  }, [advancePhase])

  const start = useCallback(() => {
    if (done) {
      phaseRef.current = "idle"
      phaseElapsedRef.current = 0
      roundRef.current = 0
      totalElapsedRef.current = 0
      lastTickRef.current = null
      setDone(false); setRound(0); setElapsed(0); setProgress(0); setPhase("idle")
    }
    playChime(528)
    phaseRef.current = "inhale"
    phaseElapsedRef.current = 0
    setPhase("inhale")
    lastTickRef.current = Date.now()
    tickRef.current = setInterval(tick, 50)
  }, [done, tick])

  const pause = useCallback(() => {
    stopTimer(); setPhase("idle"); phaseRef.current = "idle"
  }, [stopTimer])

  const reset = useCallback(() => {
    stopTimer()
    phaseRef.current = "idle"; phaseElapsedRef.current = 0
    roundRef.current = 0; totalElapsedRef.current = 0
    setPhase("idle"); setProgress(0); setRound(0); setElapsed(0); setDone(false)
  }, [stopTimer])

  useEffect(() => () => stopTimer(), [stopTimer])

  const active = phase !== "idle"
  const ringFill = phase === "inhale" ? progress
    : phase === "hold" ? 1
    : phase === "exhale" ? 1 - progress
    : 0
  const strokeOffset = CIRC - ringFill * CIRC
  const ringColor = theme.accentColor
  const isAltar = theme.id === "morning-altar"
  const isFestival = theme.id === "festival-stage"
  const isWabi = theme.id === "wabi-sabi-studio"

  // Phase label style per theme
  const phaseLabelStyle: CSSProperties = {
    fontSize: isWabi ? "0.62rem" : "0.68rem",
    fontFamily: theme.bodyFont,
    color: "#1A0A35",
    opacity: 0.55,
    letterSpacing: isWabi ? "0.14em" : undefined,
    textTransform: isWabi ? "uppercase" : undefined,
    whiteSpace: "nowrap",
  }

  const strokeWidth = isFestival ? 9 : isWabi ? 5 : 7

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: theme.cardPadding,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
    }}>
      <div style={{ ...theme.labelStyle }}>
        {isFestival ? "4 · 7 · 8 BREATH" : "4 · 7 · 8 Breath"}
      </div>

      {/* SVG ring */}
      <div style={{ position: "relative", width: "110px", height: "110px" }}>
        <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="55" cy="55" r="45" fill="none"
            stroke={`${ringColor}20`} strokeWidth={strokeWidth} />
          <circle cx="55" cy="55" r="45" fill="none"
            stroke={ringColor} strokeWidth={strokeWidth}
            strokeLinecap={isFestival ? "square" : "round"}
            strokeDasharray={CIRC}
            strokeDashoffset={strokeOffset}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        {/* Center text */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}>
          {done ? (
            <div style={{
              fontSize: isAltar ? "1.6rem" : "1.4rem",
              color: ringColor,
              fontFamily: theme.titleFont,
            }}>✓</div>
          ) : (
            <>
              <div style={phaseLabelStyle}>
                {active ? PHASE_LABELS[phase] : "Ready"}
              </div>
              {active && (
                <div style={{
                  fontFamily: theme.titleFont,
                  fontSize: isFestival ? "1.4rem" : isAltar ? "1.2rem" : "1rem",
                  fontWeight: isFestival ? 400 : isWabi ? 700 : 300,
                  color: ringColor,
                  lineHeight: 1.1,
                  marginTop: "1px",
                }}>
                  {Math.ceil((DURATIONS[phase as Exclude<Phase, "idle">] * 1000 - phaseElapsedRef.current) / 1000)}s
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Round dots */}
      <div style={{ display: "flex", gap: "5px" }}>
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div key={i} style={{
            width: isFestival ? "10px" : "8px",
            height: isFestival ? "10px" : "8px",
            borderRadius: isFestival ? "2px" : "50%",
            background: i < round || done ? ringColor : `${ringColor}28`,
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      <div style={{
        fontSize: "0.7rem",
        fontFamily: theme.bodyFont,
        color: "#1A0A35",
        opacity: 0.42,
        letterSpacing: isWabi ? "0.12em" : "0.05em",
        textTransform: isWabi ? "uppercase" : undefined,
      }}>
        {done ? (isFestival ? "SESSION COMPLETE 🌸" : "Session complete 🌸") : (isFestival ? "4 IN · 7 HOLD · 8 OUT" : "4 in · 7 hold · 8 out")}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "7px", marginTop: "2px" }}>
        {!active && !done && (
          <button onClick={start} style={primaryBtn(ringColor, isFestival, isAltar, theme.bodyFont)}>
            {isFestival ? "▶ START" : "▶ Start"}
          </button>
        )}
        {active && (
          <button onClick={pause} style={outlineBtn(ringColor, isFestival, theme.bodyFont)}>
            {isFestival ? "⏸ PAUSE" : "⏸ Pause"}
          </button>
        )}
        {done && (
          <button onClick={start} style={primaryBtn(ringColor, isFestival, isAltar, theme.bodyFont)}>
            {isFestival ? "↺ AGAIN" : "↺ Again"}
          </button>
        )}
        {(round > 0 || active) && (
          <button onClick={reset} style={ghostBtn(theme.bodyFont)}>
            {isFestival ? "RESET" : "Reset"}
          </button>
        )}
      </div>

      {elapsed > 0 && (
        <div style={{
          fontSize: "0.68rem",
          fontFamily: theme.bodyFont,
          color: "#1A0A35",
          opacity: 0.35,
          letterSpacing: isWabi ? "0.1em" : undefined,
        }}>
          {elapsed}s elapsed
        </div>
      )}
    </div>
  )
}

function primaryBtn(color: string, isFestival: boolean, isAltar: boolean, font: string): CSSProperties {
  return {
    background: color,
    color: "#FFFFFF",
    border: `2px solid ${color}`,
    borderRadius: isFestival ? "4px" : "20px",
    padding: isFestival ? "5px 16px" : "5px 14px",
    fontSize: isFestival ? "0.78rem" : "0.76rem",
    cursor: "pointer",
    fontFamily: isFestival ? "'Bebas Neue', sans-serif" : font,
    fontWeight: isFestival ? 400 : 600,
    letterSpacing: isFestival ? "0.1em" : "0.04em",
    boxShadow: isFestival ? "3px 3px 0 rgba(0,0,0,0.6)" : undefined,
  }
}

function outlineBtn(color: string, isFestival: boolean, font: string): CSSProperties {
  return {
    background: "transparent",
    color: color,
    border: `${isFestival ? "2px" : "1.5px"} solid ${color}`,
    borderRadius: isFestival ? "4px" : "20px",
    padding: isFestival ? "5px 16px" : "5px 14px",
    fontSize: isFestival ? "0.78rem" : "0.76rem",
    cursor: "pointer",
    fontFamily: isFestival ? "'Bebas Neue', sans-serif" : font,
    fontWeight: isFestival ? 400 : 600,
    letterSpacing: isFestival ? "0.1em" : "0.04em",
  }
}

function ghostBtn(font: string): CSSProperties {
  return {
    background: "transparent",
    color: "#1A0A35",
    border: "1.5px solid rgba(0,0,0,0.12)",
    borderRadius: "20px",
    padding: "5px 14px",
    fontSize: "0.76rem",
    cursor: "pointer",
    fontFamily: font,
    opacity: 0.55,
  }
}
