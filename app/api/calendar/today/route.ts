import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { google } from "googleapis"
import type { CalendarEvent } from "@/lib/types"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

const EVENT_COLORS = ["#FF1F6E", "#FFD000", "#FF6B1A", "#00C4A7", "#8FC900", "#8B3FD8"]

function toHHMM(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true })
}

export async function GET(request: Request) {
  const token = await getServerToken()
  const url = new URL(request.url)
  const accountId = parseAccountId(url.searchParams.get("account"))
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: authz.accessToken })
    const calendar = google.calendar({ version: "v3", auth: oauth2 })

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    })

    const nowMs = now.getTime()
    const events: CalendarEvent[] = (res.data.items ?? []).map((item, i) => {
      const start = item.start?.dateTime ?? item.start?.date ?? ""
      const end = item.end?.dateTime ?? item.end?.date ?? ""
      const startMs = start ? new Date(start).getTime() : 0
      const endMs = end ? new Date(end).getTime() : startMs + 3_600_000
      return {
        id: item.id ?? String(i),
        title: item.summary ?? "Untitled event",
        startTime: start ? toHHMM(start) : "All day",
        endTime: end ? toHHMM(end) : undefined,
        colorDot: EVENT_COLORS[i % EVENT_COLORS.length],
        location: item.location ?? undefined,
        isNow: nowMs >= startMs && nowMs <= endMs,
      }
    })

    return NextResponse.json({ events })
  } catch (err) {
    console.error("[calendar/today]", err)
    return NextResponse.json({ events: [] }) // graceful fallback — never 500 for dashboard
  }
}
