// GET /api/ai/context
// Returns default system context and categorize instructions for the settings panel.
// Settings are owned client-side in localStorage — this endpoint is read-only.

import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { DEFAULT_SYSTEM_CONTEXT, CATEGORIZE_INSTRUCTIONS } from "@/lib/claude-utils"

const CUSTOM_CONTEXT_PATH = path.join(process.cwd(), "data", "custom-context.json")

export async function GET() {
  // Try to read seed defaults from data/custom-context.json (for first-run seeding only).
  // On Vercel this file is read-only and may not exist — both are fine; client falls back to "".
  let seedCustom: { personal: string; work: string } = { personal: "", work: "" }
  try {
    const raw = await fs.readFile(CUSTOM_CONTEXT_PATH, "utf-8")
    seedCustom = JSON.parse(raw)
  } catch {
    // File absent or unreadable — return empty seeds
  }

  return NextResponse.json({
    systemContext: DEFAULT_SYSTEM_CONTEXT,
    categorizeInstructions: CATEGORIZE_INSTRUCTIONS,
    seedCustom,
  })
}
