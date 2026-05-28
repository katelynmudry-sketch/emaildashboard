"use client"

import type { DashboardTheme } from "@/lib/types"
import { THEMES, type ThemeConfig } from "./theme-config"
import { setDashboardTheme } from "@/lib/dashboard-prefs"

interface ThemeSelectorProps {
  current: DashboardTheme
  onChange: (theme: DashboardTheme) => void
  isFestival?: boolean
}

export default function ThemeSelector({ current, onChange, isFestival }: ThemeSelectorProps) {
  function handleChange(id: DashboardTheme) {
    setDashboardTheme(id)
    onChange(id)
  }

  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      {(Object.values(THEMES) as ThemeConfig[]).map(t => {
        const isActive = current === t.id
        return (
          <button
            key={t.id}
            onClick={() => handleChange(t.id)}
            title={`${t.name} — ${t.description}`}
            style={{
              background: isActive
                ? (isFestival ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.85)")
                : "transparent",
              border: isActive
                ? `1.5px solid ${isFestival ? "rgba(255,255,255,0.5)" : t.accentColor}`
                : `1.5px solid ${isFestival ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.10)"}`,
              borderRadius: "20px",
              padding: "3px 11px",
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              color: isFestival ? "#FFFFFF" : "#1A0A35",
              fontFamily: "inherit",
              fontWeight: isActive ? 600 : 400,
              transition: "all 0.18s ease",
              boxShadow: isActive && !isFestival ? `0 0 0 3px ${t.accentColor}18` : "none",
              opacity: isActive ? 1 : (isFestival ? 0.6 : 0.5),
            }}
          >
            <span role="img" aria-label={t.name}>{t.emoji}</span>
          </button>
        )
      })}
    </div>
  )
}
