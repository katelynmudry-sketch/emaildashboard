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
    if (fontLinkRef.current) fontLinkRef.current.remove()
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

  if (!mounted) return null

  const tc = THEMES[theme]
  const isFestival = theme === "festival-stage"

  return (
    <>
      <style>{`
        .db-grid-top {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        .db-grid-bottom {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .db-grid-top {
            grid-template-columns: 1fr;
          }
          .db-grid-bottom {
            grid-template-columns: 1fr;
          }
        }
        @media (min-width: 901px) and (max-width: 1200px) {
          .db-grid-top {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div style={{ width: "100%", borderBottom: "1px solid rgba(26,10,53,0.08)" }}>

        {/* ── Toggle bar — fully themed ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isFestival ? "8px 20px" : "10px 20px",
          background: tc.toggleBarBg,
          borderBottom: tc.toggleBarBorderBottom,
          // Festival gets a hot-pink top accent line
          borderTop: isFestival ? "3px solid #FF1F6E" : undefined,
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
              color: tc.toggleBarTextColor,
              fontFamily: isFestival
                ? "'Bebas Neue', sans-serif"
                : "var(--font-body, DM Sans, sans-serif)",
              fontSize: isFestival ? "1.15rem" : "0.82rem",
              fontWeight: isFestival ? 400 : 600,
              letterSpacing: isFestival ? "0.12em" : "0.06em",
              padding: 0,
            }}
          >
            <span style={{
              display: "inline-block",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.25s ease",
              fontSize: isFestival ? "0.8rem" : "0.7rem",
              opacity: isFestival ? 1 : 0.5,
              color: isFestival ? "#FF1F6E" : undefined,
            }}>▼</span>
            {isFestival ? "MORNING DASHBOARD" : "✨ Morning Dashboard"}
          </button>
          <ThemeSelector current={theme} onChange={handleThemeChange} isFestival={isFestival} />
        </div>

        {/* ── Collapsible panel ── */}
        <div style={{
          overflow: "hidden",
          maxHeight: open ? "1600px" : "0",
          transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          <div style={{
            padding: `${tc.panelPaddingTop} 20px 20px`,
            paddingTop: `calc(${tc.panelPaddingTop} + 20px)`,
            background: tc.panelBg,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}>
            {/* Top row — Calendar | Dharma | Manifestation */}
            <div className="db-grid-top">
              <CalendarWidget theme={tc} onEventsLoaded={setCalendarEvents} />
              <DharmaWidget theme={tc} />
              <ManifestationWidget theme={tc} />
            </div>

            {/* Bottom row — Breathwork | Insight charts */}
            <div className="db-grid-bottom">
              <BreathworkWidget theme={tc} />
              <InsightWidget emails={emails} calendarEvents={calendarEvents} theme={tc} />
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
