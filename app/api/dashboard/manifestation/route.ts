import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { getManifestationContent, saveManifestationContent } from "@/lib/dashboard-data"
import type { ManifestationContent } from "@/lib/types"

// Farmsense moon phase API — free, no key needed
// Returns phase name like "Waning Crescent", "Full Moon", etc.
async function fetchMoonPhase(): Promise<string> {
  try {
    const unix = Math.floor(Date.now() / 1000)
    const res = await fetch(`https://api.farmsense.net/v1/moonphases/?d=${unix}`, {
      next: { revalidate: 3600 }, // cache 1h — moon doesn't change faster
    })
    if (!res.ok) return ""
    const data = await res.json() as Array<{ phase?: string; Phase?: string }>
    const phase = data[0]?.Phase ?? data[0]?.phase ?? ""
    return phase
  } catch {
    return ""
  }
}

// Moon phase emoji lookup
function moonEmoji(phase: string): string {
  const p = phase.toLowerCase()
  if (p.includes("new"))             return "🌑"
  if (p.includes("waxing crescent")) return "🌒"
  if (p.includes("first quarter"))   return "🌓"
  if (p.includes("waxing gibbous"))  return "🌔"
  if (p.includes("full"))            return "🌕"
  if (p.includes("waning gibbous"))  return "🌖"
  if (p.includes("last quarter") || p.includes("third quarter")) return "🌗"
  if (p.includes("waning crescent")) return "🌘"
  return "🌙"
}

export async function GET() {
  const token = await getServerToken()
  if (!token?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [content, moonPhase] = await Promise.all([
    getManifestationContent(),
    fetchMoonPhase(),
  ])
  // Attach live moon phase to the response (don't overwrite stored content)
  return NextResponse.json({ ...content, moonPhase: moonPhase || content.moonPhase || "" })
}

export async function PUT(request: Request) {
  const token = await getServerToken()
  if (!token?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json() as ManifestationContent
  await saveManifestationContent(body)
  return NextResponse.json({ ok: true })
}

