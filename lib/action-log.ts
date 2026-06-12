export type ActionType =
  | "archive"
  | "delete"
  | "snooze"
  | "label"
  | "move"
  | "todo-add"
  | "todo-remove"

export interface LogEntry {
  id: string
  type: ActionType
  emailId: string
  emailSubject: string
  detail?: string
  timestamp: number
  undone: boolean
  undoFn?: () => Promise<void>
}

export function createEntry(fields: Omit<LogEntry, "id" | "undone">): LogEntry {
  return { ...fields, id: crypto.randomUUID(), undone: false }
}
