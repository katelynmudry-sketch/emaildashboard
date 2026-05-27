"use client"

import type { Email, CalendarEvent } from "@/lib/types"
import type { ThemeConfig } from "./theme-config"

const FIESTA_COLORS = ["#FF1F6E", "#FFD000", "#FF6B1A", "#00C4A7", "#8FC900", "#8B3FD8"]

// Calendar event type buckets (keyword heuristic)
function bucketEvent(title: string): string {
  const t = title.toLowerCase()
  if (/call|meet|zoom|sync|standup|huddle|debrief|check.?in/.test(t)) return "Calls"
  if (/class|workshop|training|course|lesson|session/.test(t)) return "Learning"
  if (/gym|yoga|walk|run|hike|swim|workout|pilates|stretch/.test(t)) return "Movement"
  if (/creative|studio|design|write|draw|paint|record|create/.test(t)) return "Creative"
  if (/dinner|lunch|coffee|brunch|breakfast|drinks/.test(t)) return "Social"
  if (/drive|pickup|drop|commute|travel/.test(t)) return "Transit"
  return "Personal"
}

interface InsightWidgetProps {
  emails: Email[]
  calendarEvents: CalendarEvent[]
  theme: ThemeConfig
}

export default function InsightWidget({ emails, calendarEvents, theme }: InsightWidgetProps) {
  const today = new Date()
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })

  // ── Inbox breakdown ────────────────────────────────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const email of emails) {
    const cat = email.category || "Other"
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
  }
  const sorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])
  const top5 = sorted.slice(0, 5)
  const otherCount = sorted.slice(5).reduce((s, [, n]) => s + n, 0)
  if (otherCount > 0) top5.push(["Other", otherCount])
  const totalEmails = emails.length || 1

  // ── Calendar breakdown ─────────────────────────────────────────────────────
  // Sum up booked minutes
  let bookedMins = 0
  const calBuckets: Record<string, number> = {}
  for (const evt of calendarEvents) {
    // parse "9:00 AM" / "10:30 AM" strings
    const startMin = parseTimeToMin(evt.startTime)
    const endMin = evt.endTime ? parseTimeToMin(evt.endTime) : startMin + 60
    const dur = Math.max(endMin - startMin, 0)
    bookedMins += dur
    const bucket = bucketEvent(evt.title)
    calBuckets[bucket] = (calBuckets[bucket] ?? 0) + dur
  }
  const totalDayMins = 16 * 60 // 16 waking hours
  const freeMins = Math.max(totalDayMins - bookedMins, 0)
  if (freeMins > 0) calBuckets["Free"] = freeMins
  const calSorted = Object.entries(calBuckets).sort((a, b) => b[1] - a[1])
  const totalCalMins = calSorted.reduce((s, [, m]) => s + m, 0) || 1

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: "20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
        <div style={theme.labelStyle}>Your day at a glance</div>
        <div style={{ fontSize: "0.75rem", color: "#1A0A35", opacity: 0.45 }}>{dateStr}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Inbox split */}
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1A0A35", opacity: 0.6, marginBottom: "10px" }}>
            📬 Inbox ({emails.length} emails)
          </div>
          {emails.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#1A0A35", opacity: 0.35, fontStyle: "italic" }}>No emails loaded</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
                {top5.map(([cat, count], i) => (
                  <div key={cat} style={{
                    width: `${(count / totalEmails) * 100}%`,
                    background: FIESTA_COLORS[i % FIESTA_COLORS.length],
                    transition: "width 0.6s ease",
                  }} />
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {top5.map(([cat, count], i) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.78rem", color: "#1A0A35" }}>
                    <div style={{ width: "9px", height: "9px", borderRadius: "3px", background: FIESTA_COLORS[i % FIESTA_COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
                    <span style={{ opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>{Math.round((count / totalEmails) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Calendar split */}
        <div>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1A0A35", opacity: 0.6, marginBottom: "10px" }}>
            📅 Day ({calendarEvents.length === 0 ? "no events" : `${Math.round(bookedMins / 60 * 10) / 10}h booked`})
          </div>
          {calSorted.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#1A0A35", opacity: 0.35, fontStyle: "italic" }}>Calendar not loaded</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
                {calSorted.map(([cat, mins], i) => (
                  <div key={cat} style={{
                    width: `${(mins / totalCalMins) * 100}%`,
                    background: cat === "Free"
                      ? `${FIESTA_COLORS[i % FIESTA_COLORS.length]}40`
                      : FIESTA_COLORS[i % FIESTA_COLORS.length],
                    transition: "width 0.6s ease",
                  }} />
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {calSorted.map(([cat, mins], i) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.78rem", color: "#1A0A35" }}>
                    <div style={{
                      width: "9px", height: "9px", borderRadius: "3px", flexShrink: 0,
                      background: cat === "Free"
                        ? `${FIESTA_COLORS[i % FIESTA_COLORS.length]}40`
                        : FIESTA_COLORS[i % FIESTA_COLORS.length],
                      border: cat === "Free" ? `1px solid ${FIESTA_COLORS[i % FIESTA_COLORS.length]}80` : "none",
                    }} />
                    <span style={{ flex: 1, opacity: cat === "Free" ? 0.5 : 0.8 }}>{cat}</span>
                    <span style={{ opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round((mins / totalCalMins) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Convert "9:00 AM" / "10:30 PM" → minutes from midnight */
function parseTimeToMin(str: string): number {
  if (!str || str === "All day") return 0
  const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return 0
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && h !== 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h * 60 + m
}
