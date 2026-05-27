import { promises as fs } from "fs"
import path from "path"
import type { DharmaTeacher, ManifestationContent } from "./types"

const DATA_DIR = path.join(process.cwd(), "data")

export async function getDharmaTeachers(): Promise<DharmaTeacher[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "dharma-teachers.json"), "utf-8")
  return JSON.parse(raw) as DharmaTeacher[]
}

export async function getDharmaTeacher(id: string): Promise<DharmaTeacher | null> {
  const teachers = await getDharmaTeachers()
  return teachers.find(t => t.id === id) ?? null
}

/** Deterministic daily rotation — zero Claude cost for the quote itself */
export function getDailyQuoteIndex(quotesLength: number): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  return dayOfYear % quotesLength
}

export async function getManifestationContent(): Promise<ManifestationContent> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "dashboard-content.json"), "utf-8")
    return JSON.parse(raw) as ManifestationContent
  } catch {
    return { yearIntention: "", callingIn: [], moonPhase: "", lastUpdated: "" }
  }
}

export async function saveManifestationContent(content: ManifestationContent): Promise<void> {
  const withDate = { ...content, lastUpdated: new Date().toISOString() }
  await fs.writeFile(
    path.join(DATA_DIR, "dashboard-content.json"),
    JSON.stringify(withDate, null, 2),
    "utf-8"
  )
}
