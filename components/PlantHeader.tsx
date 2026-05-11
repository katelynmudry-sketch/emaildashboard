"use client"

import { useEffect, useState } from "react"
import { getStats, isWilted, checkAndUpdateStreak } from "@/lib/stats"

interface PlantHeaderProps {
  remaining: number
  total: number
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

const STAGE_LABELS = ["Seedling", "Sprout", "Growing", "Thriving", "Flourishing", "Blooming!"]

function PlantSVG({ stage, wilted }: { stage: Stage; wilted: boolean }) {
  const s = wilted ? "#78350f" : "#16a34a"
  const l1 = wilted ? "#a16207" : "#22c55e"
  const l2 = wilted ? "#92400e" : "#15803d"

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
      <circle cx="50" cy="3" r="5" fill="#fbbf24" />
      <circle cx="34" cy="18" r="3.5" fill="#fb923c" />
      <circle cx="66" cy="16" r="3.5" fill="#f472b6" />
      <circle cx="24" cy="30" r="3" fill="#fbbf24" />
    </svg>
  )
}

export default function PlantHeader({ remaining, total }: PlantHeaderProps) {
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
  const label = wilted ? "Wilting…" : STAGE_LABELS[stage]

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-20">
        <PlantSVG stage={stage} wilted={wilted} />
      </div>
      <p className="text-xs font-semibold text-zinc-700 leading-none">{label}</p>
      {hasLoaded && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400">{pct}%</span>
        </div>
      )}
      <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
        <span className="font-semibold text-violet-500">{xp} XP</span>
        {streak >= 1 && (
          <>
            <span className="text-zinc-300">·</span>
            <span>🔥 {streak}</span>
          </>
        )}
      </div>
    </div>
  )
}
