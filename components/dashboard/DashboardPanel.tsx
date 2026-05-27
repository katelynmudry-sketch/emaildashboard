"use client"

import { useEffect, useRef, useState } from "react"
import type { Email, DashboardTheme, CalendarEvent } from "@/lib/types"
import { getDashboardPrefs, setDashboardOpen } from "@/lib/dashboard-prefs"
import { THEMES } from "./theme-config"
import CalendarWidget from "./CalendarWidget"
import DharmaWidget from "./DharmaWidget"
import ManifestationWidget from "./ManifestationWidget"
import BreathworkWidget from "./BreathworkWidget"
import InsightWidget from "./InsightWidget"
import ThemeSelector from "./ThemeSelector"

interface DashboardPanelProps {
  emails: Email[]
}

export default function DashboardPanel({ emails }: DashboardPanelProps) {
  const [open, setOpen] = useState(true)
  const [theme, setTheme] = useState<DashboardTheme>("morning-altar")
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const fontLinkRef = useRef<HTMLLinkElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const prefs = getDashboardPrefs()
    setTheme(prefs.theme)
    setOpen(prefs.dashboardOpen)
    setMounted(true)
  }, [])

  // Inject Google Font for the current theme
  useEffect(() => {
    if (!mounted) return
    const config = THEMES[theme]
    if (!config.fontImport) return

    if (fontLinkRef.current) {
      fontLinkRef.current.remove()
    }
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = config.fontImport
    document.head.appendChild(link)
    fontLinkRef.current = link
    return () => { link.remove() }
  }, [theme, mounted])

  function handleToggle() {
    const next = !open
    setOpen(next)
    setDashboardOpen(next)
  }

  function handleThemeChange(t: DashboardTheme) {
    setTheme(t)
  }

  const tc = THEMES[theme]

  // Don't render until client prefs are loaded (avoids SSR mismatch)
  if (!mounted) return null

  return (
    <div style={{ width: "100%", borderBottom: "1px solid rgba(26,10,53,0.08)" }}>
      {/* Toggle bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: "rgba(238,228,255,0.6)",
        backdropFilter: "blur(4px)",
        borderBottom: open ? "1px solid rgba(26,10,53,0.06)" : "none",
        cursor: "pointer",
      }}>
        <button
          onClick={handleToggle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#1A0A35",
            fontFamily: "var(--font-body, DM Sans, sans-serif)",
            fontSize: "0.82rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            padding: 0,
          }}
        >
          <span style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
            fontSize: "0.7rem",
            opacity: 0.5,
          }}>▼</span>
          ✨ Morning Dashboard
        </button>
        <ThemeSelector current={theme} onChange={handleThemeChange} />
      </div>

      {/* Collapsible panel */}
      <div style={{
        overflow: "hidden",
        maxHeight: open ? "1400px" : "0",
        transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div style={{
          padding: "20px",
          background: tc.panelBg,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          {/* Top row — 3 equal columns */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "16px",
          }}>
            <CalendarWidget theme={tc} onEventsLoaded={setCalendarEvents} />
            <DharmaWidget theme={tc} />
            <ManifestationWidget theme={tc} />
          </div>

          {/* Bottom row — breathwork (narrow) + insight charts (wide) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            gap: "16px",
          }}>
            <BreathworkWidget theme={tc} />
            <InsightWidget emails={emails} calendarEvents={calendarEvents} theme={tc} />
          </div>
        </div>
      </div>
    </div>
  )
}
