"use client"

import { useEffect, useState } from "react"
import { getStats, isWilted, checkAndUpdateStreak } from "@/lib/stats"
import type { PartyMode } from "@/lib/party-mode"

interface PlantHeaderProps {
  remaining: number
  total: number
  mode?: PartyMode
}

type Stage = 0 | 1 | 2 | 3 | 4 | 5

function getStage(remaining: number, total: number): Stage {
  if (total === 0) return 0
  const pct = (total - remaining) / total
  if (pct >= 1.0) return 5
  if (pct >= 0.75) return 4
  if (pct >= 0.5) return 3
  if (pct >= 0.25) return 2
  if (pct > 0) return 1
  return 0
}

const STAGE_LABELS: Record<PartyMode, string[]> = {
  party:      ["Seedling", "Sprout", "Growing", "Thriving", "Flourishing", "Blooming! 🎉"],
  zen:        ["Resting", "Awakening", "Unfolding", "Flourishing", "In bloom", "🪷 Lotus"],
  "wabi-sabi": ["Dormant", "Emerging", "Growing", "Present", "Complete", "Done."],
}

function ZenSVG({ stage, wilted }: { stage: Stage; wilted: boolean }) {
  const effectiveStage: Stage = wilted ? 0 : stage

  const gradients: Record<Stage, [string, string]> = {
    0: ["#1A1040", "#2D1B6E"],
    1: ["#2D1B6E", "#6B3FA0"],
    2: ["#4A2882", "#E8956A"],
    3: ["#7B5EA7", "#FFB347"],
    4: ["#FFB347", "#FFD700"],
    5: ["#FFF8E0", "#FFE566"],
  }
  const [gradTop, gradBottom] = gradients[effectiveStage]

  // Sun params per stage
  type SunParams = { cy: number; r: number; opacity?: number } | null
  const sunParams: Record<Stage, SunParams> = {
    0: null,
    1: { cy: 115, r: 10, opacity: 0.5 },
    2: { cy: 106, r: 14 },
    3: { cy: 88,  r: 18 },
    4: { cy: 68,  r: 20 },
    5: { cy: 50,  r: 22 },
  }
  const sun = sunParams[effectiveStage]

  // Ray outer-radius extension per stage
  const rayExtension: Record<Stage, number> = { 0: 0, 1: 0, 2: 10, 3: 13, 4: 16, 5: 20 }
  const rayExt = rayExtension[effectiveStage]

  const gradId = `zenSkyGrad-${effectiveStage}`
  const clipId = "zenSkyClip"

  return (
    <svg viewBox="0 0 100 140" className="w-full h-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradTop} />
          <stop offset="100%" stopColor={gradBottom} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="100" height="110" />
        </clipPath>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="100" height="110" fill={`url(#${gradId})`} />

      {/* Ground */}
      <rect x="0" y="110" width="100" height="30" fill="#4A7C59" />

      {/* Stars — stage 0 only */}
      {effectiveStage === 0 && (
        <g>
          <circle cx="15" cy="15" r="1" fill="#fff" opacity="0.8" />
          <circle cx="35" cy="8"  r="1" fill="#fff" opacity="0.8" />
          <circle cx="70" cy="20" r="1" fill="#fff" opacity="0.8" />
          <circle cx="85" cy="10" r="1" fill="#fff" opacity="0.8" />
          <circle cx="55" cy="30" r="1" fill="#fff" opacity="0.8" />
        </g>
      )}

      {/* Sun + rays — clipped to sky */}
      {sun && (
        <g clipPath={`url(#${clipId})`}>
          {/* Rays stages 2–5 */}
          {effectiveStage >= 2 && Array.from({ length: 8 }, (_, i) => {
            const angle = (i * 45 * Math.PI) / 180
            const innerR = sun.r + 4
            const outerR = sun.r + 4 + rayExt
            const x1 = 50 + innerR * Math.cos(angle)
            const y1 = sun.cy + innerR * Math.sin(angle)
            const x2 = 50 + outerR * Math.cos(angle)
            const y2 = sun.cy + outerR * Math.sin(angle)
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round"
              />
            )
          })}
          {/* Sun circle */}
          <circle cx="50" cy={sun.cy} r={sun.r} fill="#FFD700" opacity={sun.opacity ?? 1} />
        </g>
      )}

      {/* Lotus — stage 5 only */}
      {effectiveStage === 5 && (
        <text x="50" y="70" textAnchor="middle" fontSize="18">🪷</text>
      )}
    </svg>
  )
}

function PlantSVG({ stage, wilted, mode = "party" }: { stage: Stage; wilted: boolean; mode?: PartyMode }) {
  if (mode === "zen") return <ZenSVG stage={stage} wilted={wilted} />
  // Stem and leaf colors per mode (zen handled by early return above)
  const s = wilted
    ? "#78350f"
    : mode === "wabi-sabi" ? "#111111" : "#8B3FD8"
  const l1 = wilted
    ? "#a16207"
    : mode === "wabi-sabi" ? "#111111" : "#FF1F6E"
  const l2 = wilted
    ? "#92400e"
    : mode === "wabi-sabi" ? "rgba(17,17,17,0.45)" : "#AFA9EC"

  const pot = (
    <>
      <path d="M 28 112 L 33 135 L 67 135 L 72 112 Z" fill="#b45309" />
      <rect x="22" y="106" width="56" height="9" rx="3" fill="#d97706" />
      <ellipse cx="50" cy="106" rx="27" ry="5" fill="#7c5c3a" />
    </>
  )

  if (wilted) {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        {pot}
        <path
          d="M 50 105 C 50 88 58 78 52 62 C 46 46 34 50 28 58"
          stroke={s} strokeWidth="3" fill="none" strokeLinecap="round"
        />
        <path d="M 42 78 C 30 68 20 73 18 83" stroke={l2} strokeWidth="2" fill={l1} opacity="0.6" />
        <circle cx="27" cy="58" r="7" fill={l2} opacity="0.5" />
      </svg>
    )
  }

  if (stage === 0) {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        {pot}
        <line x1="50" y1="105" x2="50" y2="92" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="50" cy="89" rx="6" ry="7" fill={l1} />
      </svg>
    )
  }

  if (stage === 1) {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        {pot}
        <line x1="50" y1="105" x2="50" y2="74" stroke={s} strokeWidth="3" strokeLinecap="round" />
        <path d="M 50 90 C 37 80 27 85 26 94 C 36 91 47 91 50 90 Z" fill={l1} />
        <path d="M 50 84 C 63 74 73 79 74 88 C 64 85 53 85 50 84 Z" fill={l2} />
        <ellipse cx="50" cy="71" rx="7" ry="8" fill={l1} />
      </svg>
    )
  }

  if (stage === 2) {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        {pot}
        <line x1="50" y1="105" x2="50" y2="58" stroke={s} strokeWidth="3" strokeLinecap="round" />
        <path d="M 50 95 C 35 84 24 90 22 100 C 33 96 47 96 50 95 Z" fill={l1} />
        <path d="M 50 88 C 65 77 76 83 78 93 C 67 89 53 89 50 88 Z" fill={l2} />
        <path d="M 50 76 C 37 65 27 70 25 79 C 35 76 47 76 50 76 Z" fill={l2} />
        <path d="M 50 70 C 63 59 73 64 75 73 C 65 70 53 70 50 70 Z" fill={l1} />
        <ellipse cx="50" cy="54" rx="9" ry="10" fill={l1} />
      </svg>
    )
  }

  if (stage === 3) {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        {pot}
        <line x1="50" y1="105" x2="50" y2="42" stroke={s} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 50 97 C 33 85 21 92 19 103 C 31 98 46 98 50 97 Z" fill={l1} />
        <path d="M 50 90 C 67 78 79 85 81 96 C 69 91 54 91 50 90 Z" fill={l2} />
        <path d="M 50 76 C 35 64 24 70 22 80 C 33 76 46 77 50 76 Z" fill={l2} />
        <path d="M 50 70 C 65 58 76 64 78 74 C 67 70 54 70 50 70 Z" fill={l1} />
        <path d="M 50 58 C 37 47 28 52 26 60 C 35 57 46 58 50 58 Z" fill={l1} />
        <ellipse cx="50" cy="36" rx="16" ry="17" fill={l1} />
        <ellipse cx="36" cy="42" rx="11" ry="12" fill={l2} />
        <ellipse cx="64" cy="42" rx="11" ry="12" fill={l2} />
      </svg>
    )
  }

  if (stage === 4) {
    return (
      <svg viewBox="0 0 100 140" className="w-full h-full">
        {pot}
        <line x1="50" y1="105" x2="50" y2="28" stroke={s} strokeWidth="4" strokeLinecap="round" />
        <line x1="50" y1="58" x2="28" y2="44" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="50" x2="72" y2="36" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="50" cy="20" rx="22" ry="20" fill={l1} />
        <ellipse cx="28" cy="38" rx="16" ry="13" fill={l2} />
        <ellipse cx="72" cy="32" rx="16" ry="13" fill={l2} />
        <ellipse cx="38" cy="14" rx="14" ry="11" fill={l1} opacity="0.85" />
        <ellipse cx="62" cy="12" rx="14" ry="11" fill={l1} opacity="0.85" />
      </svg>
    )
  }

  // Flower dot colors for stage 5 (the blooming flowers) per mode (zen handled by early return)
  const flowerColors =
    mode === "wabi-sabi" ? ["#1A0A35", "rgba(26,10,53,0.65)", "rgba(26,10,53,0.40)", "#1A0A35"]
    :                      ["#FFD000", "#FF6B1A", "#FF1F6E", "#FFD000"]
  const flowerDots = [
    { cx: 50, cy: 3,  r: 5   },
    { cx: 34, cy: 18, r: 3.5 },
    { cx: 66, cy: 16, r: 3.5 },
    { cx: 24, cy: 30, r: 3   },
  ]

  return (
    <svg viewBox="0 0 100 140" className="w-full h-full">
      {pot}
      <line x1="50" y1="105" x2="50" y2="26" stroke={s} strokeWidth="4.5" strokeLinecap="round" />
      <line x1="50" y1="54" x2="26" y2="40" stroke={s} strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="46" x2="74" y2="32" stroke={s} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="17" rx="24" ry="22" fill={l1} />
      <ellipse cx="26" cy="35" rx="18" ry="15" fill={l2} />
      <ellipse cx="74" cy="29" rx="18" ry="15" fill={l2} />
      <ellipse cx="36" cy="10" rx="15" ry="12" fill={l1} opacity="0.9" />
      <ellipse cx="64" cy="8" rx="15" ry="12" fill={l1} opacity="0.9" />
      {flowerDots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={flowerColors[i]} />
      ))}
    </svg>
  )
}

export default function PlantHeader({ remaining, total, mode = "party" }: PlantHeaderProps) {
  const [xp, setXp] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wilted, setWilted] = useState(false)

  useEffect(() => {
    checkAndUpdateStreak()
    const s = getStats()
    setXp(s.xp)
    setStreak(s.currentStreak)
    setWilted(isWilted())

    function onUpdate() {
      const s = getStats()
      setXp(s.xp)
      setStreak(s.currentStreak)
      setWilted(isWilted())
    }
    window.addEventListener("inbox-stats-updated", onUpdate)
    return () => window.removeEventListener("inbox-stats-updated", onUpdate)
  }, [])

  const stage = getStage(remaining, total)
  const hasLoaded = total > 0
  const pct = hasLoaded ? Math.round(((total - remaining) / total) * 100) : 0
  const wiltedLabel = mode === "zen" ? "Resting…" : mode === "wabi-sabi" ? "Dormant." : "Wilting…"
  const label = wilted ? wiltedLabel : STAGE_LABELS[mode][stage]
  const accentColor = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#111111" : "#8B3FD8"
  const barColor = mode === "zen"
    ? "linear-gradient(90deg,#C8960C,#B07B0A)"
    : mode === "wabi-sabi"
      ? "linear-gradient(90deg,#111,rgba(17,17,17,0.45))"
      : "linear-gradient(90deg,#FF1F6E,#8B3FD8)"

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-20">
        <PlantSVG stage={stage} wilted={wilted} mode={mode} />
      </div>
      <p className="text-xs font-semibold leading-none" style={{ color: accentColor }}>{label}</p>
      {hasLoaded && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(26,10,53,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <span className="text-xs" style={{ color: "rgba(26,10,53,0.40)" }}>{pct}%</span>
        </div>
      )}
      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "rgba(26,10,53,0.40)" }}>
        <span className="font-semibold" style={{ color: accentColor }}>{xp} Karma</span>
        {streak >= 1 && (
          <>
            <span style={{ color: "rgba(26,10,53,0.20)" }}>·</span>
            <span>🔥 {streak}</span>
          </>
        )}
      </div>
    </div>
  )
}
