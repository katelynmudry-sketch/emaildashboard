"use client"

import { useEffect, useState } from "react"
import type { AccountId, CalendarEvent } from "@/lib/types"
import type { ThemeConfig } from "./theme-config"
import { getCalendarCache, saveCalendarCache } from "@/lib/dashboard-prefs"

interface CalendarWidgetProps {
  theme: ThemeConfig
  account: AccountId
  onEventsLoaded?: (events: CalendarEvent[]) => void
}

export default function CalendarWidget({ theme, account, onEventsLoaded }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const cached = getCalendarCache(account)
    if (cached) {
      setEvents(cached.events)
      onEventsLoaded?.(cached.events)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    fetch(`/api/calendar/today?account=${account}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const evts: CalendarEvent[] = data.events ?? []
        setEvents(evts)
        onEventsLoaded?.(evts)
        saveCalendarCache(account, evts)
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
  }, [account])

  const today = new Date()
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" })
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  const isFestival = theme.id === "festival-stage"
  const isAltar = theme.id === "morning-altar"

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: theme.cardPadding,
      minHeight: "220px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        marginBottom: "14px",
        paddingBottom: "12px",
        borderBottom: theme.sectionDivider,
      }}>
        <div style={{ ...theme.labelStyle, marginBottom: "6px" }}>Today</div>
        <div style={{
          fontFamily: theme.titleFont,
          fontSize: theme.dayNameSize,
          fontWeight: isFestival ? 400 : isAltar ? 300 : 700,
          fontStyle: isAltar ? "italic" : "normal",
          color: "#1A0A35",
          lineHeight: 1.05,
          letterSpacing: isFestival ? "0.04em" : undefined,
        }}>
          {isFestival ? dayName.toUpperCase() : dayName}
          <span style={{ color: theme.accentColor }}>{isFestival ? " ▸" : ","}</span>
        </div>
        <div style={{
          fontFamily: theme.bodyFont,
          fontSize: isFestival ? "0.82rem" : "0.9rem",
          fontStyle: isAltar ? "italic" : "normal",
          color: "#1A0A35",
          opacity: 0.55,
          marginTop: "2px",
          letterSpacing: isFestival ? "0.08em" : undefined,
          textTransform: isFestival ? "uppercase" : undefined,
        }}>{dateStr}</div>
      </div>

      {/* Events list */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "200px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: "34px", borderRadius: theme.cardRadius,
                background: "linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.025) 50%, rgba(0,0,0,0.05) 75%)",
                backgroundSize: "200% 100%",
                animation: "db-shimmer 1.4s infinite",
              }} />
            ))}
          </div>
        )}
        {!loading && error && (
          <p style={{ color: "#1A0A35", opacity: 0.35, fontSize: "0.83rem", fontStyle: "italic", margin: 0 }}>
            Couldn't load calendar — sign out &amp; back in to reconnect
          </p>
        )}
        {!loading && !error && events.length === 0 && (
          <p style={{
            color: "#1A0A35", opacity: 0.38,
            fontSize: isAltar ? "1rem" : "0.83rem",
            fontStyle: isAltar ? "italic" : "normal",
            fontFamily: theme.bodyFont,
            margin: 0,
          }}>
            {isAltar ? "✦ A clear day opens before you" : "No events — free day!"}
          </p>
        )}
        {!loading && events.map((event, idx) => (
          <div key={event.id} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "7px 0",
            borderBottom: idx < events.length - 1 ? theme.sectionDivider : "none",
          }}>
            {/* Color dot */}
            <div style={{
              width: isFestival ? "10px" : "8px",
              height: isFestival ? "10px" : "8px",
              borderRadius: isFestival ? "3px" : "50%",
              background: event.colorDot,
              marginTop: "4px", flexShrink: 0,
              boxShadow: event.isNow ? `0 0 0 3px ${event.colorDot}35` : undefined,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: theme.bodyFont,
                fontSize: isFestival ? "0.88rem" : "0.85rem",
                fontWeight: event.isNow ? 600 : 400,
                color: "#1A0A35",
                opacity: event.isNow ? 1 : 0.82,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {event.title}
                {event.isNow && (
                  <span style={{
                    background: theme.accentColor,
                    color: "#FFFFFF",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "4px",
                    marginLeft: "7px",
                    letterSpacing: "0.08em",
                  }}>NOW</span>
                )}
              </div>
              <div style={{
                fontFamily: theme.bodyFont,
                fontSize: "0.73rem",
                color: "#1A0A35",
                opacity: 0.45,
                marginTop: "1px",
              }}>
                {event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}
                {event.location && <span style={{ marginLeft: "6px", opacity: 0.7 }}>📍 {event.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes db-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
