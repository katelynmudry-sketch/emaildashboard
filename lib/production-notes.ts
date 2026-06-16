import { kv } from "@vercel/kv"

export type ProductionNotes = {
  issues: string
  next: string
  updatedAt: string
}

const KV_KEY = "production-notes"

const DEFAULT_NOTES: ProductionNotes = {
  issues: "All systems go!",
  next: "More features coming soon.",
  updatedAt: "",
}

export async function getNotes(): Promise<ProductionNotes> {
  try {
    const stored = await kv.get<ProductionNotes>(KV_KEY)
    return stored ?? DEFAULT_NOTES
  } catch {
    return DEFAULT_NOTES
  }
}

export async function saveNotes(issues: string, next: string): Promise<ProductionNotes> {
  const notes: ProductionNotes = { issues, next, updatedAt: new Date().toISOString() }
  await kv.set(KV_KEY, notes)
  return notes
}
