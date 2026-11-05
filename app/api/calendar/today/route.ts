import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { google, type calendar_v3 } from "googleapis"
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

    // "primary" is only this account's own default calendar — secondary,
    // shared, and subscribed calendars (which Google Calendar's UI merges
    // into one view) live under their own calendar IDs and need their own
    // events.list call.
    const calendarList = await calendar.calendarList.list()
    const sourceCalendars = (calendarList.data.items ?? []).filter(c => c.accessRole !== "freeBusyReader")

    const perCalendarResults = await Promise.all(
      sourceCalendars.map(cal =>
        calendar.events
          .list({
            calendarId: cal.id!,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 20,
          })
          .then(res => ({ cal, items: res.data.items ?? [] }))
          .catch(() => ({ cal, items: [] as calendar_v3.Schema$Event[] })),
      ),
    )

    const nowMs = now.getTime()
    const events: CalendarEvent[] = perCalendarResults
      .flatMap(({ cal, items }, calIdx) =>
        items
          .filter(item => item.status !== "cancelled")
          .map((item, i) => {
            const start = item.start?.dateTime ?? item.start?.date ?? ""
            const end = item.end?.dateTime ?? item.end?.date ?? ""
            const startMs = start ? new Date(start).getTime() : 0
            const endMs = end ? new Date(end).getTime() : startMs + 3_600_000
            return {
              id: item.id ?? `${cal.id}-${i}`,
              title: item.summary ?? "Untitled event",
              startTime: start ? toHHMM(start) : "All day",
              endTime: end ? toHHMM(end) : undefined,
              colorDot: cal.backgroundColor || EVENT_COLORS[calIdx % EVENT_COLORS.length],
              location: item.location ?? undefined,
              isNow: nowMs >= startMs && nowMs <= endMs,
              _sortMs: startMs,
            }
          }),
      )
      .sort((a, b) => a._sortMs - b._sortMs)
      .slice(0, 20)
      .map(({ _sortMs, ...event }) => event)

    return NextResponse.json({ events })
  } catch (err) {
    console.error("[calendar/today]", err)
    // Google returns 403 "insufficient authentication scopes" when the stored
    // access token predates the calendar.readonly scope being added — the
    // user authenticated before that scope existed and hasn't re-consented
    // since, so their refresh token still only carries Gmail scopes. That
    // looks identical to "no events today" unless we call it out separately.
    const status = (err as { response?: { status?: number }; code?: number })?.response?.status
      ?? (err as { code?: number })?.code
    const code = status === 403 ? "CALENDAR_SCOPE_MISSING" : undefined
    return NextResponse.json({ events: [], code }) // graceful fallback — never 500 for dashboard
  }
}
