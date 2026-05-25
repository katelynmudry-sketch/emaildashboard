import fs from "fs"
import path from "path"

export interface CategorizationRule {
  id: string
  description: string        // human-readable: "OutSmart 'document uploaded' → Details"
  fromPattern?: string       // substring match on sender email/name
  subjectPattern?: string    // substring match on subject
  category: string           // target category name
  createdAt: string          // ISO
}

const RULES_FILE = path.join(process.cwd(), "data", "categorization-rules.json")

function ensureDir() {
  const dir = path.dirname(RULES_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function loadRules(): CategorizationRule[] {
  try {
    if (!fs.existsSync(RULES_FILE)) return []
    return JSON.parse(fs.readFileSync(RULES_FILE, "utf-8")) as CategorizationRule[]
  } catch {
    return []
  }
}

export function saveRule(rule: CategorizationRule): void {
  ensureDir()
  const existing = loadRules()
  // Replace if same id, otherwise append
  const idx = existing.findIndex(r => r.id === rule.id)
  if (idx >= 0) existing[idx] = rule
  else existing.push(rule)
  fs.writeFileSync(RULES_FILE, JSON.stringify(existing, null, 2), "utf-8")
}

export function deleteRule(id: string): void {
  ensureDir()
  const existing = loadRules().filter(r => r.id !== id)
  fs.writeFileSync(RULES_FILE, JSON.stringify(existing, null, 2), "utf-8")
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
