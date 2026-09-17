import { put, list } from "@vercel/blob"

export interface CategorizationRule {
  id: string
  description: string        // human-readable: "OutSmart 'document uploaded' → Details"
  fromPattern?: string       // substring match on sender email/name
  subjectPattern?: string    // substring match on subject
  category: string           // target category name
  createdAt: string          // ISO
}

const BLOB_PATHNAME = "categorization-rules.json"

export async function loadRules(): Promise<CategorizationRule[]> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATHNAME })
    if (!blobs.length) return []
    const res = await fetch(blobs[0].url)
    if (!res.ok) return []
    return await res.json() as CategorizationRule[]
  } catch {
    return []
  }
}

async function writeRules(rules: CategorizationRule[]): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(rules, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function saveRule(rule: CategorizationRule): Promise<void> {
  const existing = await loadRules()
  // Replace if same id, otherwise append
  const idx = existing.findIndex(r => r.id === rule.id)
  if (idx >= 0) existing[idx] = rule
  else existing.push(rule)
  await writeRules(existing)
}

export async function deleteRule(id: string): Promise<void> {
  const existing = (await loadRules()).filter(r => r.id !== id)
  await writeRules(existing)
}

/** Format rules as a prompt section to inject into Claude's system prompt */
export function formatRulesForPrompt(rules: CategorizationRule[]): string {
  if (rules.length === 0) return ""
  const lines = rules.map(r => {
    const parts: string[] = []
    if (r.fromPattern) parts.push(`sender contains "${r.fromPattern}"`)
    if (r.subjectPattern) parts.push(`subject contains "${r.subjectPattern}"`)
    return `- If ${parts.join(" AND ")}: assign category "${r.category}". (${r.description})`
  })
  return `\n## User-defined categorization rules (ALWAYS apply these first, they override your judgment)\n${lines.join("\n")}\n`
}
