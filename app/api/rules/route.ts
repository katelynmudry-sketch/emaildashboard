import { NextResponse } from "next/server"
import { loadRules, saveRule, deleteRule } from "@/lib/rules"
import type { CategorizationRule } from "@/lib/rules"

export async function GET() {
  return NextResponse.json({ rules: loadRules() })
}

export async function POST(request: Request) {
  const rule: CategorizationRule = await request.json()
  if (!rule.id || !rule.category || !rule.description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }
  saveRule(rule)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  deleteRule(id)
  return NextResponse.json({ ok: true })
}
