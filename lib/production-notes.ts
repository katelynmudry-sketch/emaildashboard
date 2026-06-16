import { put, list } from "@vercel/blob"

export type ProductionNotes = {
  issues: string
  next: string
  updatedAt: string
}

const BLOB_PATHNAME = "production-notes.json"

const DEFAULT_NOTES: ProductionNotes = {
  issues: "All systems go!",
  next: "More features coming soon.",
  updatedAt: "",
}

export async function getNotes(): Promise<ProductionNotes> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATHNAME })
    if (!blobs.length) return DEFAULT_NOTES
    const res = await fetch(blobs[0].url)
    if (!res.ok) return DEFAULT_NOTES
    return await res.json()
  } catch {
    return DEFAULT_NOTES
  }
}

export async function saveNotes(issues: string, next: string): Promise<ProductionNotes> {
  const notes: ProductionNotes = { issues, next, updatedAt: new Date().toISOString() }
  await put(BLOB_PATHNAME, JSON.stringify(notes), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return notes
}
