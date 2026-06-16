import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getNotes, saveNotes } from "@/lib/production-notes"

const ADMIN_EMAIL = "katelynmudry@gmail.com"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const notes = await getNotes()
  return NextResponse.json(notes)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { issues, next } = await request.json()
  if (typeof issues !== "string" || typeof next !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const notes = await saveNotes(issues.trim(), next.trim())
  return NextResponse.json(notes)
}
