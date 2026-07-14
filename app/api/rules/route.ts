import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { loadRules, saveRule, deleteRule } from "@/lib/rules"
import type { CategorizationRule } from "@/lib/rules"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ rules: loadRules() })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rule: CategorizationRule = await request.json()
  if (!rule.id || !rule.category || !rule.description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }
  saveRule(rule)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  deleteRule(id)
  return NextResponse.json({ ok: true })
}
