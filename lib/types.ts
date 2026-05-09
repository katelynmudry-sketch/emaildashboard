import type { DefaultSession } from "next-auth"

// ── next-auth session augmentation ──────────────────────────────────────────

declare module "next-auth" {
  interface Session extends DefaultSession {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    error?: "RefreshTokenError"
  }
}

// ── Email ────────────────────────────────────────────────────────────────────

export interface RawEmail {
  id: string
  threadId: string
  from: string
  fromEmail: string
  to: string
  subject: string
  snippet: string
  body: string          // truncated to 2000 chars
  date: string          // ISO string
  internalDate: number  // ms timestamp for sorting
  inReplyTo?: string
  messageId?: string    // RFC 2822 Message-ID header
  labelIds: string[]
}

export interface Email {
  id: string
  threadId: string
  from: string          // display name only
  fromEmail: string
  to: string
  subject: string
  snippet: string
  body: string
  date: string
  internalDate: number
  inReplyTo?: string
  messageId?: string
  labelIds: string[]
  // AI-added fields
  category: string
  priority: "urgent" | "today" | "fyi"
  summary: string | null  // null if email is short and not promotional
  microSummary: string    // 2-3 word phrase for email row display
  actionFlag: "reply" | "confirm" | "receipt" | "read"
  draftReply: string | null
  timeAgo: string
}

// ── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string            // Gmail label ID (created/found via API)
  name: string          // display name, e.g. "Bills"
  color: string         // tailwind bg color class, e.g. "bg-violet-500"
  gmailLabelId: string  // actual Gmail label ID for applying
}

export interface CategoryConfig {
  account: string       // email address
  categories: Category[]
  proposedAt: string    // ISO timestamp
}

// ── Inbox data ───────────────────────────────────────────────────────────────

export interface InboxData {
  account: string
  fetchedAt: string
  emails: Email[]
  categories: Category[]
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface CategorizeRequest {
  emails: RawEmail[]
  categories: Category[]
  account: string
}

export interface ProposeRequest {
  emails: RawEmail[]
  existingLabelNames: string[]  // already in Gmail for this account
  account: string
}

export interface ProposeResponse {
  categories: Omit<Category, "id" | "gmailLabelId">[]  // names + colors only; IDs assigned after Gmail label creation
}

export interface LabelRequest {
  messageId: string
  gmailLabelId: string
}

export interface ArchiveRequest {
  messageId: string
}

export interface ReadRequest {
  messageId: string
}

export interface DraftRequest {
  to: string
  subject: string
  body: string
  threadId: string
  inReplyTo?: string
  messageId?: string
}

// ── UI state ─────────────────────────────────────────────────────────────────

export type AccountId = "personal" | "work"

export interface AccountConfig {
  id: AccountId
  email: string
  label: string
}

export const ACCOUNTS: AccountConfig[] = [
  { id: "personal", email: "katelynmudry@gmail.com", label: "katelynmudry" },
  { id: "work",     email: "drkmudry@gmail.com",     label: "drkmudry" },
]
