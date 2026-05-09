"use client"

import { useEffect, useState } from "react"
import { getStats, getPlantStage, isWilted, checkAndUpdateStreak } from "@/lib/stats"

interface DisplayStats {
  emoji: string
  xp: number
  streak: number
}

function readDisplayStats(): DisplayStats {
  const plant = getPlantStage()
  const stats = getStats()
  return {
    emoji: isWilted() ? "🥀" : plant.emoji,
    xp: stats.xp,
    streak: stats.currentStreak,
  }
}

export default function PlantHeader() {
  const [display, setDisplay] = useState<DisplayStats>(readDisplayStats)

  useEffect(() => {
    checkAndUpdateStreak()
    setDisplay(readDisplayStats())

    function handleUpdate() {
      setDisplay(readDisplayStats())
    }

    window.addEventListener("inbox-stats-updated", handleUpdate)
    return () => window.removeEventListener("inbox-stats-updated", handleUpdate)
  }, [])

  return (
    <div className="flex items-center gap-1.5 bg-zinc-100 text-zinc-600 text-sm px-3 py-1.5 rounded-full select-none">
      <span>{display.emoji}</span>
      <span className="font-medium text-zinc-700">{display.xp} XP</span>
      {display.streak >= 1 && (
        <>
          <span className="text-zinc-300">·</span>
          <span>🔥 {display.streak}</span>
        </>
      )}
    </div>
  )
}
