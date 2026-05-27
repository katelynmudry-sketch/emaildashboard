"use client"

import type { DashboardTheme } from "@/lib/types"
import { THEMES, type ThemeConfig } from "./theme-config"
import { setDashboardTheme } from "@/lib/dashboard-prefs"

interface ThemeSelectorProps {
  current: DashboardTheme
  onChange: (theme: DashboardTheme) => void
}

export default function ThemeSelector({ current, onChange }: ThemeSelectorProps) {
  function handleChange(id: DashboardTheme) {
    setDashboardTheme(id)
    onChange(id)
  }

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {(Object.values(THEMES) as ThemeConfig[]).map(t => (
        <button
          key={t.id}
          onClick={() => handleChange(t.id)}
          title={`${t.name} — ${t.description}`}
          style={{
            background: current === t.id ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
            border: current === t.id ? `1.5px solid ${t.accentColor}` : "1.5px solid rgba(255,255,255,0.4)",
            borderRadius: "20px",
            padding: "3px 10px",
            fontSize: "0.72rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "#1A0A35",
            fontFamily: "inherit",
            fontWeight: current === t.id ? 600 : 400,
            transition: "all 0.2s ease",
            boxShadow: current === t.id ? `0 0 0 2px ${t.accentColor}25` : "none",
          }}
        >
          <span>{t.emoji}</span>
          <span style={{ display: "none" }}>{t.name}</span>
        </button>
      ))}
    </div>
  )
}
