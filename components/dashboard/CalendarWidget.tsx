"use client"

import { useEffect, useState } from "react"
import type { CalendarEvent } from "@/lib/types"
import type { ThemeConfig } from "./theme-config"
import { getCalendarCache, saveCalendarCache } from "@/lib/dashboard-prefs"

interface CalendarWidgetProps {
  theme: ThemeConfig
  onEventsLoaded?: (events: CalendarEvent[]) => void
}

export default function CalendarWidget({ theme, onEventsLoaded }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const cached = getCalendarCache()
    if (cached) {
      setEvents(cached.events)
      onEventsLoaded?.(cached.events)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    fetch("/api/calendar/today", { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const evts: CalendarEvent[] = data.events ?? []
        setEvents(evts)
        onEventsLoaded?.(evts)
        saveCalendarCache(evts)
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          console.error("[CalendarWidget]", err)
          setError(true)
        }
      })
      .finally(() => setLoading(false))
    return () => { clearTimeout(timer); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = new Date()
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" })
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: "20px",
      minHeight: "220px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ ...theme.labelStyle, marginBottom: "4px" }}>Today</div>
        <div style={{ fontFamily: theme.titleFont, fontSize: "1.5rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.1 }}>
          {dayName}
          <span style={{ color: theme.accentColor }}>,</span>
        </div>
        <div style={{ fontFamily: theme.titleFont, fontSize: "1rem", color: "#1A0A35", opacity: 0.7 }}>{dateStr}</div>
      </div>

      {/* Events list */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "200px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: "36px", borderRadius: "8px",
                background: "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.06) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
              }} />
            ))}
          </div>
        )}
        {!loading && error && (
          <p style={{ color: "#1A0A35", opacity: 0.4, fontSize: "0.85rem", fontStyle: "italic" }}>
            Couldn't load calendar
          </p>
        )}
        {!loading && !error && events.length === 0 && (
          <p style={{ color: "#1A0A35", opacity: 0.4, fontSize: "0.85rem", fontStyle: "italic" }}>
            No events today ✦ free day!
          </p>
        )}
        {!loading && events.map(event => (
          <div key={event.id} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "6px 0",
            borderBottom: "1px solid rgba(0,0,0,0.05)",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: event.colorDot,
              marginTop: "5px", flexShrink: 0,
              boxShadow: event.isNow ? `0 0 0 3px ${event.colorDot}40` : undefined,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "0.87rem",
                fontWeight: event.isNow ? 600 : 400,
                color: "#1A0A35",
                opacity: event.isNow ? 1 : 0.8,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {event.title}
                {event.isNow && <span style={{ color: theme.accentColor, marginLeft: "6px", fontSize: "0.7rem", fontWeight: 700 }}>NOW</span>}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#1A0A35", opacity: 0.5 }}>
                {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}
                {event.location && <span style={{ marginLeft: "6px" }}>📍 {event.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
