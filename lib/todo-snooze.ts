"use client"

const TODO_KEY = "inbox-ai:todos"
const SNOOZE_KEY = "inbox-ai:snoozed"

// ── TODO ─────────────────────────────────────────────────────────────────────

export function getTodoIds(): Set<string> {
  try {
    const raw = localStorage.getItem(TODO_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function setTodo(messageId: string, value: boolean): void {
  try {
    const ids = getTodoIds()
    if (value) ids.add(messageId)
    else ids.delete(messageId)
    localStorage.setItem(TODO_KEY, JSON.stringify([...ids]))
  } catch {}
}

// ── Snooze ────────────────────────────────────────────────────────────────────

type SnoozeMap = Record<string, string> // messageId → ISO date string

function readSnoozeMap(): SnoozeMap {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY)
    return raw ? (JSON.parse(raw) as SnoozeMap) : {}
  } catch {
    return {}
  }
}

export function snoozeEmail(messageId: string, until: string): void {
  try {
    const map = readSnoozeMap()
    map[messageId] = until
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map))
  } catch {}
}

export function unsnoozeEmail(messageId: string): void {
  try {
    const map = readSnoozeMap()
    delete map[messageId]
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map))
  } catch {}
}

export function getSnoozedUntil(messageId: string): string | undefined {
  return readSnoozeMap()[messageId]
}

/**
 * Given a list of message IDs, returns:
 * - stillSnoozed: IDs whose snooze date is still in the future
 * - wokenUp: IDs whose snooze date has passed (should reappear)
 */
export function partitionSnoozed(messageIds: string[]): { stillSnoozed: string[]; wokenUp: string[] } {
  const map = readSnoozeMap()
  const today = new Date().toISOString().slice(0, 10)
  const stillSnoozed: string[] = []
  const wokenUp: string[] = []
  for (const id of messageIds) {
    const until = map[id]
    if (!until) continue
    if (until > today) stillSnoozed.push(id)
    else wokenUp.push(id)
  }
  return { stillSnoozed, wokenUp }
}
